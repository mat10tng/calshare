/**
 * Extracts a session ID from either a raw ID string or a full join URL.
 * Accepts: "ABC123", "https://example.com/sessions/ABC123/join", or "https://example.com/group?id=ABC123"
 * Returns null for empty input.
 */
export function parseSessionId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match /group?id=<id> pattern in a URL
  const groupMatch = trimmed.match(/\/group\?id=([^&#]+)/);
  if (groupMatch) return groupMatch[1];

  // Match legacy /sessions/<id>/join pattern in a URL
  const match = trimmed.match(/\/sessions\/([^/?#]+)\/join/);
  if (match) return match[1];

  return trimmed;
}
