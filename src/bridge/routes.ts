import { handleMessages } from "./handle-messages";

const MODELS_RESPONSE = {
  object: "list",
  data: [
    {
      id: "deepseek-chat",
      object: "model",
      created: 0,
      owned_by: "deepseek",
    },
  ],
};

export async function handleRoute(req: Request): Promise<Response>
{
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/health")
  {
    return Response.json({ ok: true, service: "anthropic-deepseek-bridge" });
  }

  // Some clients (including Claude Code) probe /v1/models on startup.
  if (req.method === "GET" && url.pathname === "/v1/models")
  {
    return Response.json(MODELS_RESPONSE);
  }

  if (req.method === "POST" && url.pathname === "/v1/messages")
  {
    return handleMessages(req);
  }

  return new Response("Not found", { status: 404 });
}
