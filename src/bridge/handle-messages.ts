import { getClient } from "./client";
import { getConversationState } from "./conversation";
import { collectDeepseekOutput } from "./deepseek-stream";
import { PROXY_API_KEY } from "./env";
import { anthropicError } from "./errors";
import { buildDeepseekPrompt, extractSystemText, getToolsFingerprint } from "./prompt";
import { splitTextForSse, writeSseEvent } from "./sse";
import { parseToolCallFromText } from "./tool-call";
import type { AnthropicRequest } from "./types";

function createStreamingResponse(
  text: string,
  anthropicModel: string,
  messageId: string,
  toolCallId: string,
  parsedToolCall: ReturnType<typeof parseToolCallFromText>,
): Response
{
  const stream = new ReadableStream<string>({
    async start(controller)
    {
      writeSseEvent(controller, "message_start", {
        type: "message_start",
        message: {
          id: messageId,
          type: "message",
          role: "assistant",
          model: anthropicModel,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });

      try
      {
        if (parsedToolCall)
        {
          writeSseEvent(controller, "content_block_start", {
            type: "content_block_start",
            index: 0,
            content_block: {
              type: "tool_use",
              id: toolCallId,
              name: parsedToolCall.name,
              input: {},
            },
          });

          writeSseEvent(controller, "content_block_delta", {
            type: "content_block_delta",
            index: 0,
            delta: {
              type: "input_json_delta",
              partial_json: JSON.stringify(parsedToolCall.input),
            },
          });

          writeSseEvent(controller, "content_block_stop", {
            type: "content_block_stop",
            index: 0,
          });

          writeSseEvent(controller, "message_delta", {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: Math.ceil(text.length / 4) },
          });
        }
        else
        {
          writeSseEvent(controller, "content_block_start", {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          });

          for (const textChunk of splitTextForSse(text))
          {
            writeSseEvent(controller, "content_block_delta", {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: textChunk },
            });
          }

          writeSseEvent(controller, "content_block_stop", {
            type: "content_block_stop",
            index: 0,
          });

          writeSseEvent(controller, "message_delta", {
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: Math.ceil(text.length / 4) },
          });
        }

        writeSseEvent(controller, "message_stop", { type: "message_stop" });
        controller.close();
      }
      catch (error)
      {
        writeSseEvent(controller, "error", {
          type: "error",
          error: {
            type: "api_error",
            message: error instanceof Error ? error.message : "Streaming failed",
          },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export async function handleMessages(req: Request): Promise<Response>
{
  if (PROXY_API_KEY)
  {
    const requestApiKey = req.headers.get("x-api-key");
    if (requestApiKey !== PROXY_API_KEY)
    {
      return anthropicError("Invalid x-api-key", 401);
    }
  }

  let body: AnthropicRequest;
  try
  {
    body = (await req.json()) as AnthropicRequest;
  }
  catch
  {
    return anthropicError("Invalid JSON body");
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0)
  {
    return anthropicError("`messages` must be a non-empty array");
  }

  const client = await getClient();
  const conversation = await getConversationState(req, client);
  const systemText = extractSystemText(body.system);
  const toolsFingerprint = getToolsFingerprint(body);
  const shouldIncludeSystem = conversation.systemText !== systemText;
  const shouldIncludeTools = conversation.toolsFingerprint !== toolsFingerprint;
  const prompt = buildDeepseekPrompt(body, {
    includeSystem: shouldIncludeSystem,
    includeTools: shouldIncludeTools,
  });

  conversation.session.setParentMessageId(conversation.parentMessageId);

  const deepseekResponse = await client.sendMessage(prompt, conversation.session, {
    thinking_enabled: false,
    search_enabled: false,
  });

  if (!deepseekResponse.ok)
  {
    return anthropicError(`DeepSeek upstream failed with status ${deepseekResponse.status}`, 502);
  }

  const anthropicModel = body.model || "deepseek-chat";
  const messageId = `msg_${crypto.randomUUID().replace(/-/g, "")}`;
  const toolCallId = `toolu_${crypto.randomUUID().replace(/-/g, "")}`;
  const deepseekOutput = await collectDeepseekOutput(deepseekResponse);
  const text = deepseekOutput.text;
  const parsedToolCall = parseToolCallFromText(text, body.tools);

  if (deepseekOutput.responseMessageId !== null)
  {
    conversation.parentMessageId = deepseekOutput.responseMessageId;
    conversation.session.setParentMessageId(deepseekOutput.responseMessageId);
    conversation.systemText = systemText;
    conversation.toolsFingerprint = toolsFingerprint;
    conversation.updatedAt = Date.now();
  }

  if (body.stream)
  {
    return createStreamingResponse(text, anthropicModel, messageId, toolCallId, parsedToolCall);
  }

  if (parsedToolCall)
  {
    return Response.json({
      id: messageId,
      type: "message",
      role: "assistant",
      model: anthropicModel,
      content: [
        {
          type: "tool_use",
          id: toolCallId,
          name: parsedToolCall.name,
          input: parsedToolCall.input,
        },
      ],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: Math.ceil(text.length / 4),
      },
    });
  }

  return Response.json({
    id: messageId,
    type: "message",
    role: "assistant",
    model: anthropicModel,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      output_tokens: Math.ceil(text.length / 4),
    },
  });
}
