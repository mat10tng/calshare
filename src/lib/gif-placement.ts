export interface BusyRect {
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
}

const MIN_COLS = 2;
const MIN_ROWS = 3;

/**
 * Finds the largest axis-aligned rectangle of all-true cells in a 2D boolean
 * grid, subject to minimum dimensions. Uses the maximal-rectangle histogram algorithm.
 *
 * grid[row][col] = true means that cell is busy.
 * Returns null if no qualifying rectangle exists.
 */
export function findLargestBusyRect(grid: boolean[][]): BusyRect | null {
  const numRows = grid.length;
  const numCols = grid[0]?.length ?? 0;
  if (numRows === 0 || numCols === 0) return null;

  const heights = new Array<number>(numCols).fill(0);
  let best: BusyRect | null = null;
  let bestArea = 0;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      heights[c] = grid[r][c] ? heights[c] + 1 : 0;
    }

    const result = largestRectInHistogram(heights, r);
    if (result && result.area > bestArea) {
      bestArea = result.area;
      best = result.rect;
    }
  }

  if (!best || best.cols < MIN_COLS || best.rows < MIN_ROWS) return null;
  return best;
}

interface HistogramResult {
  area: number;
  rect: BusyRect;
}

function largestRectInHistogram(
  heights: number[],
  bottomRow: number,
): HistogramResult | null {
  const stack: number[] = [];
  let best: HistogramResult | null = null;

  const process = (i: number) => {
    const currentHeight = i < heights.length ? heights[i] : 0;
    while (stack.length > 0 && heights[stack[stack.length - 1]] > currentHeight) {
      const h = heights[stack.pop()!];
      const left = stack.length === 0 ? 0 : stack[stack.length - 1] + 1;
      const width = i - left;
      const area = h * width;
      if (!best || area > best.area) {
        best = {
          area,
          rect: {
            startRow: bottomRow - h + 1,
            startCol: left,
            rows: h,
            cols: width,
          },
        };
      }
    }
    stack.push(i);
  };

  for (let i = 0; i <= heights.length; i++) {
    process(i);
  }

  return best;
}
