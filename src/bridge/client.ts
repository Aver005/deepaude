import { DeepseekClient } from "#/index";
import { TOKEN } from "./env";
import type { DeepseekClientInstance } from "./types";

let clientPromise: Promise<DeepseekClientInstance> | null = null;

export function getClient(): Promise<DeepseekClientInstance>
{
  if (!clientPromise)
  {
    clientPromise = (async () =>
    {
      const client = new DeepseekClient(TOKEN) as DeepseekClientInstance;
      await client.initialize();
      return client;
    })();
  }

  return clientPromise;
}
