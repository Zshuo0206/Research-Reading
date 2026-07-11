# Ownership Policy

## 唯一 owner 原则

每个 Wave 必须有一份 ownership map。owner 对其可写路径的内容、测试和交接负责；其他 Agent 默认只读。

## 固定责任域

- 公共契约：架构/契约 Agent；
- 数据库迁移：后端领域 owner；
- 依赖清单与 CI：平台/QA owner；
- 前端：前端 owner；
- 后端领域：后端 owner；
- 文档治理：主控 Agent，必要时指定唯一文档 owner。

## 交叉修改

需要修改其他 owner 路径时，先停止实现，提交 RFC 或请求主控重新分配 ownership。不得以“顺手修复”为由跨边界修改。
