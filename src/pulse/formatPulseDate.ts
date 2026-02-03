/**
 * Formats a date to "Feb 2" format for pulse topic naming.
 *
 * @param date - The date to format (defaults to current date)
 * @returns Formatted date string like "Feb 2"
 */
export function formatPulseDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
