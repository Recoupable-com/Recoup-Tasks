import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSandboxEnv } from "../getSandboxEnv";

describe("getSandboxEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RECOUP_API_KEY = "test-api-key";
    process.env.GITHUB_TOKEN = "test-github-token";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns RECOUP_API_KEY, RECOUP_ACCOUNT_ID, and GITHUB_TOKEN", () => {
    const env = getSandboxEnv("acc_123");

    expect(env).toEqual({
      RECOUP_API_KEY: "test-api-key",
      RECOUP_ACCOUNT_ID: "acc_123",
      GITHUB_TOKEN: "test-github-token",
    });
  });

  it("omits GITHUB_TOKEN when not set", () => {
    delete process.env.GITHUB_TOKEN;

    const env = getSandboxEnv("acc_123");

    expect(env).toEqual({
      RECOUP_API_KEY: "test-api-key",
      RECOUP_ACCOUNT_ID: "acc_123",
    });
    expect(env).not.toHaveProperty("GITHUB_TOKEN");
  });

  it("throws when RECOUP_API_KEY is missing", () => {
    delete process.env.RECOUP_API_KEY;

    expect(() => getSandboxEnv("acc_123")).toThrow("RECOUP_API_KEY");
  });
});
