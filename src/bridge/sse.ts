export function writeSseEvent(
  controller: ReadableStreamDefaultController<string>,
  event: string,
  payload: Record<string, unknown>,
): void
{
  controller.enqueue(`event: ${event}\n`);
  controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
}

export function splitTextForSse(text: string, chunkSize = 120): string[]
{
  if (!text) return [];

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize)
  {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}
