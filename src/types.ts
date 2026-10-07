export interface Exotic {
  num: number;
  name: string;
  category: "Weapon" | "Gear";
  type: string;
  talents: string | null;
  summary: string | null;
  obtain: string | null;
  locked: string | null;
  targeted: string | null;
  blueprint: string | null;
  added: string | null;
  role: string | null;
  notes: string | null;
  status: string;
}

export interface ExoticsFile {
  meta: { title: string; subtitle: string };
  exotics: Exotic[];
}
