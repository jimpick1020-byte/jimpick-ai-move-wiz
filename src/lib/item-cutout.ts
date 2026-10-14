/** Remove only edge-connected neutral white background, never enclosed white object details. */
export function clearWhiteBackdrop(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  const add = (index: number) => {
    if (index < 0 || index >= seen.length || seen[index]) return;
    seen[index] = 1;
    const i = index * 4;
    const min = Math.min(result[i], result[i + 1], result[i + 2]);
    const max = Math.max(result[i], result[i + 1], result[i + 2]);
    if (result[i + 3] < 16 || (min >= 215 && max - min <= 45)) queue.push(index);
  };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    result[index * 4 + 3] = 0;
    if (index % width > 0) add(index - 1);
    if (index % width < width - 1) add(index + 1);
    add(index - width); add(index + width);
  }
  return result;
}