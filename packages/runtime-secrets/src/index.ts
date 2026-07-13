import { randomUUID } from "node:crypto";

import type { RuntimeSecretRef } from "../../contracts/dist/wave1/src/index.js";

export class RuntimeSecretError extends Error {
  constructor(
    readonly code: "INVALID_SECRET" | "SECRET_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "RuntimeSecretError";
  }
}

export interface SecretResolver {
  resolve(reference: RuntimeSecretRef): string;
}

export class SessionMemorySecretStore {
  readonly #secrets = new Map<string, string>();

  constructor(
    private readonly createHandle: () => string = () =>
      `secret_session_${randomUUID().replaceAll("-", "")}`,
  ) {}

  put(apiKey: string): string {
    const normalized = normalizeSecret(apiKey);
    const handle = this.createHandle();
    if (!/^secret_session_[A-Za-z0-9_-]+$/.test(handle)) {
      throw new RuntimeSecretError(
        "INVALID_SECRET",
        "Session secret handle does not satisfy the runtime contract.",
      );
    }
    this.#secrets.set(handle, normalized);
    return handle;
  }

  resolve(handle: string): string {
    const secret = this.#secrets.get(handle);
    if (secret === undefined) {
      throw new RuntimeSecretError(
        "SECRET_NOT_FOUND",
        "Session API key is unavailable; enter it again for this application session.",
      );
    }
    return secret;
  }

  delete(handle: string): boolean {
    return this.#secrets.delete(handle);
  }

  clear(): void {
    this.#secrets.clear();
  }
}

export class RuntimeSecretResolver implements SecretResolver {
  constructor(
    private readonly sessionSecrets: SessionMemorySecretStore,
    private readonly environment: Readonly<
      Record<string, string | undefined>
    > = process.env,
  ) {}

  resolve(reference: RuntimeSecretRef): string {
    if (reference.kind === "SESSION_MEMORY") {
      return this.sessionSecrets.resolve(reference.handle);
    }

    const secret = this.environment[reference.name];
    if (secret === undefined) {
      throw new RuntimeSecretError(
        "SECRET_NOT_FOUND",
        `Environment API key ${reference.name} is unavailable.`,
      );
    }
    return normalizeSecret(secret);
  }
}

function normalizeSecret(secret: string): string {
  const normalized = secret.trim();
  if (normalized.length === 0) {
    throw new RuntimeSecretError(
      "INVALID_SECRET",
      "API key must not be empty.",
    );
  }
  return normalized;
}
