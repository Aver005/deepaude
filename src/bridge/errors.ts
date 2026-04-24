export function anthropicError(message: string, status = 400): Response
{
  const errorType = status >= 500 ? "api_error" : "invalid_request_error";
  return Response.json(
    {
      type: "error",
      error: { type: errorType, message },
    },
    { status },
  );
}
