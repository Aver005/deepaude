import type { DeepseekCollectedOutput, DeepseekPatchEvent } from "./types";

function asNumberOrNull(value: unknown): number | null
{
  if (typeof value === "number" && Number.isFinite(value))
  {
    return value;
  }

  if (typeof value === "string")
  {
    const numeric = Number(value);
    if (Number.isFinite(numeric))
    {
      return numeric;
    }
  }

  return null;
}

function extractMessageIds(
  event: DeepseekPatchEvent,
  state: { requestMessageId: number | null; responseMessageId: number | null },
): void
{
  const requestFromRoot = asNumberOrNull((event as { request_message_id?: unknown }).request_message_id);
  const responseFromRoot = asNumberOrNull((event as { response_message_id?: unknown }).response_message_id);

  if (requestFromRoot !== null)
  {
    state.requestMessageId = requestFromRoot;
  }
  if (responseFromRoot !== null)
  {
    state.responseMessageId = responseFromRoot;
  }

  if (event.v && typeof event.v === "object")
  {
    const nestedResponse = (event.v as { response?: { message_id?: unknown; parent_id?: unknown } }).response;
    const nestedMessageId = asNumberOrNull(nestedResponse?.message_id);
    const nestedParentId = asNumberOrNull(nestedResponse?.parent_id);

    if (nestedMessageId !== null)
    {
      state.responseMessageId = nestedMessageId;
    }
    if (nestedParentId !== null)
    {
      state.requestMessageId = nestedParentId;
    }
  }
}

function parseStreamLine(line: string): DeepseekPatchEvent | null
{
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:"))
  {
    return null;
  }

  const raw = trimmed.slice("data:".length).trim();
  if (!raw || raw === "[DONE]")
  {
    return null;
  }

  try
  {
    return JSON.parse(raw) as DeepseekPatchEvent;
  }
  catch
  {
    return null;
  }
}

function extractResponseChunks(event: DeepseekPatchEvent, state: { fragmentType: string | null }): string[]
{
  const chunks: string[] = [];

  if (event.v && typeof event.v === "object" && !event.p)
  {
    const nested = event.v as { response?: { fragments?: Array<{ type?: string; content?: unknown }> } };
    const fragments = nested.response?.fragments;
    if (Array.isArray(fragments) && fragments.length > 0)
    {
      const fragment = fragments[fragments.length - 1];
      if (!fragment)
      {
        return chunks;
      }

      state.fragmentType = fragment.type ?? null;
      if (state.fragmentType === "RESPONSE" && typeof fragment.content === "string" && fragment.content.length > 0)
      {
        chunks.push(fragment.content);
      }

      return chunks;
    }
  }

  if (event.p === "response/fragments" && event.o === "APPEND" && Array.isArray(event.v))
  {
    for (const fragment of event.v)
    {
      if (!fragment || typeof fragment !== "object") continue;
      const typedFragment = fragment as { type?: string; content?: unknown };
      state.fragmentType = typedFragment.type ?? null;
      if (state.fragmentType === "RESPONSE" && typeof typedFragment.content === "string" && typedFragment.content.length > 0)
      {
        chunks.push(typedFragment.content);
      }
    }

    return chunks;
  }

  if (event.p === "response/fragments/-1/content" && typeof event.v === "string")
  {
    if (state.fragmentType === "RESPONSE")
    {
      chunks.push(event.v);
    }
    return chunks;
  }

  if (!event.p && typeof event.v === "string" && state.fragmentType === "RESPONSE")
  {
    chunks.push(event.v);
  }

  return chunks;
}

export async function collectDeepseekOutput(response: Response): Promise<DeepseekCollectedOutput>
{
  let text = "";
  const idState: { requestMessageId: number | null; responseMessageId: number | null } = {
    requestMessageId: null,
    responseMessageId: null,
  };

  if (!response.body)
  {
    return { text, requestMessageId: idState.requestMessageId, responseMessageId: idState.responseMessageId };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunkState: { fragmentType: string | null } = { fragmentType: null };
  let buffer = "";

  try
  {
    while (true)
    {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines)
      {
        const event = parseStreamLine(line);
        if (!event) continue;

        extractMessageIds(event, idState);
        const textChunks = extractResponseChunks(event, chunkState);
        for (const textChunk of textChunks)
        {
          if (textChunk.length > 0)
          {
            text += textChunk;
          }
        }
      }
    }

    if (buffer.length > 0)
    {
      const event = parseStreamLine(buffer);
      if (event)
      {
        extractMessageIds(event, idState);
        const textChunks = extractResponseChunks(event, chunkState);
        for (const textChunk of textChunks)
        {
          if (textChunk.length > 0)
          {
            text += textChunk;
          }
        }
      }
    }
  }
  finally
  {
    reader.releaseLock();
  }

  return {
    text,
    requestMessageId: idState.requestMessageId,
    responseMessageId: idState.responseMessageId,
  };
}
