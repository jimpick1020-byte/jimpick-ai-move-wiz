export async function retryItemStorage<T extends { error: { status?: number | string; statusCode?: number | string } | null }>(operation: () => Promise<T>, wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt=0;;attempt++) {
    const result = await operation();
    const status = Number(result.error?.statusCode ?? result.error?.status);
    if (!result.error || attempt >= 2 || !(status === 429 || status >= 500)) return result;
    await wait(800 * 2 ** attempt);
  }
}