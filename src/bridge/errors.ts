export function anthropicError(message: string, status = 400): Response
{
  return Response.json(
    {
      type: "error",
      error: {
        type: "invalid_request_error",
        message,
      },
    },
    { status },
  );
}
