import type { AnthropicTool, ParsedToolCall } from "./types";

function normalizeToolInput(input: unknown): Record<string, unknown> | null
{
  if (input && typeof input === "object" && !Array.isArray(input))
  {
    return input as Record<string, unknown>;
  }

  if (typeof input === "string")
  {
    try
    {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      {
        return parsed as Record<string, unknown>;
      }
    }
    catch
    {
      return null;
    }
  }

  return null;
}

function extractJsonCandidates(text: string): string[]
{
  const candidates: string[] = [];
  const fencedMatches = text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedMatches)
  {
    const candidate = match[1]?.trim();
    if (candidate)
    {
      candidates.push(candidate);
    }
  }

  for (let start = 0; start < text.length; start += 1)
  {
    if (text[start] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1)
    {
      const char = text[index];
      if (inString)
      {
        if (escaped)
        {
          escaped = false;
        }
        else if (char === "\\")
        {
          escaped = true;
        }
        else if (char === '"')
        {
          inString = false;
        }
        continue;
      }

      if (char === '"')
      {
        inString = true;
      }
      else if (char === "{")
      {
        depth += 1;
      }
      else if (char === "}")
      {
        depth -= 1;
        if (depth === 0)
        {
          candidates.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates;
}

export function parseToolCallFromText(text: string, tools: AnthropicTool[] | undefined): ParsedToolCall | null
{
  if (!Array.isArray(tools) || tools.length === 0)
  {
    return null;
  }

  const toolNames = new Set(tools.map((tool) => tool.name));
  const candidates = extractJsonCandidates(text);

  for (const candidate of candidates)
  {
    let parsed: unknown;
    try
    {
      parsed = JSON.parse(candidate);
    }
    catch
    {
      continue;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    {
      continue;
    }

    const record = parsed as Record<string, unknown>;
    const rawName =
      typeof record.tool === "string" ? record.tool : typeof record.name === "string" ? record.name : null;
    if (!rawName || !toolNames.has(rawName))
    {
      continue;
    }

    const rawInput = record.arguments ?? record.input ?? {};
    const input = normalizeToolInput(rawInput);
    if (!input)
    {
      continue;
    }

    return { name: rawName, input };
  }

  return null;
}
