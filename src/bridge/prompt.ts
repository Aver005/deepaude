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

function renderContentValue(value: unknown): string
{
  if (typeof value === "string") return value;

  if (Array.isArray(value))
  {
    return value
      .map((item) =>
      {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object")
        {
          const r = item as { type?: unknown; text?: unknown };
          if (r.type === "text" && typeof r.text === "string") return r.text.trim();
        }
        return toCompactJson(item);
      })
      .filter((s) => s.length > 0)
      .join("\n");
  }

  if (value && typeof value === "object") return toCompactJson(value);
  return String(value ?? "");
}

function extractMessageText(content: AnthropicMessage["content"]): string
{
  if (typeof content === "string") return content.trim();

  const texts: string[] = [];

  for (const block of content)
  {
    if (block.type === "text")
    {
      if (block.text.trim().length > 0) texts.push(block.text.trim());
      continue;
    }

    if (block.type === "tool_use")
    {
      texts.push(`[Tool call: ${block.name}]\nArguments: ${toCompactJson(block.input ?? {})}`);
      continue;
    }

    if (block.type === "tool_result")
    {
      const result = renderContentValue(block.content);
      const prefix = block.is_error === true ? "[Tool error]" : "[Tool result]";
      texts.push(result.length > 0 ? `${prefix}\n${result}` : prefix);
      continue;
    }

    if (block.type === "image")
    {
      texts.push("[image attachment]");
    }
  }

  return texts.join("\n\n").trim();
}

export function extractSystemText(system: AnthropicRequest["system"]): string
{
  if (typeof system === "string") return system.trim();

  if (Array.isArray(system))
  {
    const texts: string[] = [];
    for (const block of system)
    {
      if (!block || typeof block !== "object") continue;
      const maybeText = (block as { text?: unknown }).text;
      if (typeof maybeText === "string" && maybeText.trim().length > 0)
        texts.push(maybeText.trim());
    }
    return texts.join("\n").trim();
  }

  if (system && typeof system === "object")
  {
    const maybeText = (system as { text?: unknown }).text;
    if (typeof maybeText === "string") return maybeText.trim();
  }

  return "";
}

function buildToolsInstruction(tools: AnthropicRequest["tools"]): string
{
  if (!Array.isArray(tools) || tools.length === 0) return "";

  const toolList = tools
    .map((tool) =>
    {
      const lines: string[] = [`- ${tool.name}`];
      if (tool.description) lines.push(`: ${tool.description}`);
      if (tool.input_schema) lines.push(`\n  Input schema: ${toCompactJson(tool.input_schema)}`);
      return lines.join("");
    })
    .join("\n");

  return [
    "You have access to the following tools:",
    toolList,
    "",
    "To call a tool, output ONLY this JSON (no markdown fences, no explanations, nothing else):",
    '{"tool":"<tool_name>","arguments":{...}}',
    "If you do not need to call a tool, respond normally in plain text.",
  ].join("\n");
}

export function buildDeepseekPrompt(body: AnthropicRequest): string
{
  const chunks: string[] = [];

  const systemText = extractSystemText(body.system);
  if (systemText.length > 0) chunks.push(`System:\n${systemText}`);

  const toolsInstruction = buildToolsInstruction(body.tools);
  if (toolsInstruction.length > 0) chunks.push(toolsInstruction);

  for (const message of body.messages)
  {
    const text = extractMessageText(message.content);
    if (!text) continue;
    const role = message.role === "assistant" ? "Assistant" : "User";
    chunks.push(`${role}:\n${text}`);
  }

  chunks.push("Assistant:");
  return chunks.join("\n\n");
}
