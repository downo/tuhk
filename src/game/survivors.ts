// Survivor roles: every met NPC gives a passive camp bonus, one active service with a cooldown,
// slow camp production (catch-up from timestamps, capped) and an expedition companion ability.
import type { GameState } from "./engine";
import { ITEMS } from "./data";

export interface Passive { hp?: number; rad?: number; energy?: number; needs?: number }
export interface SurvivorRole {
  role: string;
  passive: Passive; passiveText: string;
  service: { label: string; text: string; cdH: number };
  produce: { item: string; n: number; everyH: number };
  companion: { label: string; text: string };
}

export const SURVIVORS: Record<string, SurvivorRole> = {
  liis: {
    role: "Ravitseja",
    passive: { hp: 0.15, rad: 0.15 }, passiveText: "❤️ Elu taastub 15% kiiremini, ☢️ kiirgus langeb 15% kiiremini",
    service: { label: "🩺 Palu ravi", text: "Taastab 40% elust ja vähendab kiirgust 10 võrra.", cdH: 12 },
    produce: { item: "bandage", n: 1, everyH: 8 },
    companion: { label: "🩹 Liis seob su haavad", text: "Taastab retkel 30% elust (1× retke kohta)." },
  },
  mirko: {
    role: "Kaupmees",
    passive: { energy: 0.15 }, passiveText: "⚡ Energia taastub 15% kiiremini",
    service: { label: "🤝 Vahetuskaup", text: "Annab konservi ja pudeli vett.", cdH: 24 },
    produce: { item: "scrap", n: 2, everyH: 8 },
    companion: { label: "🗺️ Mirko teab otseteed", text: "Taastab retkel 15 energiat (1× retke kohta)." },
  },
  kid: {
    role: "Korilane",
    passive: { needs: 0.1 }, passiveText: "🍖 Nälg ja janu kasvavad 10% aeglasemalt",
    service: { label: "🫐 Saada marju korjama", text: "Tom toob 3 marja ja 1 ravimtaime.", cdH: 12 },
    produce: { item: "herb", n: 1, everyH: 8 },
    companion: { label: "👀 Tom märkab peidikut", text: "Leiab retkel lisasaagi (1× retke kohta)." },
  },
  archivist: {
    role: "Teadlane",
    passive: { rad: 0.25 }, passiveText: "☢️ Kiirgus langeb 25% kiiremini",
    service: { label: "🔬 Kiirgusanalüüs", text: "Vähendab kiirgust 30 võrra.", cdH: 24 },
    produce: { item: "cloth", n: 1, everyH: 12 },
    companion: { label: "📡 Arhivaar skannib ohtu", text: "Hoiatab varitsuse eest — pääsed lahingust (1× retke kohta)." },
  },
};

const HOUR = 3_600_000;
export const PROD_CAP = 3; // max units waiting per survivor, so absences don't flood the stash

type SurvState = { prod: Record<string, number>; cd: Record<string, number> };
const st = (s: GameState): SurvState => {
  const g = s as GameState & { surv?: SurvState };
  if (!g.surv) g.surv = { prod: {}, cd: {} };
  return g.surv;
};
const met = (s: GameState) => s.npcs.filter((n) => SURVIVORS[n]);
const give = (s: GameState, id: string, n: number) => { s.inv[id] = (s.inv[id] || 0) + n; };

/** Sum of passive bonuses from all met survivors. */
export function survivorPassive(s: GameState): Required<Passive> {
  const t = { hp: 0, rad: 0, energy: 0, needs: 0 };
  for (const n of met(s)) { const p = SURVIVORS[n].passive; t.hp += p.hp ?? 0; t.rad += p.rad ?? 0; t.energy += p.energy ?? 0; t.needs += p.needs ?? 0; }
  return t;
}

/** Adds produced items to the camp stash (or backpack). Returns log lines. */
export function survivorProduce(s: GameState, now = Date.now()): string[] {
  const S = st(s); const out: string[] = [];
  for (const n of met(s)) {
    const p = SURVIVORS[n].produce; const every = p.everyH * HOUR;
    if (!S.prod[n]) { S.prod[n] = now; continue; }
    const k = Math.min(PROD_CAP, Math.floor((now - S.prod[n]) / every));
    if (k <= 0) continue;
    S.prod[n] = k >= PROD_CAP ? now : S.prod[n] + k * every;
    const qty = k * p.n;
    if (s.stash) s.stash[p.item] = (s.stash[p.item] || 0) + qty; else give(s, p.item, qty);
    out.push(`${ITEMS[p.item]?.icon ?? ""} ${n === "kid" ? "Väike Tom" : n === "archivist" ? "Arhivaar" : n[0].toUpperCase() + n.slice(1)} valmistas laagris: ${ITEMS[p.item]?.name ?? p.item} ×${qty}.`);
  }
  return out;
}

export const serviceReadyAt = (s: GameState, n: string) => { const t = st(s).cd[n]; return t == null ? 0 : t + SURVIVORS[n].service.cdH * HOUR; };

export function askService(s: GameState, n: string, now = Date.now()): string | null {
  const r = SURVIVORS[n]; if (!r || !s.npcs.includes(n)) return "Seda ellujäänut pole sul.";
  if (s.region !== "camp") return "Ellujäänud ootavad sind baasis.";
  if (now < serviceReadyAt(s, n)) return "Pole veel valmis.";
  st(s).cd[n] = now;
  if (n === "liis") { s.hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * 0.4)); s.rad = Math.max(0, s.rad - 10); }
  else if (n === "mirko") { give(s, "can", 1); give(s, "water", 1); }
  else if (n === "kid") { give(s, "berries", 3); give(s, "herb", 1); }
  else if (n === "archivist") s.rad = Math.max(0, s.rad - 30);
  return null;
}

export function companionCanUse(s: GameState): boolean {
  const r = s.exp as (GameState["exp"] & { comp?: string; compUsed?: boolean }) | null;
  if (!r?.comp || r.compUsed) return false;
  if (r.comp === "archivist") return r.pending?.kind === "ambush";
  return !r.pending;
}

// ---------- jobs: assign a survivor to one building for a strong local bonus ----------
export const JOBS: Record<string, { building: string; text: string }> = {
  kid: { building: "garden", text: "Peenar toodab marju 2× kiiremini." },
  liis: { building: "infirmary", text: "Välihaigla ravib 2× rohkem (ka puhates)." },
  archivist: { building: "lab", text: "Labori retseptid maksavad 25% vähem." },
  mirko: { building: "generator", text: "Generaatori kütus kestab 2× kauem." },
};
type JobState = SurvState & { job?: Record<string, string> };
export const jobOf = (s: GameState, n: string): string | undefined => (s as GameState & { surv?: JobState }).surv?.job?.[n];
export function assignJob(s: GameState, n: string, on: boolean): string | null {
  const j = JOBS[n]; if (!j || !s.npcs.includes(n)) return "Seda ellujäänut pole sul.";
  if (on && !s.structures[j.building]) return "Ehita enne see hoone.";
  const S = st(s) as JobState; S.job = { ...(S.job || {}) };
  if (on) S.job[n] = j.building; else delete S.job[n];
  return null;
}
export function recipeCost(s: GameState, r: { cost: Record<string, number>; station?: string }): Record<string, number> {
  if (r.station !== "lab" || jobOf(s, "archivist") !== "lab") return r.cost;
  return Object.fromEntries(Object.entries(r.cost).map(([k, v]) => [k, Math.max(1, Math.ceil(v * 0.75))]));
}
