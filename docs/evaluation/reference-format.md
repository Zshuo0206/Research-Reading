# 人工参考格式

人工标注以 manifest 的 `reference` 对象为准：

- `answerability`：`ANSWERABLE` 或 `UNANSWERABLE`；不可回答必须填写 `rejection_reason`。
- `questions`：`question_id`、问题文本、`review_status=CONFIRMED`。
- `answers`：问题 ID、回答文本、断言类型集合、`review_status=CONFIRMED`、`verification_status=VERIFIED`。
- `evidence`：页码、`char_start`/`char_end`（Unicode code points，右开）、canonical 文本精确 quote、canonical 文本 UTF-8 SHA-256。

人工审阅需记录修改后内容是否被接受、拒绝原因和审阅者/时间；不要复制论文全文或原始模型响应。
