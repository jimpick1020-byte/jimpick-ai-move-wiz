/** Remove only edge-connected neutral white background, never enclosed white object details. */
export function clearWhiteBackdrop(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  // Already transparent art has white object highlights connected to its alpha edge.
  // Only process an opaque, light rectangular backdrop, not those highlights.
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] < 240) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) return result;
  const corners = [top * width + left, top * width + right, bottom * width + left, bottom * width + right];
  const backdrop = corners.every(index => {
    const i = index * 4;
    return pixels[i + 3] > 240 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >= 190 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) <= 65;
  });
  if (!backdrop) return result;
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  const add = (index: number) => {
    if (index < 0 || index >= seen.length || seen[index]) return;
    seen[index] = 1;
    const i = index * 4;
    const min = Math.min(result[i], result[i + 1], result[i + 2]);
    const max = Math.max(result[i], result[i + 1], result[i + 2]);
    if (result[i + 3] < 16 || (min >= 190 && max - min <= 65)) queue.push(index);
  };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
  corners.forEach(add);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    result[index * 4 + 3] = 0;
    if (index % width > 0) add(index - 1);
    if (index % width < width - 1) add(index + 1);
    add(index - width); add(index + width);
  }
  return result;
}