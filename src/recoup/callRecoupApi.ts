import { logStep } from "../sandboxes/logStep";

/**
 * Call a Recoup API endpoint with authentication.
 *
 * @param path - API path (e.g. "/api/content/image").
 * @param body - JSON body to send.
 * @param method - HTTP method. Defaults to "POST".
 * @returns Parsed JSON response.
 * @throws Error if the API returns a non-ok status.
 */
export async function callRecoupApi(
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "PATCH" = "POST",
): Promise<Record<string, unknown>> {
  const baseUrl = process.env.RECOUP_API_BASE_URL || "https://recoup-api.vercel.app";
  const apiKey = process.env.RECOUP_API_KEY;
  if (!apiKey) throw new Error("RECOUP_API_KEY is required");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  logStep(`${method} ${path}`, true, {
    status: response.status,
    response: data,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} — ${data.error || "Unknown error"}`);
  }
  return data;
}
