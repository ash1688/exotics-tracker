// Downloads an image for each exotic from The Division wiki into public/images
// and writes src/images.json ({ [num]: "/images/<file>" }).
// Usage: npm run fetch-images   (re-run any time; existing files are kept)
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "images");
const MAP_FILE = path.join(ROOT, "src", "images.json");
const API = "https://thedivision.fandom.com/api.php";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
};
// Image hosts reject hotlinks without a Referer from their own site.
const refererFor = (url: string) =>
  url.includes("wikia.nocookie.net") ? "https://thedivision.fandom.com/" : `${new URL(url).origin}/`;

interface Exotic {
  num: number;
  name: string;
}

async function api(params: Record<string, string>): Promise<any> {
  const url = `${API}?${new URLSearchParams({ format: "json", redirects: "1", ...params })}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const firstPage = (json: any) => Object.values(json?.query?.pages ?? {})[0] as any;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and"].includes(w));

/** Wiki files for items whose page has no usable image under the spreadsheet name. */
const FILE_OVERRIDES: Record<string, string> = {
  Tempest: "File:Tempest.png",
  "Coyote's Mask": "File:The-division-2-warlords-of-new-york-exotic-coyotes-mask-perk c1cw.1200.webp",
  "NinjaBike Backpack": "File:NinjaBike Messenger Bag.png",
  "Birdie's Quick Fix": "File:Birdie s Quick Fix Exotic Backpack.jpg",
  Tardigrade: "File:Tardigrade Armor System.png",
  Beacon: "File:TCTD2 Seasonal Gear BEACON ExoticVest.png",
  Collector: "File:Collector.jpeg",
  Exodus: "File:Exodus Exotic Gloves.jpg",
  Nimble: "File:Nimble Holster Exotic.png",
  "Acosta's Kneepads": "File:Acosta.png",
  "Sawyer's Kneepads": "File:Sawyers kneepads.jpg",
  "NinjaBike Kneepads": "File:Guaranteed-ninja-bike-messenger-kneepads-300x300.png",
};

/** Direct image URLs for items the wiki has no picture of. */
const URL_OVERRIDES: Record<string, string> = {
  Catalyst: "https://primagames.com/wp-content/uploads/2025/05/division2-catalyst.jpg?resize=640%2C360",
  Investor: "https://keengamer.com/wp-content/uploads/2026/06/Investor-Exotic-Mask-780x439.png",
  "Harrier Pride": "https://www.destructoid.com/wp-content/uploads/2026/03/4._Harrier_Pride_Exotic.jpg?w=768",
  "Loaded for Bear": "https://kingboost.net/image/catalog/Division2/part-9/loaded_for_bear_gloves.jpg",
  // Not revealed yet: Echoes of Central Park key art as a stand-in.
  "The Ratel":
    "https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/MaYT5rlK4icyMmvsUgx29/3ef8fbeda50308692f864fe8cb582168/TD2_EchoesofCentralPark_Keyart.jpg?imwidth=800",
};

async function fileUrl(title: string): Promise<string | null> {
  const info = firstPage(await api({ action: "query", titles: title, prop: "imageinfo", iiprop: "url", iiurlwidth: "480" }));
  return info?.imageinfo?.[0]?.thumburl ?? info?.imageinfo?.[0]?.url ?? null;
}

/** Direct URL, else override file, else page thumbnail, else the best-matching image file used on the page. */
async function findImageUrl(name: string): Promise<string | null> {
  if (URL_OVERRIDES[name]) return URL_OVERRIDES[name];
  if (FILE_OVERRIDES[name]) return fileUrl(FILE_OVERRIDES[name]);
  const thumb = firstPage(await api({ action: "query", titles: name, prop: "pageimages", pithumbsize: "480" }));
  if (thumb?.thumbnail?.source) return thumb.thumbnail.source;
  if (!thumb || "missing" in thumb) return null;

  const imgs = firstPage(await api({ action: "query", titles: name, prop: "images", imlimit: "100" }));
  const words = norm(name);
  const candidates = ((imgs?.images ?? []) as { title: string }[])
    .map((i) => i.title)
    .filter((t) => /\.(png|jpe?g|webp)$/i.test(t))
    .map((t) => ({ t, score: norm(t).filter((w) => words.includes(w)).length }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates.length ? fileUrl(candidates[0].t) : null;
}

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

async function main() {
  const { exotics } = JSON.parse(await readFile(path.join(ROOT, "src", "exotics.json"), "utf-8")) as {
    exotics: Exotic[];
  };
  await mkdir(OUT_DIR, { recursive: true });
  let map: Record<string, string> = {};
  try {
    map = JSON.parse(await readFile(MAP_FILE, "utf-8"));
  } catch {
    /* first run */
  }

  const missing: string[] = [];
  for (const e of exotics) {
    if (map[e.num] && (await exists(path.join(ROOT, "public", map[e.num])))) continue;
    try {
      const url = await findImageUrl(e.name);
      if (!url) {
        missing.push(e.name);
        continue;
      }
      const res = await fetch(url, { headers: { ...UA, Referer: refererFor(url) } });
      if (!res.ok) throw new Error(`${res.status}`);
      const ext = (res.headers.get("content-type") ?? "").split("/")[1]?.replace("jpeg", "jpg") || "png";
      const file = `${e.num}.${ext}`;
      await writeFile(path.join(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
      map[e.num] = `/images/${file}`;
      console.log(`✓ #${e.num} ${e.name}`);
      await new Promise((r) => setTimeout(r, 1500)); // be gentle with the wiki CDN
    } catch (err) {
      missing.push(`${e.name} (${err})`);
    }
  }

  await writeFile(MAP_FILE, JSON.stringify(map, null, 1) + "\n");
  console.log(`\n${Object.keys(map).length}/${exotics.length} images.`);
  if (missing.length) console.log(`No image found for:\n  ${missing.join("\n  ")}`);
}

main();
