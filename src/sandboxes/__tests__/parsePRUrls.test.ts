import { describe, it, expect } from "vitest";
import { parsePRUrls } from "../parsePRUrls";

describe("parsePRUrls", () => {
  it("parses multiple PR_CREATED lines", () => {
    const stdout = [
      "Some log output",
      "PR_CREATED: https://github.com/recoupable/recoup-api/pull/42",
      "More log output",
      "PR_CREATED: https://github.com/recoupable/chat/pull/7",
      "",
    ].join("\n");

    const result = parsePRUrls(stdout);

    expect(result).toEqual([
      {
        repo: "recoupable/recoup-api",
        number: 42,
        url: "https://github.com/recoupable/recoup-api/pull/42",
        baseBranch: "test",
      },
      {
        repo: "recoupable/chat",
        number: 7,
        url: "https://github.com/recoupable/chat/pull/7",
        baseBranch: "test",
      },
    ]);
  });

  it("returns empty array when no PR_CREATED lines are present", () => {
    const stdout = "Just some normal output\nNo PRs here\n";
    expect(parsePRUrls(stdout)).toEqual([]);
  });

  it("ignores malformed PR_CREATED lines", () => {
    const stdout = [
      "PR_CREATED: not-a-url",
      "PR_CREATED: https://github.com/recoupable/tasks/pull/10",
      "PR_CREATED:",
      "PR_CREATED: https://example.com/pull/1",
    ].join("\n");

    const result = parsePRUrls(stdout);

    expect(result).toEqual([
      {
        repo: "recoupable/tasks",
        number: 10,
        url: "https://github.com/recoupable/tasks/pull/10",
        baseBranch: "main",
      },
    ]);
  });

  it("defaults baseBranch to main for unknown repos", () => {
    const stdout = "PR_CREATED: https://github.com/recoupable/unknown-repo/pull/1\n";
    const result = parsePRUrls(stdout);

    expect(result).toEqual([
      {
        repo: "recoupable/unknown-repo",
        number: 1,
        url: "https://github.com/recoupable/unknown-repo/pull/1",
        baseBranch: "main",
      },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parsePRUrls("")).toEqual([]);
  });
});
