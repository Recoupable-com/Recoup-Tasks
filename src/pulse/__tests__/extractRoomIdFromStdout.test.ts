import { describe, it, expect } from "vitest";
import { extractRoomIdFromStdout } from "../extractRoomIdFromStdout";

describe("extractRoomIdFromStdout", () => {
  it("extracts room ID from stdout containing PULSE_ROOM_ID marker", () => {
    const stdout = "Some agent output...\nPULSE_ROOM_ID:abc-123-def\nMore output";
    expect(extractRoomIdFromStdout(stdout)).toBe("abc-123-def");
  });

  it("extracts UUID-style room ID", () => {
    const stdout = "PULSE_ROOM_ID:550e8400-e29b-41d4-a716-446655440000";
    expect(extractRoomIdFromStdout(stdout)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns null when no marker is present", () => {
    const stdout = "Some agent output without a room ID";
    expect(extractRoomIdFromStdout(stdout)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractRoomIdFromStdout("")).toBeNull();
  });

  it("extracts first match when multiple markers exist", () => {
    const stdout = "PULSE_ROOM_ID:first-id\nPULSE_ROOM_ID:second-id";
    expect(extractRoomIdFromStdout(stdout)).toBe("first-id");
  });
});
