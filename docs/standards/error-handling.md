# Error Handling Standard

## 统一错误模型

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable safe message",
    "request_id": "req_...",
    "details": []
  }
}
```

错误码必须稳定、可检索；`details` 不得包含 secrets、堆栈或未经脱敏的第三方响应。

## 分类

- `VALIDATION_ERROR`：客户端修复输入。
- `NOT_FOUND`：资源不存在或不可见。
- `CONFLICT`：并发版本冲突或幂等键冲突。
- `DEPENDENCY_UNAVAILABLE`：外部服务不可用，可重试。
- `TIMEOUT`：达到超时边界，可按策略重试。
- `INTERNAL_ERROR`：记录关联 ID，用户只见安全提示。

部分失败必须显式返回每个子项状态；不得把部分成功伪装成整体成功。
