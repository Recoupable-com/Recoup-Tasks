import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  tags: { add: vi.fn() },
  schedules: {
    task: (config: { run: unknown }) => {
      mockRun.mockImplementation(config.run as (...args: unknown[]) => unknown);
      return config;
    },
  },
}));

const mockFetchTask = vi.fn();
vi.mock("../../recoup/fetchTask", () => ({ fetchTask: (...a: unknown[]) => mockFetchTask(...a) }));
const mockGetTaskRoomId = vi.fn();
vi.mock("../../chats/getTaskRoomId", () => ({ getTaskRoomId: (...a: unknown[]) => mockGetTaskRoomId(...a) }));
const mockGenerateChat = vi.fn();
vi.mock("../../recoup/generateChat", () => ({ generateChat: (...a: unknown[]) => mockGenerateChat(...a) }));

// real chatSchema is used
import "../customerPromptTask";

const payload = { timestamp: new Date(0), timezone: "UTC", externalId: "ext-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTaskRoomId.mockResolvedValue("room-1");
  mockGenerateChat.mockResolvedValue(undefined);
});

describe("customerPromptTask model default", () => {
  it("defaults the model to moonshotai/kimi-k3 when the task config omits it", async () => {
    mockFetchTask.mockResolvedValue({ accountId: "acc-1", artistId: "art-1", prompt: "do a thing" });
    await mockRun(payload);
    expect(mockGenerateChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "moonshotai/kimi-k3", accountId: "acc-1" }),
    );
  });

  it("forwards an explicit task model unchanged", async () => {
    mockFetchTask.mockResolvedValue({ accountId: "acc-1", model: "anthropic/claude-opus-4-8", prompt: "x" });
    await mockRun(payload);
    expect(mockGenerateChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "anthropic/claude-opus-4-8" }),
    );
  });
});
