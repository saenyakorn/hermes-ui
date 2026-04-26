export function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}

export function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

export async function getResponseErrorMessage(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) {
    return `${response.status} ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isErrorResponse(parsed)) {
      return parsed.error;
    }
    return body;
  } catch {
    return body;
  }
}
