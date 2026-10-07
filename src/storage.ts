const CACHE_KEY = "exotics-tracker:owned";
const SYNC_KEY = "exotics-tracker:sync";
const GIST_FILE = "exotics-tracker.json";
const GIST_DESCRIPTION = "Exotics Tracker progress";

/** Static builds (GitHub Pages) have no API server, so progress lives in browser storage (plus gist sync). */
export const BROWSER_ONLY = import.meta.env.VITE_STORAGE === "browser";

interface Snapshot {
  owned: number[];
  updated: string; // ISO timestamp of the last change; newest wins when reconciling
}

interface SyncConfig {
  token: string;
  gistId: string;
  login: string;
}

export interface Status {
  text: string;
  kind: "" | "ok" | "warn";
}

const EPOCH = new Date(0).toISOString();
const newer = (a: Snapshot, b: Snapshot) => (a.updated > b.updated ? a : b);

function isSnapshot(v: unknown): v is Snapshot {
  const s = v as Snapshot;
  return !!s && Array.isArray(s.owned) && s.owned.every(Number.isInteger) && typeof s.updated === "string";
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function readCache(): Snapshot {
  const v = readJson(CACHE_KEY);
  if (Array.isArray(v)) return { owned: v, updated: EPOCH }; // pre-sync format
  return isSnapshot(v) ? v : { owned: [], updated: EPOCH };
}

// --- local file server (npm start): data/owned.json ---

async function readServer(): Promise<Snapshot | null> {
  if (BROWSER_ONLY) return null;
  try {
    const res = await fetch("/api/owned");
    if (!res.ok) return null;
    const body = await res.json();
    return { owned: body.owned, updated: body.updated ?? EPOCH };
  } catch {
    return null;
  }
}

async function writeServer(snap: Snapshot): Promise<boolean> {
  try {
    const res = await fetch("/api/owned", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snap),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- GitHub gist sync ---

async function github(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) throw new Error("GitHub rejected the token. It may be wrong, expired or revoked.");
  if (res.status === 403 || res.status === 404) throw new Error("The token doesn't have access to gists.");
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}).`);
  return res.json();
}

const gistBody = (snap: Snapshot) => ({ files: { [GIST_FILE]: { content: JSON.stringify(snap, null, 1) } } });

async function readGist(cfg: SyncConfig): Promise<Snapshot | null> {
  const gist = await github(cfg.token, `/gists/${cfg.gistId}`);
  try {
    const parsed = JSON.parse(gist.files?.[GIST_FILE]?.content ?? "null");
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function findGist(token: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const gists: any[] = await github(token, `/gists?per_page=100&page=${page}`);
    const match = gists.find((g) => g.files?.[GIST_FILE]);
    if (match) return match.id;
    if (gists.length < 100) return null;
  }
  return null;
}

/**
 * Keeps the owned set in sync across the browser cache, the local file server (when running
 * via `npm start`) and, once connected, a private GitHub gist shared by all your devices.
 * The most recently changed copy wins.
 */
export class ProgressStore {
  owned = new Set<number>();
  private snap: Snapshot = { owned: [], updated: EPOCH };
  private sync: SyncConfig | null = readJson(SYNC_KEY) as SyncConfig | null;
  private serverTimer?: ReturnType<typeof setTimeout>;
  private gistTimer?: ReturnType<typeof setTimeout>;
  private pulling?: Promise<void>;

  constructor(
    private onRemoteChange: () => void,
    private onStatus: (s: Status) => void,
  ) {}

  get account(): { login: string; gistUrl: string } | null {
    return this.sync && { login: this.sync.login, gistUrl: `https://gist.github.com/${this.sync.gistId}` };
  }

  async init(): Promise<void> {
    const cache = readCache();
    const server = await readServer();
    if (!BROWSER_ONLY && !server) this.onStatus({ text: "Server unreachable — using browser storage", kind: "warn" });
    this.adopt(server ? newer(server, cache) : cache);
    await this.pull();
  }

  /** Records a local change. */
  save(owned: Set<number>): void {
    this.owned = owned;
    this.snap = { owned: [...owned].sort((a, b) => a - b), updated: new Date().toISOString() };
    writeJson(CACHE_KEY, this.snap);
    this.onStatus({ text: "Saving…", kind: "" });
    if (!BROWSER_ONLY) {
      clearTimeout(this.serverTimer);
      this.serverTimer = setTimeout(async () => {
        const ok = await writeServer(this.snap);
        if (!this.sync)
          this.onStatus(ok ? { text: "Saved", kind: "ok" } : { text: "Saved in browser only (server unreachable)", kind: "warn" });
      }, 250);
    } else if (!this.sync) {
      this.onStatus({ text: "Saved in this browser", kind: "ok" });
    }
    if (this.sync) {
      clearTimeout(this.gistTimer);
      this.gistTimer = setTimeout(() => this.push(), 800);
    }
  }

  /** Fetches the gist and takes it if it's newer than what we have (or pushes ours if it's older). */
  pull(): Promise<void> {
    if (!this.sync || this.gistTimer) return Promise.resolve();
    this.pulling ??= (async () => {
      try {
        const remote = await readGist(this.sync!);
        if (remote && remote.updated > this.snap.updated) {
          this.adopt(remote);
          this.persistLocal();
          this.onRemoteChange();
        } else if (!remote || remote.updated < this.snap.updated) {
          await this.push();
          return;
        }
        this.onStatus({ text: `Synced as @${this.sync!.login}`, kind: "ok" });
      } catch (err) {
        this.onStatus({ text: `Sync failed: ${(err as Error).message}`, kind: "warn" });
      } finally {
        this.pulling = undefined;
      }
    })();
    return this.pulling;
  }

  /** Validates the token, finds (or creates) the progress gist and merges both sides. */
  async connect(token: string): Promise<void> {
    const user = await github(token, "/user");
    const existingId = await findGist(token);
    const remote = existingId ? await readGist({ token, gistId: existingId, login: user.login }) : null;
    // First connection on a device: keep everything ticked on either side.
    const merged: Snapshot = {
      owned: [...new Set([...this.snap.owned, ...(remote?.owned ?? [])])].sort((a, b) => a - b),
      updated: new Date().toISOString(),
    };
    const gistId =
      existingId ??
      (
        await github(token, "/gists", {
          method: "POST",
          body: JSON.stringify({ description: GIST_DESCRIPTION, public: false, ...gistBody(merged) }),
        })
      ).id;
    this.sync = { token, gistId, login: user.login };
    writeJson(SYNC_KEY, this.sync);
    this.adopt(merged);
    this.persistLocal();
    this.onRemoteChange();
    await this.push();
  }

  disconnect(): void {
    clearTimeout(this.gistTimer);
    this.gistTimer = undefined;
    this.sync = null;
    writeJson(SYNC_KEY, null);
    this.onStatus({ text: "Sync disconnected", kind: "" });
  }

  private async push(): Promise<void> {
    this.gistTimer = undefined;
    if (!this.sync) return;
    try {
      await github(this.sync.token, `/gists/${this.sync.gistId}`, {
        method: "PATCH",
        body: JSON.stringify(gistBody(this.snap)),
      });
      this.onStatus({ text: `Synced as @${this.sync.login}`, kind: "ok" });
    } catch (err) {
      this.onStatus({ text: `Sync failed: ${(err as Error).message}`, kind: "warn" });
    }
  }

  private adopt(snap: Snapshot): void {
    this.snap = snap;
    this.owned = new Set(snap.owned);
  }

  private persistLocal(): void {
    writeJson(CACHE_KEY, this.snap);
    if (!BROWSER_ONLY) void writeServer(this.snap);
  }
}
