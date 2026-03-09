import { zipSync, strToU8 } from 'fflate';
import { parseIcsFile, parseZipFile } from '@/lib/ics-parser';

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'DTSTART:20240101T090000Z',
  'DTEND:20240101T100000Z',
  'SUMMARY:Meeting',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function makeZip(files: Record<string, string>): ArrayBuffer {
  const data: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    data[name] = strToU8(content);
  }
  return zipSync(data).buffer as ArrayBuffer;
}

describe('parseIcsFile', () => {
  test('parses a valid ICS string into busy blocks', () => {
    const blocks = parseIcsFile(SAMPLE_ICS);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe('2024-01-01T09:00:00.000Z');
    expect(blocks[0].end).toBe('2024-01-01T10:00:00.000Z');
    expect(blocks[0].busy).toBe(true);
  });

  test('throws on invalid ICS content', () => {
    expect(() => parseIcsFile('not valid ics')).toThrow('Invalid .ics file');
  });
});

describe('parseZipFile', () => {
  test('extracts and parses .ics file from a zip', async () => {
    const zip = makeZip({ 'calendar.ics': SAMPLE_ICS });
    const blocks = await parseZipFile(zip);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe('2024-01-01T09:00:00.000Z');
  });

  test('merges blocks from multiple .ics files in a zip', async () => {
    const zip = makeZip({
      'cal1.ics': SAMPLE_ICS,
      'cal2.ics': SAMPLE_ICS,
    });
    const blocks = await parseZipFile(zip);
    expect(blocks).toHaveLength(2);
  });

  test('ignores non-.ics files in the zip', async () => {
    const zip = makeZip({
      'calendar.ics': SAMPLE_ICS,
      'readme.txt': 'hello',
    });
    const blocks = await parseZipFile(zip);
    expect(blocks).toHaveLength(1);
  });

  test('throws when zip contains no .ics files', async () => {
    const zip = makeZip({ 'readme.txt': 'hello' });
    await expect(parseZipFile(zip)).rejects.toThrow('No .ics files found in zip');
  });
});
