import { parseSessionId } from '../parse-session-id';

describe('parseSessionId', () => {
  it('returns raw ID unchanged when given a plain session ID', () => {
    expect(parseSessionId('ABC123')).toBe('ABC123');
  });

  it('extracts session ID from a full join URL', () => {
    expect(parseSessionId('https://example.com/sessions/ABC123/join')).toBe('ABC123');
  });

  it('extracts session ID from a join URL without trailing slash', () => {
    expect(parseSessionId('http://localhost:3000/sessions/XYZ789/join')).toBe('XYZ789');
  });

  it('trims whitespace from input', () => {
    expect(parseSessionId('  ABC123  ')).toBe('ABC123');
  });

  it('returns null for empty string', () => {
    expect(parseSessionId('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseSessionId('   ')).toBeNull();
  });

  it('extracts from URL with query params', () => {
    expect(parseSessionId('https://example.com/sessions/ABC123/join?ref=email')).toBe('ABC123');
  });
});
