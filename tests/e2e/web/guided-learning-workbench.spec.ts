import { expect, test } from "@playwright/test";
import path from "node:path";

test("covers BYOK controls with a Mock Guided Learning UI flow and restores after refresh", async ({
  page,
}) => {
  let state = "CREATED";
  let revision = 1;
  let order = 1;
  let feedbackPending = false;
  const failedOrders = new Set<number>();
  const questions = [1, 2, 3].map((questionOrder) => ({
    question_id: `guided_question_${questionOrder}`,
    order: questionOrder,
    stage_id: "UNDERSTAND",
    prompt: `论文方法的第 ${questionOrder} 个关键点是什么？`,
    status: questionOrder === 1 ? "ACTIVE" : "UNSEEN",
    confirmation_status: "PENDING",
  }));
  const session = () => ({
    session_id: "learning_web_e2e",
    project_id: "proj_web_e2e",
    document_version_id: "docv_web_e2e",
    mode: "GUIDED_LEARNING",
    learning_goal: "理解论文的方法设计和关键证据",
    state,
    session_revision: revision,
    state_version: revision,
    candidate_directions: [
      {
        direction_id: "direction_method",
        title: "理解方法设计",
        description: "梳理方法的整体框架和关键模块。",
        selection_basis: "与学习目标最直接相关。",
      },
      {
        direction_id: "direction_evidence",
        title: "追踪关键证据",
        description: "沿着论文原文定位支撑结论的证据。",
        selection_basis: "帮助建立可核查的阅读路径。",
      },
    ],
    selected_direction_id:
      state === "CREATED" || state === "AWAITING_DIRECTION_SELECTION"
        ? undefined
        : "direction_method",
    route:
      state === "CREATED" || state === "AWAITING_DIRECTION_SELECTION"
        ? undefined
        : {
            route_id: "route_web_e2e",
            route_version: "guided-route.v1",
            locked: true,
            locked_at: "2026-07-16T00:00:00Z",
            stages: [
              {
                stage_id: "UNDERSTAND",
                order: 1,
                title: "理解内容",
                status: state === "STAGE_COMPLETED" ? "COMPLETED" : "OPEN",
                unlock_condition: "SESSION_DIRECTION_SELECTED",
              },
              {
                stage_id: "ANALYZE",
                order: 2,
                title: "分析评价",
                status: "LOCKED",
                unlock_condition: "NOT_AVAILABLE_IN_V1",
              },
              {
                stage_id: "TRANSFER",
                order: 3,
                title: "迁移应用",
                status: "LOCKED",
                unlock_condition: "NOT_AVAILABLE_IN_V1",
              },
            ],
          },
    current_stage_id: "UNDERSTAND",
    current_question_order:
      state === "SUMMARY_GENERATING" || state === "STAGE_COMPLETED"
        ? undefined
        : order,
    questions,
    stage_summary:
      state === "STAGE_COMPLETED"
        ? {
            stage_id: "UNDERSTAND",
            status: "GENERATED",
            completed_question_orders: [1, 2, 3],
            skipped_question_orders: [],
            key_mastery_points: ["理解了方法的主要步骤。"],
            major_weak_points: ["还可以继续核对实验设置。"],
            next_stage_hint: "后续阶段暂未开放。",
          }
        : undefined,
    failure:
      state === "RETRYABLE_FAILURE"
        ? {
            failure_id: "failure_web_e2e",
            failure_class: "RETRYABLE",
            error_code: "TEMPORARY_UNAVAILABLE",
            message: "Mock Worker 暂时不可用。",
            attempt: 1,
            failed_operation: "GENERATE_FEEDBACK",
            resume_state: "ANSWER_SUBMITTED",
          }
        : undefined,
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
  });

  const completeFeedback = () => {
    const question = questions[order - 1];
    if (!question) return;
    question.status = "FEEDBACK_READY";
    question.confirmation_status = "PENDING";
    Object.assign(question, {
      user_answer: `第 ${order} 题回答`,
      feedback: { summary: "回答抓住了方法的关键连接。", omissions: [] },
      reference_answer: {
        text: "论文通过可追溯的文本处理支撑方法解释。",
        claims: [
          {
            text: "方法由论文原文证据支持。",
            claim_type: "PAPER_FACT",
            evidence_refs: [`evidence_${order}`],
          },
        ],
      },
      evidence: [
        {
          evidence_span_id: `evidence_${order}`,
          document_version_id: "docv_web_e2e",
          page_number: order + 4,
          page_text_sha256: "a".repeat(64),
          extraction_profile_version: "pdf-text-v1",
          char_start: 0,
          char_end: 12,
          quote: "Canonical method text.",
          verification_status: "VERIFIED",
        },
      ],
    });
  };

  await page.route("http://127.0.0.1:4310/api/v1/**", async (route) => {
    const request = route.request();
    const corsHeaders = {
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "access-control-allow-headers":
        "accept, content-type, idempotency-key, x-filename, x-request-id",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const url = new URL(request.url());
    const body =
      request.method() === "POST" && !url.pathname.endsWith("/documents")
        ? (request.postDataJSON() as { event?: string } | undefined)
        : undefined;
    let data: unknown;
    if (request.method() === "POST" && url.pathname === "/api/v1/projects") {
      data = { project_id: "proj_web_e2e", name: "Web E2E 项目" };
    } else if (
      request.method() === "POST" &&
      url.pathname.endsWith("/documents")
    ) {
      data = {
        document_id: "doc_web_e2e",
        document_version_id: "docv_web_e2e",
        job_id: "job_pdf_web_e2e",
      };
    } else if (
      request.method() === "GET" &&
      url.pathname === "/api/v1/jobs/job_pdf_web_e2e"
    ) {
      data = {
        job_id: "job_pdf_web_e2e",
        job_type: "DOCUMENT_IMPORT",
        status: "SUCCEEDED",
        related: {
          project_id: "proj_web_e2e",
          document_id: "doc_web_e2e",
          document_version_id: "docv_web_e2e",
          question_id: null,
        },
        error: null,
      };
    } else if (
      request.method() === "POST" &&
      url.pathname === "/api/v1/guided-learning/sessions"
    ) {
      data = { session: session(), job_id: "job_direction_web_e2e" };
    } else if (
      request.method() === "GET" &&
      url.pathname.endsWith("/guided-learning/sessions/learning_web_e2e")
    ) {
      if (state === "CREATED") state = "AWAITING_DIRECTION_SELECTION";
      else if (state === "QUESTIONS_GENERATING") state = "AWAITING_ANSWER";
      else if (state === "ANSWER_SUBMITTED" && feedbackPending) {
        if (!failedOrders.has(order)) {
          state = "RETRYABLE_FAILURE";
          failedOrders.add(order);
        } else {
          completeFeedback();
          state = "FEEDBACK_READY";
        }
      } else if (state === "SUMMARY_GENERATING") state = "STAGE_COMPLETED";
      data = session();
    } else if (
      request.method() === "POST" &&
      url.pathname.endsWith("/commands")
    ) {
      const event = body?.event;
      revision += 1;
      if (event === "SELECT_DIRECTION") state = "ROUTE_LOCKED";
      if (event === "START_STAGE") state = "QUESTIONS_GENERATING";
      if (event === "SUBMIT_ANSWER" || event === "EDIT_ANSWER") {
        state = "ANSWER_SUBMITTED";
        feedbackPending = true;
      }
      if (event === "RETRY") {
        state = "ANSWER_SUBMITTED";
        feedbackPending = true;
      }
      if (event === "CONFIRM_QUESTION") {
        state = "QUESTION_COMPLETED";
        const current = questions[order - 1];
        if (current) {
          current.status = "CONFIRMED";
          current.confirmation_status = "CONFIRMED";
        }
      }
      if (event === "ADVANCE_QUESTION") {
        if (order < 3) {
          order += 1;
          const next = questions[order - 1];
          if (next) next.status = "ACTIVE";
          state = "AWAITING_ANSWER";
        } else state = "SUMMARY_GENERATING";
      }
      data = {
        outcome: "APPLIED",
        transition: {
          from_state: state,
          to_state: state,
          result_revision: revision,
        },
        session: session(),
      };
    } else {
      await route.fulfill({
        status: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "not mocked" }),
        contentType: "application/json",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: "api.v1",
        request_id: "req_web_e2e",
        data,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "引导式学习" }).click();
  await page.getByLabel("Guided project name").fill("Web E2E 项目");
  await page.getByRole("button", { name: "创建项目" }).click();
  await expect(page.getByTestId("guided-project-ready")).toBeVisible();
  await page
    .getByLabel("Guided PDF file")
    .setInputFiles(
      path.join(process.cwd(), "tests/fixtures/pdf/synthetic-text.pdf"),
    );
  await expect(page.getByText("PDF 已就绪")).toBeVisible();
  await page.getByLabel("生成模式").selectOption("BYOK");
  await expect(page.getByText("API key 不在浏览器中显示、输入或发送")).toBeVisible();
  await expect(page.getByRole("button", { name: "测试服务端环境连接" })).toBeVisible();
  await page.getByLabel("生成模式").selectOption("MOCK");
  await page.getByLabel("Learning goal").fill("理解论文的方法设计和关键证据");
  await page
    .getByRole("button", { name: "创建 Guided Learning Session" })
    .click();
  await expect(page.getByText("选择学习方向")).toBeVisible();
  await page.getByRole("button", { name: "选择这个方向" }).first().click();
  await expect(page.getByText("方向已锁定")).toBeVisible();
  await page.getByRole("button", { name: "开始理解内容" }).click();
  await expect(page.getByText("理解阶段 · 第 1 / 3 题")).toBeVisible();

  for (let question = 1; question <= 3; question += 1) {
    await page.getByLabel("Guided answer").fill(`第 ${question} 题回答`);
    await page.getByRole("button", { name: "提交回答" }).click();
    await expect(page.getByTestId("guided-learning-failure")).toBeVisible();
    await page.getByRole("button", { name: "重试生成" }).click();
    await expect(page.getByTestId("guided-feedback-panel")).toBeVisible();
    const evidencePage = question + 4;
    await expect(page.getByText(`第 ${evidencePage} 页`, { exact: true })).toBeVisible();
    await expect(page.getByText("Canonical method text.")).toBeVisible();
    const pdfFrame = page.locator('iframe[title="Imported PDF preview"]');
    await page.getByRole("button", { name: `查看第 ${evidencePage} 页` }).click();
    await expect(pdfFrame).toHaveAttribute(
      "src",
      new RegExp(`#page=${evidencePage}$`),
    );
    await page.getByRole("button", { name: `查看第 ${evidencePage} 页` }).click();
    await expect(pdfFrame).toHaveAttribute(
      "src",
      new RegExp(`#page=${evidencePage}$`),
    );
    expect((await pdfFrame.getAttribute("src"))?.match(/#page=/g)).toHaveLength(1);
    if (question === 1) {
      await page.reload();
      await expect(page.getByTestId("guided-feedback-panel")).toBeVisible();
      await expect(pdfFrame).toHaveAttribute(
        "src",
        /\/api\/v1\/document-versions\/docv_web_e2e\/content$/,
      );
      await page.getByRole("button", { name: `查看第 ${evidencePage} 页` }).click();
      await expect(pdfFrame).toHaveAttribute(
        "src",
        new RegExp(`#page=${evidencePage}$`),
      );
      expect((await pdfFrame.getAttribute("src"))?.match(/#page=/g)).toHaveLength(1);
    }
    await page.getByRole("button", { name: "确认并进入下一题" }).click();
  }

  await expect(page.getByTestId("guided-summary-panel")).toBeVisible();
  await expect(page.getByText("理解内容阶段已完成")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("guided-summary-panel")).toBeVisible();
});
