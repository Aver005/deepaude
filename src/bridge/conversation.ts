import type { ConversationState, DeepseekClientInstance } from "./types";

const conversationStore = new Map<string, ConversationState>();

function getConversationKey(req: Request): string
{
  const claudeSessionId = req.headers.get("x-claude-code-session-id");
  if (claudeSessionId && claudeSessionId.trim().length > 0)
  {
    return `claude:${claudeSessionId.trim()}`;
  }

  return "claude:default";
}

export async function getConversationState(
  req: Request,
  client: DeepseekClientInstance,
): Promise<ConversationState>
{
  const key = getConversationKey(req);
  const existing = conversationStore.get(key);
  if (existing)
  {
    existing.updatedAt = Date.now();
    return existing;
  }

  const session = await client.createSession();
  const created: ConversationState = {
    session,
    parentMessageId: session.getParentMessageId(),
    updatedAt: Date.now(),
  };
  conversationStore.set(key, created);
  return created;
}
