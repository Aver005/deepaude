const token = process.env.DEEPSEEK_TOKEN;
if (!token) throw new Error("Missing DEEPSEEK_TOKEN in environment");

export const TOKEN = token;
export const PORT = Number(process.env.PORT ?? "4141");
export const PROXY_API_KEY = process.env.PROXY_API_KEY;
