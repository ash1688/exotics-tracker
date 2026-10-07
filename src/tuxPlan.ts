// Tuxedo Bandido's exotic unlock order, summarised in our own words from his video
// "The Division 2: Every Exotic & Where to Get It in 2026" (chapters 15 and 16).
// Exotic numbers refer to src/exotics.json.

export interface PlanPick {
  num: number;
  why: string;
}

export interface PlanStep {
  title: string;
  text: string;
  exotics?: number[];
}

const VIDEO = "https://www.youtube.com/watch?v=jP-AEM2w9vA";

export const TUX_PLAN = {
  video: VIDEO,
  /** "The final game plan" chapter. */
  planVideo: `${VIDEO}&t=854s`,
  /** "Top 6 must-have exotics" chapter. */
  picksVideo: `${VIDEO}&t=921s`,

  /** The six Tux would chase first on a fresh agent, in order. */
  firstSix: [
    { num: 3, why: "The pick for skill builds: shooting makes your skills hit harder. Clear the Summit challenges once, then farm more from assault rifle targeted loot." },
    { num: 30, why: "His shotgun for the hardest content. Guaranteed on your first Master clear of United Ironworks (General Anderson)." },
    { num: 15, why: "Builds a plague on one enemy that jumps to the next when they die. Set targeted loot to LMG." },
    { num: 52, why: "The backpack for solo players: kills leave trophies that keep buffing you. Set targeted loot to backpack." },
    { num: 63, why: "Turns your next body shot into a headshot, great for marksman rifle, rifle and pistol builds. Currently on the free season pass track." },
    { num: 66, why: "Easy amplified damage that pays off without much thought. Set targeted loot to gloves." },
  ] as PlanPick[],

  bonus: {
    num: 39,
    why: "A sniper favourite, but it only drops from the Paradise Lost incursion, so run it weekly on every character until it does.",
  } as PlanPick,

  steps: [
    {
      title: "Guaranteed drops first",
      text: "Do the exotic quests and climax missions. Their rewards are guaranteed, no luck needed.",
    },
    {
      title: "Run the weekly cache routine on every character",
      text: "Priority objectives and the weekly SHD projects each give exotic caches, and they reset per character, so extra characters multiply them. During global events you also earn red stars (one per SHD level); 20 stars buys an exotic cache. Caches fill out your collection; use targeted loot for a specific piece.",
    },
    {
      title: "Hunt specific exotics with targeted loot",
      text: "Start with Retaliation, choosing the faction that carries the blueprint you want. Rotate in Summit and Countdown so you don't burn out.",
    },
    {
      title: "Raids and incursions weekly",
      text: "Run them every week on every character.",
    },
    {
      title: "Dark Zone",
      text: "Hunt Eagle Bearer and The Ravenous there, and extract often.",
      exotics: [4, 24],
    },
    {
      title: "Before November 3rd",
      text: "Grab Vertigo and Sarru while the Red Moon Rising event is running.",
      exotics: [21, 57],
    },
  ] as PlanStep[],
};
