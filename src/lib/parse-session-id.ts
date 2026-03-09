/**
 * Extracts a session ID from either a raw ID string or a full join URL.
 * Accepts: "ABC123" or "https://example.com/sessions/ABC123/join"
 * Returns null for empty input.
 */
export function parseSessionId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match /sessions/<id>/join pattern in a URL
  const match = trimmed.match(/\/sessions\/([^/?#]+)\/join/);
  if (match) return match[1];

  return trimmed;
}
