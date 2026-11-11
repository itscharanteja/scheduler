export const SCHEDULING_MODEL = "claude-sonnet-5";

export function fetchAnthropicMessage(
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  return fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });
}
