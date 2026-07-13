import type { Wave1ModelGatewayRequestResponseContract } from "../../../../packages/contracts/wave1/generated/model-gateway.v1.d.ts";

type ConnectionTestRequest = Extract<
  Wave1ModelGatewayRequestResponseContract,
  {
    message_kind: "REQUEST";
    operation: "CONNECTION_TEST";
    runtime_secret_ref: unknown;
  }
>;
type ConnectionTestResponse = Extract<
  Wave1ModelGatewayRequestResponseContract,
  { message_kind: "RESPONSE"; operation: "CONNECTION_TEST" }
>;

export interface ConnectionTestGateway {
  invoke(
    request: ConnectionTestRequest,
  ): Promise<Wave1ModelGatewayRequestResponseContract>;
}

export interface SessionKeyStore {
  put(apiKey: string): string;
  delete(handle: string): boolean;
}

export interface ConnectionTestApiResult {
  status_code: 200;
  latency_ms: number;
  body: ConnectionTestResponse;
}

export class ByokConnectionTestApi {
  constructor(
    private readonly gateway: ConnectionTestGateway,
    private readonly sessionKeys: SessionKeyStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  registerSessionKey(apiKey: string): { secret_handle: string } {
    return { secret_handle: this.sessionKeys.put(apiKey) };
  }

  clearSessionKey(handle: string): { cleared: boolean } {
    return { cleared: this.sessionKeys.delete(handle) };
  }

  async testConnection(
    request: ConnectionTestRequest,
  ): Promise<ConnectionTestApiResult> {
    const startedAt = this.now();
    const body = await this.gateway.invoke(request);
    if (
      body.message_kind !== "RESPONSE" ||
      body.operation !== "CONNECTION_TEST"
    ) {
      throw new Error(
        "Connection test gateway returned an unexpected envelope.",
      );
    }
    return {
      status_code: 200,
      latency_ms: Math.max(0, this.now() - startedAt),
      body,
    };
  }
}

export type { ConnectionTestRequest, ConnectionTestResponse };
