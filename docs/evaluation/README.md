# Wave 1 Evaluation and QA Baseline

评测资料只提交 manifest、人工参考和 Mock 输入；没有获得许可的论文 PDF、用户研究数据或完整模型 prompt 不进入仓库。

## 固定字段

`evaluation-manifest.v1` 要求每个样本记录来源 URL、获取时间、发布方/仓库、SPDX 许可标识、许可证据 URL、原始二进制 SHA-256、页数、提取 profile 和用途。`redistribution_allowed` 在当前仓库 fixture 中固定为 `false`，表示仓库只保存脱敏元数据；实际受许可文件由本地人工验收者按 manifest 外部提供。

人工参考必须包含：问题文本及确认状态、回答文本、断言类型、回答确认/验证状态、每个 Evidence 的页码、Unicode code-point 右开区间、精确 quote 和 canonical page text SHA-256。不可回答样本必须为空回答/证据并填写拒答理由。

样本类别固定覆盖 `TEXT_PDF`、`TWO_COLUMN_PDF`、`SCANNED_NEGATIVE` 和 `UNANSWERABLE`。Mock 评测必须固定 seed/fixture，报告 Schema 有效率、证据验证结果、拒答和状态迁移；这些是 QA 证据，不冒充真实模型效果或 CI 通过项。
