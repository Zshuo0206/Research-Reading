import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { ByokConnectionTestApi } from "../../../apps/api/src/byok/connection-test.js";
import type { ModelGatewayRequest } from "../../../packages/contracts/wave1/src/index.js";
import { OpenAICompatibleByokGateway } from "../../../packages/model-gateway/src/index.js";
import {
  RuntimeSecretError,
  RuntimeSecretResolver,
  SessionMemorySecretStore,
} from "../../../packages/runtime-secrets/src/index.js";

const providerConfig = {
  provider: "CUSTOM_OPENAI_COMPATIBLE",
  base_url: "https://models.example.invalid/v1",
  model: "local-test-model",
  request_timeout_ms: 1_000,
  max_input_characters: 10_000,
  max_output_tokens: 100,
} as const;

describe("runtime BYOK secrets", () => {
  it("resolves ENVIRONMENT and SESSION_MEMORY references and supports clearing", () => {
    const sessions = new SessionMemorySecretStore(
      () => "secret_session_test_handle",
    );
    const resolver = new RuntimeSecretResolver(sessions, {
      TEST_ENV_TOKEN: " environment.test/token ",
    });
    const handle = sessions.put(" session.test/token ");

    expect(
      resolver.resolve({ kind: "ENVIRONMENT", name: "TEST_ENV_TOKEN" }),
    ).toBe("environment.test/token");
    expect(resolver.resolve({ kind: "SESSION_MEMORY", handle })).toBe(
      "session.test/token",
    );
    expect(sessions.delete(handle)).toBe(true);
    expect(() =>
      resolver.resolve({ kind: "SESSION_MEMORY", handle }),
    ).toThrowError(RuntimeSecretError);
  });

  it("keeps the session key out of API results and SQLite bytes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "byok-non-persistence-"));
    const filename = join(directory, "settings.sqlite");
    const runtimeToken = "memory.test/credential-value";
    try {
      const sessions = new SessionMemorySecretStore(
        () => "secret_session_connection_test",
      );
      const resolver = new RuntimeSecretResolver(sessions, {});
      const gateway = new OpenAICompatibleByokGateway(
        resolver,
        async () => new Response("ok", { status: 200 }),
      );
      const api = new ByokConnectionTestApi(
        gateway,
        sessions,
        (() => {
          let tick = 10;
          return () => (tick += 5);
        })(),
      );
      const registration = api.registerSessionKey(runtimeToken);
      const request = {
        schema_version: "model-gateway.v1",
        message_kind: "REQUEST",
        operation: "CONNECTION_TEST",
        provider_config: providerConfig,
        runtime_secret_ref: {
          kind: "SESSION_MEMORY",
          handle: registration.secret_handle,
        },
        input: { probe: true },
      } satisfies ModelGatewayRequest;

      const result = await api.testConnection(request);
      expect(result).toMatchObject({
        status_code: 200,
        latency_ms: 5,
        body: { output: { success: true } },
      });
      expect(JSON.stringify({ registration, result })).not.toContain(
        runtimeToken,
      );

      const database = new DatabaseSync(filename);
      database.exec(
        "CREATE TABLE model_settings (provider TEXT, base_url TEXT, model TEXT)",
      );
      database
        .prepare("INSERT INTO model_settings VALUES (?, ?, ?)")
        .run(
          providerConfig.provider,
          providerConfig.base_url,
          providerConfig.model,
        );
      database.close();

      expect(readFileSync(filename).includes(Buffer.from(runtimeToken))).toBe(
        false,
      );
      expect(
        readFileSync(filename).includes(
          Buffer.from(registration.secret_handle),
        ),
      ).toBe(false);
      expect(api.clearSessionKey(registration.secret_handle)).toEqual({
        cleared: true,
      });
      await expect(api.testConnection(request)).resolves.toMatchObject({
        body: {
          output: { success: false, error_category: "AUTHENTICATION" },
        },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
