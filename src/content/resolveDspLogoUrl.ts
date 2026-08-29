import type { DspValue } from "../schemas/contentCreationSchema";

const DSP_LOGO_URLS: Record<Exclude<DspValue, "none">, string> = {
  spotify: "https://recoup-api.vercel.app/api/assets/dsp-logo-spotify.png",
  apple: "https://recoup-api.vercel.app/api/assets/dsp-logo-apple.png",
};

/**
 * Returns the DSP logo URL for the given DSP value, or null if "none".
 *
 * @param dsp - The DSP value from the content creation payload.
 */
export function resolveDspLogoUrl(dsp: DspValue): string | null {
  if (dsp === "none") return null;
  return DSP_LOGO_URLS[dsp];
}
