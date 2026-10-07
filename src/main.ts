import "./styles.css";
import data from "./exotics.json";
import images from "./images.json";
import type { Exotic, ExoticsFile } from "./types";
import { BROWSER_ONLY, ProgressStore, type Status } from "./storage";

const { meta, exotics } = data as ExoticsFile;
const imageFor = (e: Exotic) => {
  const src = (images as Record<string, string>)[e.num];
  return src && import.meta.env.BASE_URL + src.replace(/^\//, "");
};

// In-game order for the subtype chips.
const SUBTYPES: Record<Exotic["category"], string[]> = {
  Weapon: ["Assault Rifle", "SMG", "LMG", "Rifle", "Marksman Rifle", "Shotgun", "Pistol"],
  Gear: ["Mask", "Backpack", "Chest", "Gloves", "Holster", "Kneepads"],
};

type Ownership = "all" | "have" | "need";
type SortKey = "num" | "name" | "type" | "role";

interface Filters {
  search: string;
  ownership: Ownership;
  category: "all" | "Weapon" | "Gear";
  type: string;
  role: string;
  sort: SortKey;
  showUpcoming: boolean;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  ownership: "all",
  category: "all",
  type: "all",
  role: "all",
  sort: "num",
  showUpcoming: true,
};
const filters: Filters = { ...DEFAULT_FILTERS };
let owned = new Set<number>();

const isLive = (e: Exotic) => e.status === "Live";
const cleanType = (t: string) => t.replace(/\s*\[unconfirmed\]/i, "");
const unique = (vals: (string | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort();

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string | null | undefined) => (s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const ROLE_CLASS: Record<string, string> = {
  DPS: "dps",
  "SUPPORT/UTILITY": "support",
  "TANK/SURVIVABILITY": "tank",
  "SKILL/HYBRID": "skill",
  VERSATILITY: "versatile",
};

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="hero">
    <div class="hero-text">
      <h1><span class="diamond"></span>${esc(meta.title)}</h1>
      <p class="sub">${esc(meta.subtitle.split("·").slice(0, 2).join("·"))}</p>
    </div>
    <div class="hero-side">
      <div class="seg theme-seg" id="theme" role="group" aria-label="Theme">
        <button data-v="purple">Purple</button>
        <button data-v="dark">Dark</button>
        <button data-v="light">Light</button>
      </div>
      <div class="stats" id="stats"></div>
    </div>
  </header>

  <section class="toolbar">
    <input id="search" type="search" placeholder="Search name, talent, source…" autocomplete="off" />
    <div class="seg" id="ownership">
      <button data-v="all" class="on">All</button>
      <button data-v="have">Have</button>
      <button data-v="need">Need</button>
    </div>
    <div class="seg" id="category">
      <button data-v="all" class="on">Everything</button>
      <button data-v="Weapon">Weapons</button>
      <button data-v="Gear">Gear</button>
    </div>
    <select id="role">
      <option value="all">All roles</option>
      ${unique(exotics.map((e) => e.role)).map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("")}
    </select>
    <select id="sort">
      <option value="num">Sort: #</option>
      <option value="name">Sort: Name</option>
      <option value="type">Sort: Type</option>
      <option value="role">Sort: Role</option>
    </select>
    <label class="toggle"><input id="upcoming" type="checkbox" checked /> Show announced</label>
    <div id="subtypes" class="subtypes"></div>
  </section>

  <div class="results-bar">
    <span class="count-wrap">
      <span id="count"></span>
      <button id="clear-filters" class="clear-filters" hidden>
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg> Clear filters
      </button>
    </span>
    <span class="actions">
      <span id="save-state" class="save-state"></span>
      <button id="sync" class="link">Sync</button>
      <button id="export" class="link">Export</button>
      <button id="import" class="link">Import</button>
      <button id="clear" class="link danger">Clear all</button>
      <input id="import-file" type="file" accept="application/json" hidden />
    </span>
  </div>

  <main id="list" class="grid"></main>
  <dialog id="sync-dialog" class="modal sync-dialog"></dialog>
  <dialog id="info-dialog" class="modal info-dialog" aria-labelledby="info-title"></dialog>

  <footer>Data from <a href="https://www.youtube.com/@TuxedoBandido" target="_blank" rel="noopener">Tuxedo Bandido</a>'s Division 2 Exotics sheet · ${BROWSER_ONLY ? "Progress saved in this browser" : "Progress saved to <code>data/owned.json</code>"}</footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const listEl = $("list");
const statsEl = $("stats");
const countEl = $("count");
const clearFiltersBtn = $<HTMLButtonElement>("clear-filters");

/** True when anything (other than sort order) narrows the list. */
const isFiltered = () =>
  (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((k) => k !== "sort" && filters[k] !== DEFAULT_FILTERS[k]);
const saveStateEl = $("save-state");
const subtypesEl = $("subtypes");

function renderSubtypes() {
  const cats = filters.category === "all" ? (["Weapon", "Gear"] as const) : [filters.category];
  const valid = cats.flatMap((c) => SUBTYPES[c]);
  if (!valid.includes(filters.type)) filters.type = "all";
  const group = (cat: Exotic["category"]) => {
    const chips = SUBTYPES[cat]
      .map((t) => {
        const pool = exotics.filter((e) => e.category === cat && cleanType(e.type) === t && (filters.showUpcoming || isLive(e)));
        const have = pool.filter((e) => owned.has(e.num)).length;
        const done = pool.length > 0 && have === pool.length;
        return `<button class="chip ${filters.type === t ? "on" : ""} ${done ? "done" : ""}" data-v="${esc(t)}">
          ${esc(t)} <span>${have}/${pool.length}</span></button>`;
      })
      .join("");
    return `<div class="chip-group"><span class="chip-label">${cat === "Weapon" ? "Weapon type" : "Gear slot"}</span>${chips}</div>`;
  };
  subtypesEl.innerHTML = cats.map(group).join("");
}

function ring(label: string, have: number, total: number, color: string) {
  const pct = total ? have / total : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return `
    <div class="stat">
      <svg viewBox="0 0 64 64" class="ring">
        <circle cx="32" cy="32" r="${r}" class="track" />
        <circle cx="32" cy="32" r="${r}" class="fill" style="stroke:${color};stroke-dasharray:${c};stroke-dashoffset:${c * (1 - pct)}" />
        <text x="32" y="36">${Math.round(pct * 100)}%</text>
      </svg>
      <div><strong>${have}<span>/${total}</span></strong><small>${label}</small></div>
    </div>`;
}

function renderStats() {
  const live = exotics.filter(isLive);
  const have = (list: Exotic[]) => list.filter((e) => owned.has(e.num)).length;
  const weapons = live.filter((e) => e.category === "Weapon");
  const gear = live.filter((e) => e.category === "Gear");
  statsEl.innerHTML =
    ring("Live exotics", have(live), live.length, "var(--accent)") +
    ring("Weapons", have(weapons), weapons.length, "var(--pink)") +
    ring("Gear", have(gear), gear.length, "var(--violet)");
}

function matches(e: Exotic): boolean {
  if (!filters.showUpcoming && !isLive(e)) return false;
  if (filters.ownership === "have" && !owned.has(e.num)) return false;
  if (filters.ownership === "need" && owned.has(e.num)) return false;
  if (filters.category !== "all" && e.category !== filters.category) return false;
  if (filters.type !== "all" && cleanType(e.type) !== filters.type) return false;
  if (filters.role !== "all" && e.role !== filters.role) return false;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    const hay = [e.name, e.type, e.talents, e.summary, e.obtain, e.blueprint, e.added, e.role, e.notes, e.locked]
      .join(" ")
      .toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function sorted(list: Exotic[]): Exotic[] {
  const by = filters.sort;
  if (by === "num") return list;
  return [...list].sort((a, b) => (a[by] ?? "~").localeCompare(b[by] ?? "~") || a.num - b.num);
}

function detail(label: string, value: string | null, cls = "") {
  return value ? `<div class="d ${cls}"><dt>${label}</dt><dd>${esc(value)}</dd></div>` : "";
}

function art(e: Exotic, eager = false) {
  return imageFor(e)
    ? `<img src="${imageFor(e)}" alt="${esc(e.name)}" ${eager ? "" : `loading="lazy"`} />`
    : `<div class="no-art"><span class="diamond"></span><small>${esc(cleanType(e.type))}</small></div>`;
}

function tags(e: Exotic) {
  const roleCls = ROLE_CLASS[e.role ?? ""] ?? "none";
  return `
    <span class="tag cat-${e.category.toLowerCase()}">${esc(cleanType(e.type))}</span>
    ${e.role ? `<span class="tag role-${roleCls}">${esc(e.role)}</span>` : ""}
    ${isLive(e) ? "" : `<span class="tag soon">Announced</span>`}
    ${e.locked && e.locked !== "No" ? `<span class="tag lock">🔒 ${esc(e.locked)}</span>` : ""}`;
}

function card(e: Exotic) {
  const have = owned.has(e.num);
  return `
  <article class="card ${have ? "have" : ""} ${isLive(e) ? "" : "upcoming"}" data-num="${e.num}" data-action="info">
    <div class="art">
      ${art(e)}
      ${have ? `<span class="owned-badge">Owned</span>` : ""}
    </div>
    <div class="card-top">
      <button class="check" data-action="toggle" aria-pressed="${have}" aria-label="${have ? "Unmark" : "Mark"} ${esc(e.name)} as owned">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </button>
      <div class="title">
        <div class="name-row">
          <span class="num">#${e.num}</span>
          <h2>${esc(e.name)}</h2>
        </div>
        <div class="tags">${tags(e)}</div>
        <p class="talent"><b>${esc(e.talents)}</b> — ${esc(e.summary)}</p>
      </div>
      <button class="info-btn" data-action="info" aria-label="How to get ${esc(e.name)}">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>
      </button>
    </div>
  </article>`;
}

// --- info modal ---
const infoDialog = $<HTMLDialogElement>("info-dialog");

function openInfo(e: Exotic) {
  const have = owned.has(e.num);
  infoDialog.innerHTML = `
    <button class="modal-close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
    <div class="art">${art(e, true)}${have ? `<span class="owned-badge">Owned</span>` : ""}</div>
    <div class="info-body">
      <div class="name-row">
        <span class="num">#${e.num}</span>
        <h2 id="info-title">${esc(e.name)}</h2>
      </div>
      <div class="tags">${tags(e)}</div>
      <p class="talent"><b>${esc(e.talents)}</b> — ${esc(e.summary)}</p>
      <dl class="details">
        ${detail("How to obtain", e.obtain, "obtain")}
        ${detail("Targeted loot", e.targeted)}
        ${detail("Craftable / Blueprint", e.blueprint)}
        ${detail("Locked behind", e.locked)}
        ${detail("Added in", e.added)}
        ${detail("Notes", e.notes)}
        ${detail("Status", e.status)}
      </dl>
    </div>`;
  infoDialog.showModal();
}

// Any click closes it (backdrop, the cross or the modal itself), unless the user was selecting text.
infoDialog.addEventListener("click", () => {
  if (window.getSelection()?.toString()) return;
  infoDialog.close();
});

function renderList() {
  const list = sorted(exotics.filter(matches));
  countEl.textContent = `Showing ${list.length} of ${exotics.length}`;
  clearFiltersBtn.hidden = !isFiltered();
  listEl.innerHTML = list.length
    ? list.map(card).join("")
    : `<div class="empty">No exotics match these filters.${filters.ownership === "need" ? " Maybe you've got them all? 🎉" : ""}</div>`;
}

function render() {
  renderStats();
  renderSubtypes();
  renderList();
}

function showStatus({ text, kind }: Status) {
  saveStateEl.textContent = text;
  saveStateEl.className = `save-state ${kind}`;
}

const store = new ProgressStore(() => {
  owned = store.owned;
  render();
  if (syncDialog.open) renderSyncDialog();
}, showStatus);

function persist() {
  store.save(owned);
}

// --- events ---
listEl.addEventListener("click", (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLElement>("[data-action]");
  const cardEl = target?.closest<HTMLElement>(".card");
  if (!target || !cardEl) return;
  const num = Number(cardEl.dataset.num);
  if (target.dataset.action === "toggle") {
    if (owned.has(num)) owned.delete(num);
    else owned.add(num);
    persist();
    render();
  } else {
    openInfo(exotics.find((e) => e.num === num)!);
  }
});

$<HTMLInputElement>("search").addEventListener("input", (ev) => {
  filters.search = (ev.target as HTMLInputElement).value;
  renderList();
});

function segmented(id: string, apply: (v: string) => void) {
  const el = $(id);
  el.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    el.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
    apply(btn.dataset.v!);
    renderList();
  });
}
segmented("ownership", (v) => (filters.ownership = v as Ownership));
segmented("category", (v) => {
  filters.category = v as Filters["category"];
  renderSubtypes();
});

subtypesEl.addEventListener("click", (ev) => {
  const chip = (ev.target as HTMLElement).closest<HTMLElement>(".chip");
  if (!chip) return;
  filters.type = filters.type === chip.dataset.v ? "all" : chip.dataset.v!;
  render();
});
$<HTMLSelectElement>("role").addEventListener("change", (ev) => {
  filters.role = (ev.target as HTMLSelectElement).value;
  renderList();
});
$<HTMLSelectElement>("sort").addEventListener("change", (ev) => {
  filters.sort = (ev.target as HTMLSelectElement).value as SortKey;
  renderList();
});
clearFiltersBtn.addEventListener("click", () => {
  Object.assign(filters, DEFAULT_FILTERS, { sort: filters.sort });
  $<HTMLInputElement>("search").value = "";
  $<HTMLSelectElement>("role").value = "all";
  $<HTMLInputElement>("upcoming").checked = true;
  for (const id of ["ownership", "category"]) {
    $(id).querySelectorAll<HTMLElement>("button").forEach((b) => b.classList.toggle("on", b.dataset.v === "all"));
  }
  render();
});

$<HTMLInputElement>("upcoming").addEventListener("change", (ev) => {
  filters.showUpcoming = (ev.target as HTMLInputElement).checked;
  render();
});

// --- theme ---
type Theme = "purple" | "dark" | "light";
const THEME_KEY = "exotics-tracker:theme";
const themeEl = $("theme");

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  themeEl.querySelectorAll<HTMLElement>("button").forEach((b) => b.classList.toggle("on", b.dataset.v === theme));
}

applyTheme((document.documentElement.dataset.theme as Theme) || "purple");
themeEl.addEventListener("click", (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>("button");
  if (!btn) return;
  applyTheme(btn.dataset.v as Theme);
  try {
    localStorage.setItem(THEME_KEY, btn.dataset.v!);
  } catch {
    /* storage unavailable */
  }
});

$("export").addEventListener("click", () => {
  const payload = {
    owned: [...owned].sort((a, b) => a - b),
    names: exotics.filter((e) => owned.has(e.num)).map((e) => e.name),
    exported: new Date().toISOString(),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "exotics-owned.json" });
  a.click();
  URL.revokeObjectURL(url);
});

$("clear").addEventListener("click", () => {
  if (!owned.size) return;
  const where = store.account ? " This also clears them on your other synced devices." : "";
  if (!confirm(`Untick all ${owned.size} exotics?${where} Use Export first if you want a backup.`)) return;
  owned = new Set();
  persist();
  render();
});

const importFile = $<HTMLInputElement>("import-file");
$("import").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const nums: unknown = parsed.owned;
    if (!Array.isArray(nums) || !nums.every((n) => Number.isInteger(n))) throw new Error();
    const valid = new Set(exotics.map((e) => e.num));
    owned = new Set(nums.filter((n: number) => valid.has(n)));
    persist();
    render();
  } catch {
    alert("That file doesn't look like an Exotics Tracker export.");
  }
});

// --- sync across devices (private GitHub gist) ---
const syncDialog = $<HTMLDialogElement>("sync-dialog");
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=Exotics%20Tracker%20sync";

function renderSyncDialog(error = "") {
  const account = store.account;
  syncDialog.innerHTML = account
    ? `
    <h3>Sync across devices</h3>
    <p>Syncing as <b>@${esc(account.login)}</b> to a <a href="${account.gistUrl}" target="_blank" rel="noopener">private gist</a>.
      Changes are pushed as you tick and pulled when you come back to the tab.</p>
    <div class="dialog-actions">
      <button class="btn ghost" data-sync="disconnect">Disconnect this device</button>
      <button class="btn ghost" data-sync="now">Sync now</button>
      <button class="btn" data-sync="close">Done</button>
    </div>`
    : `
    <h3>Sync across devices</h3>
    <p>Your progress is stored in a private gist on your GitHub account, so every device you connect sees the same ticks.</p>
    <ol>
      <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">Create a GitHub token</a> with only the <b>gist</b> scope ticked.</li>
      <li>Paste it below. Do this once on each device.</li>
    </ol>
    <form id="sync-form">
      <input id="sync-token" type="password" placeholder="ghp_…" autocomplete="off" spellcheck="false" required />
      ${error ? `<p class="dialog-error">${esc(error)}</p>` : ""}
      <p class="hint">The token is kept in this browser only and is only sent to GitHub.</p>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" data-sync="close">Cancel</button>
        <button type="submit" class="btn">Connect</button>
      </div>
    </form>`;
}

$("sync").addEventListener("click", () => {
  renderSyncDialog();
  syncDialog.showModal();
});

syncDialog.addEventListener("click", async (ev) => {
  if (ev.target === syncDialog) return syncDialog.close(); // backdrop
  const action = (ev.target as HTMLElement).closest<HTMLElement>("[data-sync]")?.dataset.sync;
  if (action === "close") syncDialog.close();
  if (action === "now") await store.pull();
  if (action === "disconnect") {
    store.disconnect();
    renderSyncDialog();
  }
});

syncDialog.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = syncDialog.querySelector<HTMLInputElement>("#sync-token")!;
  const button = syncDialog.querySelector<HTMLButtonElement>("button[type=submit]")!;
  button.disabled = true;
  button.textContent = "Connecting…";
  try {
    await store.connect(input.value.trim());
    renderSyncDialog();
  } catch (err) {
    renderSyncDialog((err as Error).message);
  }
});

// Pick up changes made on other devices.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void store.pull();
});
setInterval(() => {
  if (document.visibilityState === "visible") void store.pull();
}, 60_000);

// --- boot ---
render();
store.init().then(() => {
  owned = store.owned;
  render();
});
