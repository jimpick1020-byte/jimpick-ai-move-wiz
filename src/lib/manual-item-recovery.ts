/** IndexedDB retains generated files and form state across navigation without bloating estimate storage. */
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("jimpick-item-work", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("forms");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function itemFormRecovery(key: string, value?: unknown, remove = false): Promise<unknown> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("forms", value !== undefined || remove ? "readwrite" : "readonly");
      const store = tx.objectStore("forms");
      const request = remove ? store.delete(key) : value !== undefined ? store.put(value, key) : store.get(key);
      let result: unknown; request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}