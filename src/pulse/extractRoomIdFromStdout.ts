/**
 * Extracts a room ID from sandbox agent stdout by looking for the PULSE_ROOM_ID marker.
 *
 * @param stdout - The raw stdout from the sandbox command
 * @returns The room ID or null if not found
 */
export function extractRoomIdFromStdout(stdout: string): string | null {
  const match = stdout.match(/PULSE_ROOM_ID:(\S+)/);
  return match ? match[1] : null;
}
