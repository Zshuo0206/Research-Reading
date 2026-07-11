# Dependency Policy

- 依赖必须有明确用途、许可证/来源和维护责任人。
- 依赖清单、lockfile 和版本升级由平台/QA owner 统一维护。
- 子 Agent 不得自行新增、删除或升级依赖；发现需要时提交 RFC。
- CI 必须执行 lockfile 一致性、已知漏洞和许可证检查；工具不可用时要报告为未通过，而不是静默跳过。
- 密钥、token 和本地环境文件不得进入仓库；只提交 `.env.example`。
