import type { AnthropicMessage, AnthropicRequest } from "./types";

function toCompactJson(value: unknown): string
{
  try
  {
    return JSON.stringify(value);
  }
  catch
  {
    return String(value);
  }
}

function unknownContentToText(value: unknown): string
{
  if (typeof value === "string")
  {
    return value;
  }

  if (Array.isArray(value))
  {
    const chunks: string[] = [];
    for (const item of value)
    {
      if (typeof item === "string")
      {
        if (item.trim().length > 0)
        {
          chunks.push(item.trim());
        }
        continue;
      }

      if (!item || typeof item !== "object")
      {
        continue;
      }

      const record = item as { type?: unknown; text?: unknown };
      if (record.type === "text" && typeof record.text === "string" && record.text.trim().length > 0)
      {
        chunks.push(record.text.trim());
      }
      else
      {
        chunks.push(toCompactJson(item));
      }
    }

    return chunks.join("\n").trim();
  }

  if (value && typeof value === "object")
  {
    return toCompactJson(value);
  }

  if (value === null || value === undefined)
  {
    return "";
  }

  return String(value);
}

function extractMessageText(content: AnthropicMessage["content"]): string
{
  if (typeof content === "string")
  {
    return content.trim();
  }

  const texts: string[] = [];
  for (const block of content)
  {
    if (block.type === "text")
    {
      if (block.text.trim().length > 0)
      {
        texts.push(block.text.trim());
      }
      continue;
    }

    if (block.type === "tool_use")
    {
      texts.push(
        [
          "[TOOL_USE]",
          `name=${block.name}`,
          `id=${block.id ?? "unknown"}`,
          `input=${toCompactJson(block.input ?? {})}`,
        ].join(" "),
      );
      continue;
    }

    if (block.type === "tool_result")
    {
      const rendered = unknownContentToText(block.content);
      texts.push(
        [
          "[TOOL_RESULT]",
          `tool_use_id=${block.tool_use_id ?? "unknown"}`,
          `is_error=${block.is_error === true ? "true" : "false"}`,
        ].join(" "),
      );
      if (rendered.length > 0)
      {
        texts.push(rendered);
      }
      continue;
    }

    if (block.type === "image")
    {
      texts.push("[IMAGE_BLOCK]");
    }
  }

  return texts.join("\n").trim();
}

function extractSystemText(system: AnthropicRequest["system"]): string
{
  if (typeof system === "string")
  {
    return system.trim();
  }

  if (Array.isArray(system))
  {
    const texts: string[] = [];
    for (const block of system)
    {
      if (!block || typeof block !== "object") continue;
      const maybeText = (block as { text?: unknown }).text;
      if (typeof maybeText === "string" && maybeText.trim().length > 0)
      {
        texts.push(maybeText.trim());
      }
    }
    return texts.join("\n").trim();
  }

  if (system && typeof system === "object")
  {
    const maybeText = (system as { text?: unknown }).text;
    if (typeof maybeText === "string")
    {
      return maybeText.trim();
    }
  }

  return "";
}

export function buildDeepseekPrompt(body: AnthropicRequest): string
{
  const chunks: string[] = [];
  const systemText = extractSystemText(body.system);
  if (systemText.length > 0)
  {
    chunks.push(`System:\n${systemText}`);
  }

  for (const message of body.messages)
  {
    const text = extractMessageText(message.content);
    if (!text) continue;
    const role = message.role === "assistant" ? "Assistant" : "User";
    chunks.push(`${role}:\n${text}`);
  }

  if (Array.isArray(body.tools) && body.tools.length > 0)
  {
    const toolNames = body.tools.map((tool) => tool.name).join(", ");
    chunks.push(
      [
        "Tools available:",
        toolNames,
        "If you need to call a tool, output ONLY valid JSON in this exact shape:",
        '{"tool":"<tool_name>","arguments":{...}}',
        "Do not add markdown fences, explanations, or fake tool results.",
      ].join("\n"),
    );
  }

  chunks.push("Assistant:");
  return chunks.join("\n\n");
}
