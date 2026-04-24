export type Role = "user" | "assistant";

export type AnthropicContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: unknown }
    | { type: "tool_use"; id?: string; name: string; input?: unknown }
    | {
        type: "tool_result";
        tool_use_id?: string;
        is_error?: boolean;
        content?: unknown;
    };

export interface AnthropicTool
{
    name: string;
    description?: string;
    input_schema?: unknown;
}

export interface AnthropicMessage
{
    role: Role;
    content: string | AnthropicContentBlock[];
}

export interface AnthropicRequest
{
    model: string;
    max_tokens: number;
    messages: AnthropicMessage[];
    system?: unknown;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
    tools?: AnthropicTool[];
}

export interface DeepseekSession
{
    getId(): string;
    getParentMessageId(): number | null;
    setParentMessageId(parentMessageId: number | null): void;
}

export interface DeepseekClientInstance
{
    initialize(): Promise<void>;
    createSession(): Promise<DeepseekSession>;
    sendMessage(
        message: string,
        session?: DeepseekSession | null,
        options?: { thinking_enabled?: boolean; search_enabled?: boolean },
    ): Promise<Response>;
}

export interface DeepseekPatchEvent
{
    p?: string;
    o?: string;
    v?: unknown;
}

export interface ParsedToolCall
{
    name: string;
    input: Record<string, unknown>;
}

export interface DeepseekCollectedOutput
{
    text: string;
    requestMessageId: number | null;
    responseMessageId: number | null;
}

export interface ConversationState
{
    session: DeepseekSession;
    parentMessageId: number | null;
    updatedAt: number;
}
