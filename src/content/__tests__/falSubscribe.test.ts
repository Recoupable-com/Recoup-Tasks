import { describe, it, expect, vi, beforeEach } from "vitest";
import { falSubscribe } from "../falSubscribe";

const mockSubscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({
  fal: { subscribe: (...args: unknown[]) => mockSubscribe(...args) },
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { error: vi.fn() },
}));

describe("falSubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fal result on success", async () => {
    const expected = { data: { images: [{ url: "fal://img.png" }] } };
    mockSubscribe.mockResolvedValue(expected);

    const result = await falSubscribe("fal-ai/some-model", { prompt: "test" });
    expect(result).toBe(expected);
    expect(mockSubscribe).toHaveBeenCalledWith("fal-ai/some-model", {
      input: { prompt: "test" },
      logs: true,
    });
  });

  it("logs error details and rethrows on failure", async () => {
    const falError = Object.assign(new Error("Unprocessable Entity"), {
      status: 422,
      body: { detail: "bad input" },
    });
    mockSubscribe.mockRejectedValue(falError);

    const { logger } = await import("@trigger.dev/sdk/v3");

    await expect(
      falSubscribe("fal-ai/some-model", { prompt: "test" }),
    ).rejects.toThrow("Unprocessable Entity");

    expect(logger.error).toHaveBeenCalledWith(
      "fal.ai request failed",
      expect.objectContaining({
        model: "fal-ai/some-model",
        status: 422,
        message: "Unprocessable Entity",
      }),
    );
  });

  it("handles circular error objects safely", async () => {
    const circular: Record<string, unknown> = { message: "fail" };
    circular.self = circular;
    mockSubscribe.mockRejectedValue(circular);

    await expect(
      falSubscribe("fal-ai/some-model", { prompt: "test" }),
    ).rejects.toBe(circular);
  });
});
