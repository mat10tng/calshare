import { findLargestBusyRect } from '@/lib/gif-placement';

describe('findLargestBusyRect', () => {
  // Grid: rows=hours(0-indexed), cols=days(0-indexed)
  // Each cell: true = busy

  test('returns null when no cells are busy', () => {
    const grid = [
      [false, false],
      [false, false],
    ];
    expect(findLargestBusyRect(grid)).toBeNull();
  });

  test('returns null when only 1 col wide', () => {
    const grid = [
      [true],
      [true],
      [true],
    ];
    expect(findLargestBusyRect(grid)).toBeNull();
  });

  test('returns null when only 1-2 rows tall', () => {
    const grid = [
      [true, true, true],
      [true, true, true],
    ];
    expect(findLargestBusyRect(grid)).toBeNull();
  });

  test('finds a valid rect: 2 cols x 3 rows', () => {
    const grid = [
      [true, true, false],
      [true, true, false],
      [true, true, false],
      [false, false, false],
    ];
    const rect = findLargestBusyRect(grid);
    expect(rect).not.toBeNull();
    expect(rect!.cols).toBe(2);
    expect(rect!.rows).toBe(3);
  });

  test('picks the largest rectangle when multiple qualify', () => {
    const grid = [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [false, false, true, true, true],
    ];
    const rect = findLargestBusyRect(grid);
    expect(rect).not.toBeNull();
    // The largest all-busy rectangle is 5 cols x 3 rows = 15
    expect(rect!.rows).toBe(3);
    expect(rect!.cols).toBe(5);
  });

  test('returns startRow, startCol, rows, cols', () => {
    const grid = [
      [false, false, false],
      [false, true,  true ],
      [false, true,  true ],
      [false, true,  true ],
    ];
    const rect = findLargestBusyRect(grid);
    expect(rect).toEqual({ startRow: 1, startCol: 1, rows: 3, cols: 2 });
  });
});
