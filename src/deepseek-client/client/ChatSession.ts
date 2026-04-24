import { API_ENDPOINTS } from "../config/constants";
import { HeadersBuilder } from "../config/headers";
import { getRecord, getString } from "../utils/record";

function extractSessionId(data: unknown): string 
{
    const dataNode = getRecord(data, "data");
    const bizData = getRecord(dataNode, "biz_data");
    const chatSession = getRecord(bizData, "chat_session");
    const sessionId = getString(chatSession, "id");

    if (!sessionId) 
{
        throw new Error("Invalid session payload: missing chat_session.id");
    }

    return sessionId;
}

export default class ChatSession 
{
    private readonly sessionId: string;
    private currentMessageId = 0;
    private parentMessageId: number | null;

    private constructor(
        sessionId: string,
        parentMessageId: number | null = null,
    ) 
{
        this.sessionId = sessionId;
        this.parentMessageId = parentMessageId;
    }

    static async create(
        token: string,
        parentMessageId: number | null = null,
    ): Promise<ChatSession> 
{
        const headers = HeadersBuilder.getAuthHeaders(token);
        const payload = { character_id: null };
        const response = await fetch(API_ENDPOINTS.CREATE_SESSION, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) 
{
            const errorData = await response.text();
            throw new Error(
                `Session creation failed: ${response.status} ${errorData}`,
            );
        }

        const data = (await response.json()) as unknown;
        const sessionId = extractSessionId(data);
        return new ChatSession(sessionId, parentMessageId);
    }

    getCurrentMessageId(): number 
{
        return this.currentMessageId;
    }

    incrementMessageId(): number 
{
        this.currentMessageId += 1;
        return this.currentMessageId;
    }

    getParentMessageId(): number | null 
{
        return this.parentMessageId;
    }

    setParentMessageId(parentMessageId: number | null): number | null 
{
        if (parentMessageId === null) 
{
            this.parentMessageId = null;
            return this.parentMessageId;
        }

        if (!Number.isFinite(parentMessageId)) 
{
            this.parentMessageId = null;
            return this.parentMessageId;
        }

        this.parentMessageId = parentMessageId;
        return this.parentMessageId;
    }

    getId(): string 
{
        return this.sessionId;
    }
}
