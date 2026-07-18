import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GuidedLearningCommandName,
  GuidedLearningQuestion,
  GuidedLearningSession,
} from "../../../../../packages/contracts/wave1/src/index.js";
import {
  GuidedLearningApiClient,
  GuidedLearningApiError,
  type GuidedProviderConfig,
  type Project,
  pdfFrameKey,
  pdfSourceWithPage,
  type WorkflowJob,
} from "./api.js";
import {
  isGuidedLearningPendingState,
  pollGuidedLearningSession,
  pollWorkflowJob,
} from "./polling.js";
import "./guided-learning.css";

const api = new GuidedLearningApiClient();

type Props = { onBack: () => void };
type GuidedByokProvider = Exclude<
  GuidedProviderConfig,
  { provider: "MOCK" }
>["provider"];
type PendingAction =
  | GuidedLearningCommandName
  | "PROJECT"
  | "UPLOAD"
  | "SESSION"
  | null;
type FeedbackQuestion = Extract<
  GuidedLearningQuestion,
  { status: "FEEDBACK_READY" | "CONFIRMED" }
>;

export function GuidedLearningWorkbench({ onBack }: Props) {
  const [projectName, setProjectName] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [documentVersionId, setDocumentVersionId] = useState<string | null>(
    null,
  );
  const [documentJob, setDocumentJob] = useState<WorkflowJob | null>(null);
  const [learningGoal, setLearningGoal] = useState("");
  const [providerMode, setProviderMode] = useState<"MOCK" | "BYOK">("MOCK");
  const [provider, setProvider] = useState<GuidedByokProvider>("OPENAI");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [pdfNavigation, setPdfNavigation] = useState<{
    page: number;
    reloadToken: number;
  } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    readSessionId(),
  );
  const [session, setSession] = useState<GuidedLearningSession | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const recoveryAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPdfPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPdfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!sessionId || session || recoveryAttempt.current === sessionId) return;
    recoveryAttempt.current = sessionId;
    let active = true;
    api
      .getGuidedLearningSession(sessionId)
      .then((value) => {
        if (!active) return;
        setSession(value);
        setProject({ project_id: value.project_id, name: "已恢复项目" });
        setDocumentVersionId(value.document_version_id);
        setLearningGoal(value.learning_goal);
        setPdfNavigation(null);
        setPollError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (
          reason instanceof GuidedLearningApiError &&
          reason.code === "NOT_FOUND"
        ) {
          clearSessionUrl();
          setSessionId(null);
          setError("该学习会话已不存在，请重新创建。 ");
        } else setError(toUserMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [session, sessionId]);

  const sessionState = session?.state;
  useEffect(() => {
    if (
      !sessionId ||
      !sessionState ||
      !isGuidedLearningPendingState(sessionState)
    )
      return;
    const controller = new AbortController();
    pollGuidedLearningSession(api, sessionId, {
      signal: controller.signal,
      onValue: (value) => {
        setSession(value);
        setPollError(null);
      },
      onError: (reason, failures) => {
        if (failures >= 3) setPollError(toUserMessage(reason));
      },
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setPollError(toUserMessage(reason));
    });
    return () => controller.abort();
  }, [sessionId, sessionState]);

  const documentJobId = documentJob?.job_id;
  const documentJobStatus = documentJob?.status;
  useEffect(() => {
    if (
      !documentJobId ||
      documentJobStatus === "SUCCEEDED" ||
      documentJobStatus === "FAILED"
    )
      return;
    const controller = new AbortController();
    pollWorkflowJob(api, documentJobId, {
      signal: controller.signal,
      onValue: setDocumentJob,
      onError: (reason, failures) => {
        if (failures >= 3) setPollError(toUserMessage(reason));
      },
    })
      .then((job) => {
        setDocumentJob(job);
        if (job.status === "FAILED")
          setError("PDF 导入失败，请重新选择文件重试。");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setPollError(toUserMessage(reason));
      });
    return () => controller.abort();
  }, [documentJobId, documentJobStatus]);

  const currentQuestion = useMemo(
    () => findCurrentQuestion(session),
    [session],
  );
  const currentQuestionStatus = currentQuestion?.status;
  const currentQuestionAnswer =
    currentQuestion && "user_answer" in currentQuestion
      ? currentQuestion.user_answer
      : undefined;
  useEffect(() => {
    if (currentQuestionAnswer !== undefined)
      setAnswerDraft(currentQuestionAnswer);
    else if (currentQuestionStatus === "ACTIVE") setAnswerDraft("");
  }, [currentQuestionAnswer, currentQuestionStatus]);

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectName.trim()) return setError("请输入项目名称。");
    setPendingAction("PROJECT");
    setError(null);
    try {
      setProject(await api.createProject(projectName.trim()));
    } catch (reason) {
      setError(toUserMessage(reason));
    } finally {
      setPendingAction(null);
    }
  };

  const uploadPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!project) {
      setError("请先创建项目，再导入 PDF。");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("请选择可提取文本的 PDF 文件。");
      return;
    }
    setPendingAction("UPLOAD");
    setError(null);
    try {
      const result = await api.uploadPdf(project.project_id, file);
      setDocumentVersionId(result.document_version_id);
      setDocumentJob({
        job_id: result.job_id,
        job_type: "DOCUMENT_IMPORT",
        status: "QUEUED",
        related: {
          project_id: project.project_id,
          document_id: result.document_id,
          document_version_id: result.document_version_id,
          question_id: null,
        },
        error: null,
      });
    } catch (reason) {
      setError(toUserMessage(reason));
    } finally {
      setPendingAction(null);
    }
  };

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project || !documentVersionId || documentJob?.status !== "SUCCEEDED") {
      setError("请先完成 PDF 导入。");
      return;
    }
    if (!learningGoal.trim()) {
      setError("请输入学习目标。");
      return;
    }
    setPendingAction("SESSION");
    setError(null);
    try {
      const result = await api.createGuidedLearningSession({
        project_id: project.project_id,
        document_version_id: documentVersionId,
        learning_goal: learningGoal.trim(),
        provider_config:
          providerMode === "MOCK"
            ? { provider: "MOCK", fixture_id: "guided-learning-v1" }
            : {
                provider,
                base_url: baseUrl,
                model,
                request_timeout_ms: 30000,
                max_input_characters: 200000,
                max_output_tokens: 2000,
              },
      });
      setSession(result.session);
      setSessionId(result.session.session_id);
      writeSessionUrl(result.session.session_id);
    } catch (reason) {
      setError(toUserMessage(reason));
    } finally {
      setPendingAction(null);
    }
  };

  const testConnection = async () => {
    if (providerMode === "MOCK")
      return setConnectionStatus("Mock 无需连接测试。");
    setConnectionStatus("正在使用 Worker 环境 secret 测试连接……");
    try {
      const result = await api.testEnvironmentConnection({
        provider,
        base_url: baseUrl,
        model,
        request_timeout_ms: 30000,
        max_input_characters: 200000,
        max_output_tokens: 2000,
      });
      setConnectionStatus(
        (result as { output?: { success?: boolean } }).output?.success
          ? "连接成功（未传输浏览器 key）。"
          : "连接失败，请检查服务端环境 secret。",
      );
    } catch (reason) {
      setConnectionStatus(toUserMessage(reason));
    }
  };

  const sendCommand = async (
    event: GuidedLearningCommandName,
    payload: unknown,
  ): Promise<GuidedLearningSession | null> => {
    if (!sessionId) return null;
    setPendingAction(event);
    setError(null);
    try {
      const result = await api.sendGuidedLearningCommand(sessionId, {
        event,
        payload,
      });
      setSession(result.session);
      setPollError(null);
      return result.session;
    } catch (reason) {
      setError(toUserMessage(reason));
      if (
        reason instanceof GuidedLearningApiError &&
        reason.code === "REVISION_CONFLICT"
      )
        await refreshSession();
      return null;
    } finally {
      setPendingAction(null);
    }
  };

  const selectDirection = (directionId: string) =>
    sendCommand("SELECT_DIRECTION", { direction_id: directionId });

  const startStage = () =>
    sendCommand("START_STAGE", { stage_id: "UNDERSTAND" });

  const submitAnswer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentQuestion || !answerDraft.trim()) {
      setError("回答不能为空。");
      return;
    }
    return sendCommand("SUBMIT_ANSWER", {
      question_id: currentQuestion.question_id,
      question_order: currentQuestion.order,
      answer: answerDraft.trim(),
    });
  };

  const skipQuestion = () => {
    if (!currentQuestion) return;
    return sendCommand("SKIP_QUESTION", {
      question_id: currentQuestion.question_id,
      question_order: currentQuestion.order,
      reason: "I_DONT_KNOW",
    });
  };

  const editAnswer = () => {
    if (!currentQuestion || !answerDraft.trim()) {
      setError("修改后的回答不能为空。");
      return;
    }
    return sendCommand("EDIT_ANSWER", {
      question_id: currentQuestion.question_id,
      question_order: currentQuestion.order,
      answer: answerDraft.trim(),
    });
  };

  const confirmAndAdvance = async () => {
    if (!currentQuestion) return;
    const pointer = {
      question_id: currentQuestion.question_id,
      question_order: currentQuestion.order,
    };
    const completed = await sendCommand("CONFIRM_QUESTION", pointer);
    if (completed?.state === "QUESTION_COMPLETED")
      await sendCommand("ADVANCE_QUESTION", pointer);
  };

  const advanceQuestion = () => {
    if (!currentQuestion) return;
    return sendCommand("ADVANCE_QUESTION", {
      question_id: currentQuestion.question_id,
      question_order: currentQuestion.order,
    });
  };

  const retry = () => sendCommand("RETRY", {});

  const refreshSession = async () => {
    if (!sessionId) return;
    try {
      setSession(await api.getGuidedLearningSession(sessionId));
      setPollError(null);
    } catch (reason) {
      setError(toUserMessage(reason));
    }
  };

  const resetSession = () => {
    clearSessionUrl();
    setSessionId(null);
    setSession(null);
    setPollError(null);
    setError(null);
  };

  const documentReady = documentJob?.status === "SUCCEEDED" || Boolean(session);
  const busy = pendingAction !== null;
  const navigateToEvidencePage = (page: number) => {
    setPdfNavigation((current) => ({
      page,
      reloadToken: (current?.reloadToken ?? 0) + 1,
    }));
  };

  return (
    <section
      className="guided-learning-workbench"
      data-testid="guided-learning-workbench"
    >
      <div className="guided-learning-actions">
        <button type="button" onClick={onBack}>
          返回快速问答
        </button>
        {session && (
          <button type="button" onClick={resetSession}>
            返回项目
          </button>
        )}
      </div>
      {error && (
        <p
          className="guided-learning-status guided-learning-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {pollError && (
        <p
          className="guided-learning-status guided-learning-error"
          role="alert"
        >
          {pollError}{" "}
          <button type="button" onClick={refreshSession}>
            重新读取进度
          </button>
        </p>
      )}

      {!session ? (
        <PreparationPanel
          project={project}
          projectName={projectName}
          setProjectName={setProjectName}
          createProject={createProject}
          selectedFile={selectedFile}
          uploadPdf={uploadPdf}
          documentJob={documentJob}
          learningGoal={learningGoal}
          setLearningGoal={setLearningGoal}
          createSession={createSession}
          providerMode={providerMode}
          setProviderMode={setProviderMode}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          baseUrl={baseUrl}
          setBaseUrl={setBaseUrl}
          testConnection={testConnection}
          connectionStatus={connectionStatus}
          busy={busy}
          documentReady={documentReady}
        />
      ) : (
        <SessionPanel
          session={session}
          currentQuestion={currentQuestion}
          answerDraft={answerDraft}
          setAnswerDraft={setAnswerDraft}
          pdfPreviewUrl={pdfPreviewUrl}
          pdfContentUrl={api.documentContentUrl(session.document_version_id)}
          pdfPage={pdfNavigation?.page ?? null}
          pdfReloadToken={pdfNavigation?.reloadToken ?? 0}
          onEvidencePage={navigateToEvidencePage}
          pendingAction={pendingAction}
          selectDirection={selectDirection}
          startStage={startStage}
          submitAnswer={submitAnswer}
          skipQuestion={skipQuestion}
          editAnswer={editAnswer}
          confirmAndAdvance={confirmAndAdvance}
          advanceQuestion={advanceQuestion}
          retry={retry}
        />
      )}
    </section>
  );
}

function PreparationPanel(props: {
  project: Project | null;
  projectName: string;
  setProjectName: (value: string) => void;
  createProject: (event: React.FormEvent) => void;
  selectedFile: File | null;
  uploadPdf: (event: React.ChangeEvent<HTMLInputElement>) => void;
  documentJob: WorkflowJob | null;
  learningGoal: string;
  setLearningGoal: (value: string) => void;
  createSession: (event: React.FormEvent) => void;
  providerMode: "MOCK" | "BYOK";
  setProviderMode: (value: "MOCK" | "BYOK") => void;
  provider: GuidedByokProvider;
  setProvider: (value: GuidedByokProvider) => void;
  model: string;
  setModel: (value: string) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  testConnection: () => void;
  connectionStatus: string | null;
  busy: boolean;
  documentReady: boolean;
}) {
  return (
    <div className="guided-learning-card guided-learning-form">
      <h2>引导式学习</h2>
      <p className="guided-learning-meta">
        创建项目、导入真实可提取文本 PDF，再开始理解内容阶段。
      </p>
      <form onSubmit={props.createProject} className="guided-learning-form">
        <label>
          项目名称
          <input
            aria-label="Guided project name"
            value={props.projectName}
            onChange={(event) => props.setProjectName(event.target.value)}
            placeholder="例如：方法设计阅读笔记"
          />
        </label>
        <button type="submit" disabled={props.busy || Boolean(props.project)}>
          {props.project ? "项目已创建" : "创建项目"}
        </button>
      </form>
      {props.project && (
        <p
          className="guided-learning-status guided-learning-success"
          data-testid="guided-project-ready"
        >
          当前项目：{props.project.name}
        </p>
      )}
      <label>
        导入真实文本 PDF
        <input
          aria-label="Guided PDF file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={props.uploadPdf}
          disabled={!props.project || props.busy}
        />
      </label>
      {props.selectedFile && (
        <p data-testid="guided-document-name">
          已选择：{props.selectedFile.name}
        </p>
      )}
      {props.documentJob && props.documentJob.status !== "SUCCEEDED" && (
        <p
          className="guided-learning-status"
          role="status"
          data-testid="guided-document-loading"
        >
          正在导入并提取论文文本……（{props.documentJob.status}）
        </p>
      )}
      {props.documentReady && (
        <p className="guided-learning-success">
          PDF 已就绪，可以创建学习会话。
        </p>
      )}
      <form onSubmit={props.createSession} className="guided-learning-form">
        <label>
          生成模式
          <select
            value={props.providerMode}
            onChange={(event) =>
              props.setProviderMode(event.target.value as "MOCK" | "BYOK")
            }
          >
            <option value="MOCK">Mock（确定性）</option>
            <option value="BYOK">BYOK（服务端环境 secret）</option>
          </select>
        </label>
        {props.providerMode === "BYOK" && (
          <>
            <label>
              Provider
              <select
                value={props.provider}
                onChange={(event) =>
                  props.setProvider(event.target.value as GuidedByokProvider)
                }
              >
                <option value="OPENAI">OpenAI</option>
                <option value="GEMINI">Gemini</option>
                <option value="GROQ">Groq</option>
                <option value="OPENROUTER">OpenRouter</option>
                <option value="CUSTOM_OPENAI_COMPATIBLE">
                  Custom OpenAI Compatible
                </option>
              </select>
            </label>
            <label>
              Model
              <input
                value={props.model}
                onChange={(event) => props.setModel(event.target.value)}
              />
            </label>
            <label>
              HTTPS Endpoint
              <input
                value={props.baseUrl}
                onChange={(event) => props.setBaseUrl(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={props.testConnection}
              disabled={props.busy}
            >
              测试服务端环境连接
            </button>
            {props.connectionStatus && (
              <p className="guided-learning-meta">{props.connectionStatus}</p>
            )}
            <p className="guided-learning-meta">
              API key 不在浏览器中显示、输入或发送；API 与 Worker 使用
              `WORKFLOW_BYOK_API_KEY`。
            </p>
          </>
        )}
        <label>
          学习目标
          <textarea
            aria-label="Learning goal"
            value={props.learningGoal}
            onChange={(event) => props.setLearningGoal(event.target.value)}
            placeholder="我希望理解这篇论文的方法设计和关键证据。"
          />
        </label>
        <button
          className="guided-learning-primary"
          type="submit"
          disabled={props.busy || !props.documentReady}
        >
          创建 Guided Learning Session
        </button>
      </form>
    </div>
  );
}

function SessionPanel(props: {
  session: GuidedLearningSession;
  currentQuestion: GuidedLearningQuestion | undefined;
  answerDraft: string;
  setAnswerDraft: (value: string) => void;
  pdfPreviewUrl: string | null;
  pdfContentUrl: string;
  pdfPage: number | null;
  pdfReloadToken: number;
  onEvidencePage: (page: number) => void;
  pendingAction: PendingAction;
  selectDirection: (directionId: string) => void;
  startStage: () => void;
  submitAnswer: (event: React.FormEvent) => void;
  skipQuestion: () => void;
  editAnswer: () => void;
  confirmAndAdvance: () => void;
  advanceQuestion: () => void;
  retry: () => void;
}) {
  const { session } = props;
  const totalQuestions = session.questions?.length ?? 0;
  const question = props.currentQuestion;
  const feedback = question && isFeedbackQuestion(question) ? question : null;
  const waitingMessage = waitingText(session.state);
  return (
    <div className="guided-learning-grid">
      <aside>
        <div className="guided-learning-card">
          <h3>论文原文</h3>
          {props.pdfPreviewUrl || props.pdfContentUrl ? (
            <PdfPreview
              contentUrl={props.pdfContentUrl}
              previewUrl={props.pdfPreviewUrl}
              page={props.pdfPage}
              reloadToken={props.pdfReloadToken}
            />
          ) : (
            <p className="guided-learning-meta">正在读取服务端 PDF 内容。</p>
          )}
        </div>
        {session.route && (
          <div className="guided-learning-card">
            <h3>学习路线</h3>
            <ul className="guided-learning-route">
              {session.route.stages.map((stage) => (
                <li key={stage.stage_id}>
                  <span>
                    {stage.order}. {stage.title}
                  </span>
                  <strong>
                    {stage.status === "LOCKED" ? "即将开放" : stage.status}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
      <section>
        <div className="guided-learning-card">
          <p className="guided-learning-meta">
            学习目标：{session.learning_goal}
          </p>
          <p className="guided-learning-meta">
            当前阶段：理解内容 · 状态：{session.state} · revision{" "}
            {session.session_revision}
          </p>
        </div>
        {waitingMessage && (
          <p
            className="guided-learning-card guided-learning-status"
            role="status"
            data-testid="guided-learning-loading"
          >
            {waitingMessage}
          </p>
        )}
        {session.state === "AWAITING_DIRECTION_SELECTION" && (
          <div className="guided-learning-card">
            <h2>选择学习方向</h2>
            <div className="guided-learning-directions">
              {session.candidate_directions.map((direction) => (
                <article
                  className="guided-learning-direction"
                  key={direction.direction_id}
                >
                  <h3>{direction.title}</h3>
                  <p>{direction.description}</p>
                  <p className="guided-learning-meta">
                    选择依据：{direction.selection_basis}
                  </p>
                  <button
                    className="guided-learning-primary"
                    type="button"
                    disabled={props.pendingAction !== null}
                    onClick={() =>
                      props.selectDirection(direction.direction_id)
                    }
                  >
                    选择这个方向
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        {session.state === "ROUTE_LOCKED" && (
          <div className="guided-learning-card">
            <h2>方向已锁定</h2>
            <p>理解内容阶段已开放；分析评价和迁移应用在 V1.0 中保持锁定。</p>
            <button
              className="guided-learning-primary"
              type="button"
              disabled={props.pendingAction !== null}
              onClick={props.startStage}
            >
              开始理解内容
            </button>
          </div>
        )}
        {(session.state === "AWAITING_ANSWER" ||
          session.state === "ANSWER_SUBMITTED") &&
          question && (
            <div className="guided-learning-card">
              <h2>
                理解阶段 · 第 {question.order} / {totalQuestions} 题
              </h2>
              <p>{question.prompt}</p>
              <form
                className="guided-learning-form"
                onSubmit={props.submitAnswer}
              >
                <label>
                  我的回答
                  <textarea
                    aria-label="Guided answer"
                    value={props.answerDraft}
                    onChange={(event) =>
                      props.setAnswerDraft(event.target.value)
                    }
                    disabled={
                      session.state !== "AWAITING_ANSWER" ||
                      props.pendingAction !== null
                    }
                  />
                </label>
                <div className="guided-learning-actions">
                  <button
                    className="guided-learning-primary"
                    type="submit"
                    disabled={
                      session.state !== "AWAITING_ANSWER" ||
                      props.pendingAction !== null
                    }
                  >
                    提交回答
                  </button>
                  <button
                    type="button"
                    onClick={props.skipQuestion}
                    disabled={
                      session.state !== "AWAITING_ANSWER" ||
                      props.pendingAction !== null
                    }
                  >
                    不会，跳过
                  </button>
                </div>
              </form>
            </div>
          )}
        {session.state === "FEEDBACK_READY" && feedback && (
          <FeedbackPanel question={feedback} {...props} />
        )}
        {session.state === "QUESTION_COMPLETED" && question && (
          <div className="guided-learning-card guided-learning-success">
            <h2>第 {question.order} 题已完成</h2>
            <p>
              {question.status === "SKIPPED"
                ? "本题已记录为跳过。"
                : "本题已确认，服务端已保存学习进度。"}
            </p>
            <button
              className="guided-learning-primary"
              type="button"
              disabled={props.pendingAction !== null}
              onClick={props.advanceQuestion}
            >
              {question.order === totalQuestions
                ? "生成阶段总结"
                : "进入下一题"}
            </button>
          </div>
        )}
        {(session.state === "STAGE_COMPLETED" ||
          session.state === "SESSION_COMPLETED") &&
          session.stage_summary && (
            <SummaryPanel summary={session.stage_summary} />
          )}
        {session.state === "RETRYABLE_FAILURE" && session.failure && (
          <div
            className="guided-learning-card guided-learning-error"
            data-testid="guided-learning-failure"
          >
            <h2>生成失败</h2>
            <p>{session.failure.message}</p>
            <p className="guided-learning-meta">
              操作：{session.failure.failed_operation} · 可重试
            </p>
            <button
              className="guided-learning-primary"
              type="button"
              disabled={props.pendingAction !== null}
              onClick={props.retry}
            >
              重试生成
            </button>
          </div>
        )}
        {session.state === "FAILED" && session.failure && (
          <div className="guided-learning-card guided-learning-error">
            <h2>本次生成无法继续</h2>
            <p>{session.failure.message}</p>
            <p>请返回项目后重新选择文档或学习目标。</p>
          </div>
        )}
      </section>
    </div>
  );
}

type PdfLoadState = "loading" | "loaded" | "failed";
const PDF_LOAD_TIMEOUT_MS = 10000;

function PdfPreview(props: {
  previewUrl: string | null;
  contentUrl: string;
  page: number | null;
  reloadToken: number;
}) {
  const source = props.previewUrl ?? props.contentUrl;
  const sourceWithPage = pdfSourceWithPage(source, props.page);
  const navigationKey = pdfFrameKey(source, props.page, props.reloadToken);
  const [loadState, setLoadState] = useState<PdfLoadState>("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishLoad = (state: PdfLoadState) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setLoadState(state);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: navigation changes must restart the bounded load timer.
  useEffect(() => {
    setLoadState("loading");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setLoadState("failed"),
      PDF_LOAD_TIMEOUT_MS,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [navigationKey]);

  return (
    <div>
      {props.page && (
        <p className="guided-learning-status" data-testid="pdf-page-target">
          当前定位目标：第 {props.page} 页
        </p>
      )}
      {loadState === "loading" && (
        <p className="guided-learning-meta" role="status">
          正在加载 PDF{props.page ? ` 并定位第 ${props.page} 页` : ""}……
        </p>
      )}
      {loadState === "failed" && (
        <p
          className="guided-learning-status guided-learning-error"
          role="alert"
        >
          PDF
          查看器未确认加载完成。浏览器内置查看器可能不支持自动定位，请使用下方新标签页入口核对原文。
        </p>
      )}
      <iframe
        key={navigationKey}
        className="guided-learning-pdf"
        title="Imported PDF preview"
        src={sourceWithPage}
        data-navigation-key={navigationKey}
        onLoad={() => finishLoad("loaded")}
        onError={() => finishLoad("failed")}
      />
      {props.page && (
        <div className="guided-learning-pdf-toolbar">
          <a href={sourceWithPage} target="_blank" rel="noreferrer">
            在新标签页打开第 {props.page} 页
          </a>
          <span className="guided-learning-meta">
            若内置查看器未自动跳转，请在新标签页中手动核对第 {props.page} 页。
          </span>
        </div>
      )}
    </div>
  );
}

function FeedbackPanel(
  props: Parameters<typeof SessionPanel>[0] & { question: FeedbackQuestion },
) {
  const { question } = props;
  return (
    <div className="guided-learning-card" data-testid="guided-feedback-panel">
      <h2>点评与参考答案</h2>
      <h3>我的回答</h3>
      <p>{question.user_answer}</p>
      <h3>回答点评</h3>
      <p>{question.feedback.summary}</p>
      {question.feedback.omissions.length > 0 && (
        <>
          <h4>可以补充</h4>
          <ul>
            {question.feedback.omissions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <h3>参考答案</h3>
      <p>{question.reference_answer.text}</p>
      <ul>
        {question.reference_answer.claims.map((claim) => (
          <li key={claim.text}>
            {claim.text}{" "}
            <span className="guided-learning-meta">[{claim.claim_type}]</span>
          </li>
        ))}
      </ul>
      <div className="guided-learning-evidence">
        <h3>Evidence 原文证据</h3>
        <p className="guided-learning-meta">
          VERIFIED
          仅表示引用位置与原文字符串已逐字核对，不代表该主张的解释、推理或科研结论已被系统确认。
        </p>
        {question.evidence.map((evidence) => (
          <article key={evidence.evidence_span_id}>
            <strong>第 {evidence.page_number} 页</strong>
            <blockquote>“{evidence.quote}”</blockquote>
            <p className="guided-learning-meta">
              稳定位置：字符 {evidence.char_start}–{evidence.char_end} · profile{" "}
              {evidence.extraction_profile_version} · 页面哈希{" "}
              {evidence.page_text_sha256.slice(0, 12)}…
            </p>
            <p
              className={
                evidence.verification_status === "VERIFIED"
                  ? "guided-learning-success"
                  : "guided-learning-error"
              }
            >
              验证状态：
              {evidence.verification_status === "VERIFIED"
                ? "已验证"
                : "不可确认"}
            </p>
            <button
              type="button"
              aria-pressed={props.pdfPage === evidence.page_number}
              onClick={() => props.onEvidencePage(evidence.page_number)}
            >
              查看第 {evidence.page_number} 页
            </button>
          </article>
        ))}
      </div>
      <label className="guided-learning-form">
        修改当前回答
        <textarea
          aria-label="Edit guided answer"
          value={props.answerDraft}
          onChange={(event) => props.setAnswerDraft(event.target.value)}
        />
      </label>
      <div className="guided-learning-actions">
        <button
          type="button"
          disabled={props.pendingAction !== null}
          onClick={props.editAnswer}
        >
          保存修改并重新生成点评
        </button>
        <button
          className="guided-learning-primary"
          type="button"
          disabled={props.pendingAction !== null}
          onClick={props.confirmAndAdvance}
        >
          确认并进入下一题
        </button>
      </div>
    </div>
  );
}

function SummaryPanel({
  summary,
}: {
  summary: NonNullable<GuidedLearningSession["stage_summary"]>;
}) {
  return (
    <div
      className="guided-learning-card guided-learning-success"
      data-testid="guided-summary-panel"
    >
      <h2>理解内容阶段已完成</h2>
      <h3>已掌握要点</h3>
      <ul>
        {summary.key_mastery_points.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>主要薄弱点</h3>
      <ul>
        {summary.major_weak_points.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>已完成题号：{summary.completed_question_orders.join(", ") || "无"}</p>
      <p>跳过题号：{summary.skipped_question_orders.join(", ") || "无"}</p>
      <p>
        <strong>下一步建议：</strong>
        {summary.next_stage_hint}
      </p>
      <p className="guided-learning-meta">分析评价、迁移应用仍未开放。</p>
    </div>
  );
}

function findCurrentQuestion(session: GuidedLearningSession | null) {
  if (!session?.questions) return undefined;
  return session.questions.find(
    (question) => question.order === session.current_question_order,
  );
}

function isFeedbackQuestion(
  question: GuidedLearningQuestion,
): question is FeedbackQuestion {
  return (
    question.status === "FEEDBACK_READY" || question.status === "CONFIRMED"
  );
}

function waitingText(state: GuidedLearningSession["state"]): string | null {
  switch (state) {
    case "CREATED":
      return "正在分析论文并生成学习方向……";
    case "QUESTIONS_GENERATING":
      return "正在生成学习问题……";
    case "ANSWER_SUBMITTED":
      return "正在生成点评和参考答案……";
    case "SUMMARY_GENERATING":
      return "正在生成阶段总结……";
    default:
      return null;
  }
}

function readSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("guidedSession");
}

function writeSessionUrl(sessionId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("guidedSession", sessionId);
  window.history.replaceState({}, "", url);
}

function clearSessionUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("guidedSession");
  window.history.replaceState({}, "", url);
}

function toUserMessage(reason: unknown): string {
  if (reason instanceof GuidedLearningApiError) return reason.message;
  return "请求未完成，请检查本地 API 和 Worker 状态后重试。";
}
