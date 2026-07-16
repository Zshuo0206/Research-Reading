import type {
  GuidedLearningCandidateDirection,
  GuidedLearningFeedback,
  GuidedLearningReferenceAnswer,
  GuidedLearningStageSummary,
} from "../../../../packages/contracts/dist/wave1/src/index.js";

type MockRecord = Record<string, unknown>;

export class GuidedLearningMockAdapter {
  directions(): GuidedLearningCandidateDirection[] {
    return [
      {
        direction_id: "direction_method",
        title: "理解方法设计",
        description: "梳理论文方法的整体框架和关键模块。",
        selection_basis: "与学习目标最直接相关。",
      },
      {
        direction_id: "direction_evidence",
        title: "理解证据链",
        description: "理解实验如何支持论文的主要结论。",
        selection_basis: "帮助把方法主张和论文证据对应起来。",
      },
    ];
  }

  questions(): MockRecord[] {
    return [1, 2, 3].map((order) => ({
      question_id: `question_mock_${order}`,
      order,
      stage_id: "UNDERSTAND",
      prompt: `请说明论文方法的第 ${order} 个关键环节及其作用。`,
      status: "UNSEEN",
      confirmation_status: "PENDING",
    }));
  }

  feedback(): {
    feedback: GuidedLearningFeedback;
    reference_answer: GuidedLearningReferenceAnswer;
    evidence: MockRecord[];
  } {
    return {
      feedback: { summary: "回答抓住了方法的核心逻辑。", omissions: [] },
      reference_answer: {
        text: "论文通过模块化方法组织研究流程，并以证据支持关键主张。",
        claims: [
          {
            text: "论文方法包含一个清晰的研究流程。",
            claim_type: "PAPER_FACT",
            evidence_refs: ["evidence_mock_1"],
          },
        ],
      },
      evidence: [
        {
          evidence_span_id: "evidence_mock_1",
          context_span_id: "context_mock_1",
          document_version_id: "__DOCUMENT_VERSION__",
          page_number: 1,
          page_text_sha256: "mock-page-hash",
          extraction_profile_version: "mock-v1",
          char_start: 0,
          char_end: 10,
          quote: "论文方法流程",
          verification_status: "VERIFIED",
        },
      ],
    };
  }

  summary(): GuidedLearningStageSummary {
    return {
      stage_id: "UNDERSTAND",
      status: "GENERATED",
      completed_question_orders: [1, 2, 3],
      skipped_question_orders: [],
      key_mastery_points: ["掌握方法流程"],
      major_weak_points: [],
      next_stage_hint: "下一阶段可继续分析方法的适用边界。",
    };
  }
}
