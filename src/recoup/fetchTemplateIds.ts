import { callRecoupApi } from "./callRecoupApi";

/**
 * Fetch the list of valid template IDs from the API.
 *
 * @returns Array of template ID strings.
 */
export async function fetchTemplateIds(): Promise<string[]> {
  const data = await callRecoupApi("/api/content/templates", {}, "GET");
  const templates = data.templates as Array<{ id: string }>;
  return templates.map(t => t.id);
}
