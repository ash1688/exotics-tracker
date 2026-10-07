const CACHE_KEY = "exotics-tracker:owned";

function readCache(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeCache(owned: number[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(owned));
  } catch {
    /* ignore */
  }
}

/** Loads owned exotic numbers from data/owned.json (via the local API), falling back to the browser cache. */
export async function loadOwned(): Promise<{ owned: Set<number>; offline: boolean }> {
  try {
    const res = await fetch("/api/owned");
    if (!res.ok) throw new Error(res.statusText);
    const { owned } = (await res.json()) as { owned: number[] };
    writeCache(owned);
    return { owned: new Set(owned), offline: false };
  } catch {
    return { owned: new Set(readCache()), offline: true };
  }
}

let pending: ReturnType<typeof setTimeout> | undefined;

/** Saves immediately to the browser cache and debounces the write to disk. */
export function saveOwned(owned: Set<number>, onResult: (ok: boolean) => void): void {
  const list = [...owned];
  writeCache(list);
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      const res = await fetch("/api/owned", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owned: list }),
      });
      onResult(res.ok);
    } catch {
      onResult(false);
    }
  }, 250);
}
