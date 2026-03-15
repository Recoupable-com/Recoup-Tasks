import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGitHubAuthPrefix } from "../getGitHubAuthPrefix";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test123";
});

describe("getGitHubAuthPrefix", () => {
  it("returns the auth URL prefix when GITHUB_TOKEN is set", () => {
    const result = getGitHubAuthPrefix();

    expect(result).toBe("https://x-access-token:ghp_test123@github.com/");
  });

  it("returns null when GITHUB_TOKEN is missing", () => {
    delete process.env.GITHUB_TOKEN;

    const result = getGitHubAuthPrefix();

    expect(result).toBeNull();
  });

  it("returns null when GITHUB_TOKEN is empty string", () => {
    process.env.GITHUB_TOKEN = "";

    const result = getGitHubAuthPrefix();

    expect(result).toBeNull();
  });
});
