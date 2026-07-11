# Wave 1 QA 复核清单

- [ ] 任务声明的写路径与实现路径隔离，QA 不修改 `apps/**` 或 `packages/**`。
- [ ] 每个 manifest 样本都有来源、许可、hash、页数、profile 和用途。
- [ ] fixture 不含真实密钥、token、用户数据或未获许可的论文正文。
- [ ] Schema 缺版本、非法状态、非法 Evidence、无证据事实性回答和模型 offset 均失败。
- [ ] Question/Answer revision、review_status、verification_status 和 Job 迁移与 `wave1.v1` 一致。
- [ ] Mock 结果可重复；真实外部模型调用不进入普通 CI。
- [ ] 真实 BYOK 调用仅作为人工验收，记录 provider/model、发送边界和脱敏证据，不记录密钥或原文。
- [ ] 未执行项、失败项和批准例外单独记录，不将缺少论文 PDF 伪装为通过。
