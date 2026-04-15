import { describe, it, expect } from "vitest";
import { appendNoCommitInstruction, NO_COMMIT_INSTRUCTION } from "../appendNoCommitInstruction";

describe("appendNoCommitInstruction", () => {
  it("appends the instruction to the value after --message", () => {
    const result = appendNoCommitInstruction([
      "agent",
      "--agent",
      "main",
      "--message",
      "fix the bug",
    ]);

    expect(result).toEqual([
      "agent",
      "--agent",
      "main",
      "--message",
      `fix the bug ${NO_COMMIT_INSTRUCTION}`,
    ]);
  });

  it("is idempotent — does not re-append when the instruction is already present", () => {
    const original = [
      "agent",
      "--message",
      `do something ${NO_COMMIT_INSTRUCTION}`,
    ];

    expect(appendNoCommitInstruction(original)).toEqual(original);
  });

  it("leaves args unchanged when there is no --message flag", () => {
    const original = ["status"];
    expect(appendNoCommitInstruction(original)).toEqual(original);
  });

  it("leaves args unchanged when --message is the last arg (no value)", () => {
    const original = ["agent", "--message"];
    expect(appendNoCommitInstruction(original)).toEqual(original);
  });

  it("returns a new array rather than mutating the input", () => {
    const original = ["--message", "hi"];
    const result = appendNoCommitInstruction(original);
    expect(result).not.toBe(original);
    expect(original).toEqual(["--message", "hi"]);
  });
});
