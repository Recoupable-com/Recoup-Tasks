import { logger } from "@trigger.dev/sdk/v3";
import { createChat } from "../recoup/createChat";

type GetTaskRoomIdParams = {
  roomId?: string;
  artistId?: string;
  accountId?: string;
  topic?: string;
};

/**
 * Gets the room ID for a task, creating a new chat room if none provided.
 *
 * @param params - Parameters containing optional roomId and artistId
 * @returns The room ID, or undefined if creation fails
 */
export async function getTaskRoomId(
  params: GetTaskRoomIdParams
): Promise<string | undefined> {
  if (params.roomId) {
    logger.log("Using existing roomId", { roomId: params.roomId });
    return params.roomId;
  }

  const chat = await createChat({
    artistId: params.artistId,
    accountId: params.accountId,
    topic: params.topic,
  });

  if (!chat) {
    logger.error("Failed to create chat room");
    return undefined;
  }

  return chat.id;
}
