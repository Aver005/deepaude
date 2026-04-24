import { handleMessages } from "./handle-messages";

export async function handleRoute(req: Request): Promise<Response>
{
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/health")
  {
    return Response.json({ ok: true, service: "anthropic-deepseek-bridge" });
  }

  if (req.method === "POST" && url.pathname === "/v1/messages")
  {
    return handleMessages(req);
  }

  return new Response("Not found", { status: 404 });
}
