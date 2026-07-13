import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AssertionType,
  JobState,
  Provider,
  ReviewStatus,
  VerificationStatus,
} from "../../../packages/contracts/wave1/src/index.js";

type JobKind = "DOCUMENT_IMPORT" | "QUESTION_PLAN" | "ANSWER_GENERATION";
type JobView = { kind: JobKind; state: JobState; message: string };

const providerOptions: Array<{ value: Provider; label: string }> = [
  { value: "MOCK", label: "Deterministic Mock" },
  { value: "OPENAI", label: "OpenAI" },
  { value: "GEMINI", label: "Gemini" },
  { value: "GROQ", label: "Groq" },
  { value: "OPENROUTER", label: "OpenRouter" },
  { value: "CUSTOM_OPENAI_COMPATIBLE", label: "Custom OpenAI-compatible" },
];

const initialQuestion = "What preprocessing steps were used in the method?";
const initialAnswer =
  "The method applies normalization before the reported evaluation.";

function Status({ children }: { children: string }) {
  return <span className="status">{children}</span>;
}

function Workbench() {
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [provider, setProvider] = useState<Provider>("MOCK");
  const [apiKey, setApiKey] = useState("");
  const [connection, setConnection] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [question, setQuestion] = useState(initialQuestion);
  const [questionStatus, setQuestionStatus] = useState<ReviewStatus>("DRAFT");
  const [answer, setAnswer] = useState(initialAnswer);
  const [answerStatus, setAnswerStatus] = useState<ReviewStatus>("DRAFT");
  const [answerVerification, setAnswerVerification] =
    useState<VerificationStatus>("VERIFIED");

  const runJob = (kind: JobKind, complete: () => void) => {
    setJob({ kind, state: "RUNNING", message: "Processing locally…" });
    window.setTimeout(() => {
      complete();
      setJob({ kind, state: "SUCCEEDED", message: "Completed." });
    }, 250);
  };

  const createProject = () => {
    if (!projectName.trim()) return;
    setProjectId("proj_local_demo");
  };

  const uploadPdf = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setFileName(null);
      setUploadError(
        "Choose a text PDF file. The selected file was not accepted.",
      );
      setJob({
        kind: "DOCUMENT_IMPORT",
        state: "FAILED",
        message: "Unsupported input.",
      });
      return;
    }
    setFileName(file.name);
    runJob("DOCUMENT_IMPORT", () => undefined);
  };

  const testConnection = () => {
    if (provider !== "MOCK" && !apiKey.trim()) {
      setConnection("error");
      return;
    }
    setConnection("testing");
    window.setTimeout(() => setConnection("ok"), 200);
  };

  const generateQuestions = () => {
    if (!fileName) {
      setUploadError("Upload a text PDF before generating questions.");
      return;
    }
    runJob("QUESTION_PLAN", () => setQuestionStatus("DRAFT"));
  };

  const generateAnswer = () => {
    if (questionStatus !== "CONFIRMED") return;
    runJob("ANSWER_GENERATION", () => {
      setAnswerStatus("DRAFT");
      setAnswerVerification("VERIFIED");
    });
  };

  return (
    <main>
      <header>
        <h1>Research Reading</h1>
        <p>Method-learning workbench · local, single-user session</p>
      </header>

      <p className="notice" data-testid="local-mode-notice">
        This screen uses local UI state until the Wave 1 workflow API is
        connected. API keys stay only in this browser session and are never
        displayed after input.
      </p>

      <section aria-labelledby="project-heading">
        <h2 id="project-heading">1. Create project</h2>
        <label>
          Project name
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="e.g. Replication notes"
          />
        </label>
        <button
          type="button"
          onClick={createProject}
          disabled={!projectName.trim()}
        >
          Create project
        </button>
        {projectId ? (
          <p data-testid="project-created">
            Project created: <code>{projectId}</code>
          </p>
        ) : (
          <p>Give this reading session a project name.</p>
        )}
      </section>

      <section aria-labelledby="document-heading">
        <h2 id="document-heading">2. Import text PDF</h2>
        <label>
          PDF file
          <input
            aria-label="PDF file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => uploadPdf(event.target.files?.[0])}
          />
        </label>
        {fileName && <p data-testid="document-name">Selected: {fileName}</p>}
        {uploadError && <p role="alert">{uploadError}</p>}
      </section>

      <section aria-labelledby="model-heading">
        <h2 id="model-heading">3. Model settings</h2>
        <label>
          Provider
          <select
            aria-label="Provider"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as Provider);
              setConnection("idle");
            }}
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {provider !== "MOCK" && (
          <label>
            Temporary API key
            <input
              aria-label="Temporary API key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setConnection("idle");
              }}
            />
          </label>
        )}
        <button
          type="button"
          onClick={testConnection}
          disabled={connection === "testing"}
        >
          Test connection
        </button>
        {connection === "testing" && <p role="status">Testing connection…</p>}
        {connection === "ok" && <p role="status">Connection test succeeded.</p>}
        {connection === "error" && (
          <p role="alert">
            Enter a temporary API key before testing this provider.
          </p>
        )}
      </section>

      <section aria-labelledby="question-heading">
        <h2 id="question-heading">4. Review question</h2>
        <button
          type="button"
          onClick={generateQuestions}
          disabled={!fileName || job?.state === "RUNNING"}
        >
          Generate method-learning question
        </button>
        <label>
          Question revision
          <textarea
            aria-label="Question revision"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setQuestionStatus("DRAFT");
            }}
          />
        </label>
        <p>
          Review status: <Status>{questionStatus}</Status> · verification:{" "}
          <Status>NOT_REQUIRED</Status>
        </p>
        <button
          type="button"
          onClick={() => setQuestionStatus("CONFIRMED")}
          disabled={!question.trim()}
        >
          Confirm question
        </button>
        <button type="button" onClick={() => setQuestionStatus("REJECTED")}>
          Reject question
        </button>
      </section>

      <section aria-labelledby="answer-heading">
        <h2 id="answer-heading">5. Review answer and evidence</h2>
        <button
          type="button"
          onClick={generateAnswer}
          disabled={questionStatus !== "CONFIRMED" || job?.state === "RUNNING"}
        >
          Generate answer
        </button>
        <label>
          Answer revision
          <textarea
            aria-label="Answer revision"
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setAnswerStatus("DRAFT");
            }}
          />
        </label>
        <p>
          Review status: <Status>{answerStatus}</Status> · verification:{" "}
          <Status>{answerVerification}</Status>
        </p>
        <article aria-label="Evidence span">
          <h3>Evidence</h3>
          <p>“normalization before the reported evaluation”</p>
          <p>
            Page 1 · characters [0, 44) · <Status>VERIFIED</Status>
          </p>
        </article>
        <label>
          Assertion type
          <select aria-label="Assertion type" defaultValue="PAPER_FACT">
            {(
              [
                "PAPER_FACT",
                "AUTHOR_CLAIM",
                "AGENT_INFERENCE",
                "INSUFFICIENT_EVIDENCE",
              ] as AssertionType[]
            ).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setAnswerStatus("CONFIRMED")}
          disabled={!answer.trim()}
        >
          Confirm answer
        </button>
        <button
          type="button"
          onClick={() => {
            setAnswerStatus("REJECTED");
            setAnswerVerification("INVALID");
          }}
        >
          Reject answer
        </button>
      </section>

      <section aria-label="Job status" data-testid="job-status">
        <h2>Job status</h2>
        {job ? (
          <p>
            {job.kind}: <Status>{job.state}</Status> — {job.message}
          </p>
        ) : (
          <p>No jobs have started.</p>
        )}
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Web shell root element is missing");

createRoot(root).render(
  <StrictMode>
    <Workbench />
  </StrictMode>,
);
