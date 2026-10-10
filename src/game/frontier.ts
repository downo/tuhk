/**
 * Late-game frontier systems: vehicles (garage), daily hotzones, mutations and the active base defense.
 * Pure rules on GameState; engine.ts calls these hooks. Keep free of engine imports (no cycles).
 */
import { REGIONS } from "./data";
import type { GameState } from "./engine";

// ---------- vehicles ----------
export const VEHICLES = {
  buggy: { carry: 30, travelMult: 0 },
  bike: { carry: 10, travelMult: 0.5 },
} as const;
export type VehicleId = keyof typeof VEHICLES;

/** Best vehicle the player can use right now (needs a garage; the buggy also needs fuel or a core). */
export function activeVehicle(s: GameState): VehicleId | null {
  if (!s.structures.garage) return null;
  if (s.inv.buggy && ((s.inv.fuel || 0) > 0 || (s.inv.core || 0) > 0)) return "buggy";
  if (s.inv.bike || s.inv.buggy) return "bike"; // an empty buggy still rolls like a bike
  return null;
}
export const vehicleCarry = (s: GameState) => {
  if (!s.structures.garage) return 0;
  return s.inv.buggy ? VEHICLES.buggy.carry : s.inv.bike ? VEHICLES.bike.carry : 0;
};

/** Energy cost of one trip, and whether it burns a fuel unit. */
export function travelCost(s: GameState, base: number): { energy: number; fuel: boolean } {
  const v = activeVehicle(s);
  let e = base;
  let fuel = false;
  if (v === "buggy") { e = 0; fuel = true; }
  else if (v === "bike") e = Math.round(base * VEHICLES.bike.travelMult);
  if (hasMut(s, "stone")) e += 5;
  return { energy: e, fuel };
}
/** Burns one fuel (or a core when out of fuel). Returns the label used. */
export function burnFuel(s: GameState): string {
  if ((s.inv.fuel || 0) > 0) { s.inv.fuel--; return "⛽ kütus"; }
  if ((s.inv.core || 0) > 0) { s.inv.core--; return "🔋 tuum"; }
  return "";
}

// ---------- hotzones ----------
/** One dangerous region per game day turns into an anomaly. Deterministic per day. */
export function hotzoneFor(day: number): string {
  const ids = Object.values(REGIONS).filter((r) => r.danger > 0).map((r) => r.id).sort();
  return ids[(day * 2654435761 >>> 0) % ids.length];
}
export const HOTZONE_NAMES = ["Kiirgustorm", "Lõhe sähvatus", "Kristallitorm", "Tuhakeeris"];
export const hotzoneName = (day: number) => HOTZONE_NAMES[day % HOTZONE_NAMES.length];
export const HOTZONE_DMG = 1.35;
export const HOTZONE_DANGER = 2;
export const HOTZONE_LOOT = ["crystal", "core", "rune"] as const;

// ---------- mutations ----------
export const MUTATIONS: Record<string, { name: string; icon: string; good: string; bad: string }> = {
  stone: { name: "Kivisoomus", icon: "🪨", good: "+5 kaitset", bad: "iga rännak +5 ⚡" },
  nighteye: { name: "Öösilm", icon: "👁️", good: "öösel +20% kahju", bad: "päeval −10% kahju" },
  fangs: { name: "Kihvad", icon: "🦷", good: "toores liha ei kiirita ja ravib 10 HP", bad: "—" },
};
export const MUT_CHANCE = 0.1;
export const MUT_RAD = 80;
export const LIIS_CURE_COST = 300;
export const hasMut = (s: GameState, id: string) => (s.muts || []).includes(id);
export const mutDef = (s: GameState) => (hasMut(s, "stone") ? 5 : 0);
export const mutDmgMult = (s: GameState, night: boolean) => (hasMut(s, "nighteye") ? (night ? 1.2 : 0.9) : 1);

/** Roll for a new mutation after drinking black water or while radiation is above the threshold. */
export function maybeMutate(s: GameState, trigger: boolean, roll = Math.random()): string | null {
  if (!trigger || roll >= MUT_CHANCE) return null;
  const free = Object.keys(MUTATIONS).filter((k) => !hasMut(s, k));
  if (!free.length) return null;
  const id = free[Math.floor(roll / MUT_CHANCE * free.length) % free.length];
  s.muts = [...(s.muts || []), id];
  return id;
}
/** Removes all mutations; via purge potion or Liis at the hospital for cash. */
export function cureMutations(s: GameState, how: "purge" | "liis"): string | null {
  if (!(s.muts || []).length) return "Sul pole mutatsioone.";
  if (how === "purge") {
    if (!s.inv.purge) return "Vajad Puhastusjooki.";
    s.inv.purge--;
  } else {
    if (s.region !== "camp" || !s.structures.hospital) return "Liis ravib ainult laagri haiglas.";
    if ((s.inv.cash || 0) < LIIS_CURE_COST) return `Vajad ${LIIS_CURE_COST} 🪙.`;
    if (!s.npcs.includes("liis")) return "Sa ei tunne veel Liisi.";
    s.inv.cash -= LIIS_CURE_COST;
  }
  s.muts = [];
  return null;
}

// ---------- active base defense ----------
export interface Siege { hp: number; max: number; foe: number; foeMax: number; power: number; turn: number; petReady: number }
export const SIEGE_SCRAP = 2;
export const SIEGE_WOOD = 3;

export function startSiege(s: GameState, power: number) {
  const max = 50 + (s.structures.wall || 0) * 25;
  const foe = Math.round(power * 6);
  s.siege = { hp: max, max, foe, foeMax: foe, power, turn: 0, petReady: 0 };
}

type SiegeAct = "cannon" | "pets" | "repair" | "fight" | "giveup";
/** One siege turn. Returns "win" | "lose" | null (still going) | error string via `err`. */
export function siegeTurn(
  s: GameState, act: SiegeAct, weapon: number, baseDef: number, rnd = Math.random,
): { msg: string[]; end: "win" | "lose" | null; err?: string } {
  const g = s.siege; if (!g) return { msg: [], end: null, err: "Rünnakut pole." };
  const msg: string[] = [];
  if (act === "giveup") { g.hp = 0; return { msg: ["🏳️ Lasid mutandid sisse."], end: "lose" }; }
  if (act === "cannon") {
    const t = s.structures.turret || 0; if (!t) return { msg, end: null, err: "Sul pole kahurit." };
    const inv = s.inv.scrap || 0; const st = s.stash?.scrap || 0;
    if (inv + st < SIEGE_SCRAP) return { msg, end: null, err: `Kahur vajab ${SIEGE_SCRAP} vanametalli.` };
    const fromInv = Math.min(inv, SIEGE_SCRAP); s.inv.scrap = inv - fromInv; if (SIEGE_SCRAP - fromInv) s.stash!.scrap = st - (SIEGE_SCRAP - fromInv);
    const d = 15 + t * 25; g.foe -= d; msg.push(`🎯 Kahur kärgatab hordi sisse: −${d}.`);
  } else if (act === "pets") {
    const pets = (s.pet ? 1 : 0) + (s.kennel?.length || 0);
    if (!pets) return { msg, end: null, err: "Sul pole lemmikuid." };
    if (g.petReady > g.turn) return { msg, end: null, err: "Lemmikud puhkavad veel." };
    const d = 12 + (s.pet?.lvl || 1) * 4 + Math.min(4, s.kennel?.length || 0) * 5; g.foe -= d; g.petReady = g.turn + 2;
    msg.push(`🐾 Lemmikud tormavad kallale: −${d}.`);
  } else if (act === "repair") {
    if ((s.inv.wood || 0) < SIEGE_WOOD) return { msg, end: null, err: `Parandus vajab ${SIEGE_WOOD} puitu.` };
    s.inv.wood -= SIEGE_WOOD; const h = 20; g.hp = Math.min(g.max, g.hp + h); msg.push(`🪵 Lappisid seina: +${h} baasi HP.`);
  } else {
    const d = Math.round(weapon * 1.5); g.foe -= d; msg.push(`⚔️ Lööd müüri tagant: −${d}.`);
  }
  g.turn++;
  if (g.foe <= 0) return { msg, end: "win" };
  const hit = Math.max(2, Math.round(g.power * (0.6 + rnd() * 0.5) - baseDef * 0.3));
  g.hp -= hit; msg.push(`🧟 Hord tagub seina: −${hit} baasi HP.`);
  return { msg, end: g.hp <= 0 ? "lose" : null };
}
