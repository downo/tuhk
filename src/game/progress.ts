import { factionBonus } from "./factions";
// Character perks, rare relics (items with random affixes) and multi-stage expeditions.
import { ITEMS, NPCS, REGIONS } from "./data";
import { SURVIVORS, companionCanUse } from "./survivors";
import { territoryBonus } from "./world";
import { add, armorDef, canStart, useItem, weaponDmg, gainXp, gameLog as log, weekKey, type GameState } from "./engine";

const rnd = Math.random;

// ---------- perks (skill tree) ----------
export interface Perk { id: string; branch: string; tier: number; name: string; icon: string; desc: string; minLevel: number }
export const BRANCHES = [
  { id: "fighter", name: "Võitleja", icon: "⚔️" },
  { id: "scav", name: "Korjaja", icon: "🪓" },
  { id: "wander", name: "Rändur", icon: "🧭" },
  { id: "surv", name: "Ellujääja", icon: "🔥" },
] as const;
/** Tier → minimum level and point cost. Points come every 2nd level, so a full tree takes a long time. */
export const TIER_LEVEL = [0, 2, 5, 9, 14, 20];
export const TIER_COST = [0, 1, 1, 2, 2, 3];
const P = (id: string, branch: string, tier: number, name: string, icon: string, desc: string): Perk => ({ id, branch, tier, name, icon, desc, minLevel: TIER_LEVEL[tier] });
export const PERKS: Perk[] = [
  P("f1", "fighter", 1, "Raske käsi", "👊", "+2 kahju igas löögis."),
  P("f2", "fighter", 2, "Paks nahk", "🛡️", "+2 kaitset."),
  P("f3", "fighter", 3, "Verejanu", "🩸", "Iga võit taastab 8 HP."),
  P("f4", "fighter", 4, "Lahingurütm", "🥁", "Veel +3 kahju."),
  P("f5", "fighter", 5, "Raudne tahe", "🗿", "+4 kaitset ja võit taastab veel 6 HP."),
  P("s1", "scav", 1, "Terav silm", "👁️", "+15% kogumissaaki."),
  P("s2", "scav", 2, "Sügavad taskud", "🎒", "Veel +15% kogumissaaki."),
  P("s3", "scav", 3, "Aardeküti vaist", "💎", "Haruldasi esemeid leiad 2× sagedamini."),
  P("s4", "scav", 4, "Romumeister", "🔩", "Veel +20% kogumissaaki."),
  P("s5", "scav", 5, "Tuhaprohvet", "🔮", "Haruldasi leiad veel 1,5× sagedamini."),
  P("w1", "wander", 1, "Kiire õppija", "📚", "+10% kogemust (XP)."),
  P("w2", "wander", 2, "Ettevaatlik samm", "🥾", "Retkedel saad 30% vähem kahju."),
  P("w3", "wander", 3, "Retkejuht", "🗺️", "Retkede saak +50%."),
  P("w4", "wander", 4, "Vana rebane", "🦊", "Veel +10% XP."),
  P("w5", "wander", 5, "Teeraja legend", "🌄", "Retkedel veel 30% vähem kahju ja saak +30%."),
  P("u1", "surv", 1, "Kõhn kõht", "🍂", "Nälg ja janu kasvavad 15% aeglasemalt."),
  P("u2", "surv", 2, "Välipraktik", "🩹", "Iga võit taastab 5 HP."),
  P("u3", "surv", 3, "Kaameli kurk", "🐪", "Nälg ja janu veel 15% aeglasemalt."),
  P("u4", "surv", 4, "Tuhakindel", "🧱", "+3 kaitset."),
  P("u5", "surv", 5, "Viimane ellujääja", "🔥", "+10% saaki ja +10% XP."),
];
export const hasPerk = (s: GameState, id: string) => (s.perks || []).includes(id);
export const perkCost = (p: Perk) => TIER_COST[p.tier] || 1;
const spent = (s: GameState) => (s.perks || []).reduce((t, id) => { const p = PERKS.find((x) => x.id === id); return t + (p ? perkCost(p) : 1); }, 0);
/** One point every second level (lvl 2, 4, 6 ...). */
export const perkPoints = (s: GameState) => Math.max(0, Math.floor(s.level / 2) - spent(s));
export function perkBlocked(s: GameState, p: Perk): string | null {
  if (hasPerk(s, p.id)) return "Juba õpitud.";
  if (s.level < p.minLevel) return `Vajab taset ${p.minLevel}.`;
  const prev = PERKS.find((x) => x.branch === p.branch && x.tier === p.tier - 1);
  if (prev && !hasPerk(s, prev.id)) return `Õpi enne: ${prev.name}.`;
  if (perkPoints(s) < perkCost(p)) return `Vajab ${perkCost(p)} punkti.`;
  return null;
}
export function learnPerk(s: GameState, id: string): string | null {
  const p = PERKS.find((x) => x.id === id); if (!p) return "Tundmatu oskus.";
  const err = perkBlocked(s, p); if (err) return err;
  s.perks = [...(s.perks || []), id];
  log(s, `${p.icon} Õppisid uue oskuse: ${p.name} — ${p.desc}`, "good");
  return null;
}

// ---------- relics (rare loot with affixes) ----------
export type Rarity = "rare" | "epic" | "legendary";
export type AffixKey = "dmg" | "def" | "gather" | "xp" | "heal";
export interface Relic { uid: string; base: string; rarity: Rarity; affixes: Partial<Record<AffixKey, number>> }
export const RARITY: Record<Rarity, { name: string; n: number; color: string }> = {
  rare: { name: "Haruldane", n: 1, color: "text-primary" },
  epic: { name: "Eepiline", n: 2, color: "text-accent" },
  legendary: { name: "Legendaarne", n: 3, color: "text-destructive" },
};
const BASES: Record<string, { name: string; icon: string }> = {
  amulet: { name: "Kiirgusamulett", icon: "📿" }, ring: { name: "Roostes sõrmus", icon: "💍" },
  shard: { name: "Lõhekild", icon: "🔮" }, badge: { name: "KOIDIKu märk", icon: "🎖️" }, fang: { name: "Mutandihammas", icon: "🦷" },
};
export const AFFIX: Record<AffixKey, { label: (v: number) => string; roll: () => number }> = {
  dmg: { label: (v) => `+${v} kahju`, roll: () => 1 + Math.floor(rnd() * 4) },
  def: { label: (v) => `+${v} kaitset`, roll: () => 1 + Math.floor(rnd() * 3) },
  gather: { label: (v) => `+${v}% kogumissaaki`, roll: () => 5 + Math.floor(rnd() * 16) },
  xp: { label: (v) => `+${v}% XP`, roll: () => 5 + Math.floor(rnd() * 11) },
  heal: { label: (v) => `+${v} HP iga võidu järel`, roll: () => 2 + Math.floor(rnd() * 5) },
};
export const relicName = (r: Relic) => `${BASES[r.base].icon} ${BASES[r.base].name}`;
export const MAX_RELICS = 12;

export function makeRelic(boost = 0): Relic {
  const roll = rnd() + boost;
  const rarity: Rarity = roll > 0.95 ? "legendary" : roll > 0.7 ? "epic" : "rare";
  const keys = (Object.keys(AFFIX) as AffixKey[]).sort(() => rnd() - 0.5).slice(0, RARITY[rarity].n);
  const mult = rarity === "legendary" ? 1.5 : 1;
  const affixes: Relic["affixes"] = {};
  for (const k of keys) affixes[k] = Math.round(AFFIX[k].roll() * mult);
  const bases = Object.keys(BASES);
  return { uid: Math.random().toString(36).slice(2, 9), base: bases[Math.floor(rnd() * bases.length)], rarity, affixes };
}
/** Chance-based relic drop; returns true when one was found. */
export function maybeRelic(s: GameState, chance: number, boost = 0): boolean {
  const c = chance * (hasPerk(s, "s3") ? 2 : 1) * (hasPerk(s, "s5") ? 1.5 : 1);
  if (rnd() >= c) return false;
  giveRelic(s, makeRelic(boost));
  return true;
}
export function giveRelic(s: GameState, r: Relic) {
  s.relics = s.relics || [];
  if (s.relics.length >= MAX_RELICS) { add(s, "cash", 15); log(s, `✨ Leidsid ${RARITY[r.rarity].name.toLowerCase()} eseme, kuid kott on täis — müüsid selle 15 🪙 eest.`, "loot"); return; }
  s.relics.push(r);
  log(s, `✨ ${RARITY[r.rarity].name.toUpperCase()} LEID: ${relicName(r)} (${Object.entries(r.affixes).map(([k, v]) => AFFIX[k as AffixKey].label(v!)).join(", ")}). Kanna seda: 🎒 Inventar → Talismanid.`, "loot");
}
export function wearRelic(s: GameState, uid: string | null) { s.charm = uid; }
export function scrapRelic(s: GameState, uid: string): string | null {
  const i = (s.relics || []).findIndex((r) => r.uid === uid); if (i < 0) return "Pole sellist.";
  const r = s.relics[i]; s.relics.splice(i, 1); if (s.charm === uid) s.charm = null;
  const pay = r.rarity === "legendary" ? 60 : r.rarity === "epic" ? 30 : 12;
  add(s, "cash", pay); log(s, `Müüsid ${relicName(r)} — +${pay} 🪙`, "info");
  return null;
}
export const wornRelic = (s: GameState) => (s.relics || []).find((r) => r.uid === s.charm) || null;

/** Summed bonuses from perks and the worn relic. Used by engine formulas. */
export function bonus(s: GameState) {
  const a = wornRelic(s)?.affixes || {}; const t = territoryBonus(s); const fb = factionBonus(s);
  return {
    dmg: (hasPerk(s, "f1") ? 2 : 0) + (hasPerk(s, "f4") ? 3 : 0) + (a.dmg || 0) + t.dmg + fb.dmg,
    def: (hasPerk(s, "f2") ? 2 : 0) + (hasPerk(s, "f5") ? 4 : 0) + (hasPerk(s, "u4") ? 3 : 0) + (a.def || 0) + t.def + fb.def,
    gather: (hasPerk(s, "s1") ? 0.15 : 0) + (hasPerk(s, "s2") ? 0.15 : 0) + (hasPerk(s, "s4") ? 0.2 : 0) + (hasPerk(s, "u5") ? 0.1 : 0) + (a.gather || 0) / 100 + t.gather + fb.gather,
    xp: (hasPerk(s, "w1") ? 0.1 : 0) + (hasPerk(s, "w4") ? 0.1 : 0) + (hasPerk(s, "u5") ? 0.1 : 0) + (a.xp || 0) / 100 + t.xp + fb.xp,
    needs: (hasPerk(s, "u1") ? 0.15 : 0) + (hasPerk(s, "u3") ? 0.15 : 0),
    heal: (hasPerk(s, "f3") ? 8 : 0) + (hasPerk(s, "f5") ? 6 : 0) + (hasPerk(s, "u2") ? 5 : 0) + (a.heal || 0) + fb.heal,
  };
}

// ---------- expeditions ----------
export interface Expedition { id: string; name: string; icon: string; region: string; stages: number; danger: number; loot: [string, number][]; desc: string }
export const EXPEDITIONS: Expedition[] = ([
  { id: "x_forest", name: "Sügav mets", icon: "🌲", region: "forest", stages: 5, danger: 1.3, loot: [["wood", 4], ["herb", 2], ["meat", 2], ["hide", 1]], desc: "Retk metsa südamesse." },
  { id: "x_ruins", name: "Varemete keldrid", icon: "🏚️", region: "ruins", stages: 6, danger: 1.9, loot: [["scrap", 4], ["cloth", 2], ["wire", 2], ["can", 1]], desc: "Keldrid, kuhu keegi pole ammu läinud." },
  { id: "x_mine", name: "Hüljatud šaht", icon: "⛏️", region: "mine", stages: 7, danger: 2.6, loot: [["ore", 3], ["stone", 4], ["crystal", 1]], desc: "Rauamaak ja harva kristallid. Ja pimedus." },
  { id: "x_city", name: "Surnud linn", icon: "🏙️", region: "city", stages: 8, danger: 3.4, loot: [["scrap", 5], ["wire", 3], ["antirad", 1], ["can", 2]], desc: "Pikk ja ohtlik. Hea saak." },
  { id: "x_peak", name: "Observatooriumi tipp", icon: "🏔️", region: "mountains", stages: 10, danger: 4.2, loot: [["ore", 4], ["crystal", 2], ["rune", 1], ["herb", 2]], desc: "Pikk tõus läbi lumetormi vanasse observatooriumi. Kaljud ja golemid ei andesta." },
  { id: "x_rift", name: "Lõhe serv", icon: "🌀", region: "depths3", stages: 11, danger: 5, loot: [["crystal", 2], ["voidshard", 1], ["ore", 3]], desc: "Lõhe äär, kus maailm hõreneb. Lõpus ootab legendaarne leid." },
  { id: "x_core", name: "KOIDIKU reaktor", icon: "☢️", region: "radiation", stages: 13, danger: 6, loot: [["core", 2], ["crystal", 2], ["voidshard", 1], ["antirad", 1]], desc: "Kõige raskem retk: reaktori südamikku. Kiirgus ja valvurid. Võta kaasa ravimeid." },
] as Expedition[]).filter((x) => REGIONS[x.region]);
export const EXP_GEAR: Record<string, string> = { x_forest: "hideboots", x_ruins: "scraphelm", x_mine: "minerhelm", x_city: "steelboots", x_rift: "voidboots", x_peak: "steelboots", x_core: "voidboots" };
export const EXP_WEEK_GOAL = 5;
export const EXP_ENERGY = 8;
export type ExpPending =
  | { kind: "choice"; ev: string }
  | { kind: "ambush"; foe: string; hp: number; atk: number }
  | { kind: "lock"; tier: number };
export interface ExpRun { id: string; stage: number; loot: Record<string, number>; log: string[]; pending?: ExpPending | null; comp?: string; compUsed?: boolean; campAt?: number }

/** Interactive stage events: each option is resolved by the engine, never by the UI. */
export interface ExpChoice { label: string; hint: string; need?: string }
export const EXP_EVENTS: Record<string, { text: string; options: ExpChoice[] }> = {
  bunker: { text: "Leiad maasse kaevatud punkri raudukse. Lukk on roostes, kuid kindel.", options: [
    { label: "🔧 Muugi lahti", hint: "Vigastuse oht, tavaline saak" },
    { label: "⚛️ Lõhu tuumikuga", hint: "Kulutab 1 tuumiku: täiesti ohutu ja palju parem saak", need: "core" },
    { label: "🚶 Kõnni minema", hint: "Midagi ei juhtu" }] },
  car: { text: "Märkad mahajäetud autot, mille uks on irvakil. Seest kostab vaikset krabinat.", options: [
    { label: "🔦 Otsi auto läbi", hint: "Risk vigastuseks või kiirguseks, võimalus haruldaseks leiuks" },
    { label: "🥾 Hiili mööda", hint: "−4 ⚡, ohutu" },
    { label: "🪨 Viska kivi", hint: "Selgub, kas seal on keegi" }] },
  body: { text: "Teeäärsel kraavil lebab rändur. Seljakott on veel seljas — rinnakorv aga liigub nõrgalt.", options: [
    { label: "🩹 Aita teda", hint: "Kulutab sideme, võib tänuks midagi anda" },
    { label: "🎒 Võta seljakott", hint: "Kindel saak, aga südametunnistus…" },
    { label: "🚶 Jäta rahule", hint: "Midagi ei juhtu" }] },
  well: { text: "Vana kaevu põhjas helgib midagi. Köis on mädanenud, kivid libedad.", options: [
    { label: "🧗 Roni alla", hint: "Kukkumise oht, hea leid" },
    { label: "🪝 Õngitse köiega", hint: "Ohutu, väiksem saak" },
    { label: "🚶 Mine edasi", hint: "Midagi ei juhtu" }] },
  glow: { text: "Lombist kerkib roheline kuma. Selle keskel lebab kristallitükk.", options: [
    { label: "✋ Haara kiiresti", hint: "Palju kiirgust, kristall" },
    { label: "🧤 Kaevu ettevaatlikult", hint: "−6 ⚡, vähem kiirgust" },
    { label: "🚶 Ära puutu", hint: "Ohutu" }] },
  trader: { text: "Hägust kerkib kapuutsiga kaupmees. „Vahetame? Midagi head, midagi kiiret.”", options: [
    { label: "🪙 Maksa 15 münti", hint: "Juhuslik hea kaup" },
    { label: "🔁 Vaheta osa saagist", hint: "Üks kaasas olev ese ravimi vastu" },
    { label: "👋 Keeldu", hint: "Midagi ei juhtu" }] },
  noise: { text: "Kaugelt kostab metalset kolinat — keegi tuleb sinu poole.", options: [
    { label: "🫥 Peida end", hint: "−4 ⚡, võib ebaõnnestuda" },
    { label: "⚔️ Sea varitsus", hint: "Lahing, aga sina lööd esimesena" },
    { label: "🏃 Kiirusta edasi", hint: "Ohutu, kuid −8 ⚡" }] },
};
const FOES: [string, number, number][] = [["🐕 Mutantkoer", 18, 5], ["🦂 Kiirgusskorpion", 26, 7], ["🧟 Hõõguv laip", 34, 8], ["🔫 Röövlite jõuk", 44, 10], ["🗿 Kivigolem", 58, 12], ["🤖 KOIDIKU valvur", 72, 14]];
export const LURE = "meat";

export const expAvailable = (s: GameState, x: Expedition) => s.discovered.includes(x.region);
export const expWeekCount = (s: GameState) => (s.expWeek?.week === weekKey(new Date()) ? s.expWeek.n : 0);

export function startExpedition(s: GameState, id: string, comp?: string): string | null {
  const x = EXPEDITIONS.find((e) => e.id === id); if (!x) return "Tundmatu retk.";
  if (s.exp) return "Oled juba retkel.";
  if (!canStart(s)) return "Oled hõivatud.";
  if (!expAvailable(s, x)) return `Avasta enne ${REGIONS[x.region].name}.`;
  if (s.energy < EXP_ENERGY * 2) return "Liiga väsinud. Puhka enne.";
  const c = comp && s.npcs.includes(comp) && SURVIVORS[comp] ? comp : undefined;
  s.exp = { id, stage: 0, loot: {}, log: [`${x.icon} Alustasid retke: ${x.name}.${c ? ` Kaaslane: ${NPCS[c].name}.` : ""}`], comp: c };
  log(s, `${x.icon} Alustasid ekspeditsiooni: ${x.name} (${x.stages} etappi).`, "info");
  return null;
}

/** Push one stage deeper. Risk and reward grow with every stage. */
export function expAdvance(s: GameState): string | null {
  const r = s.exp; if (!r) return "Pole retkel.";
  const x = EXPEDITIONS.find((e) => e.id === r.id)!;
  if (r.pending) return "Lahenda enne praegune olukord.";
  if (s.energy < EXP_ENERGY) return "Liiga väsinud edasi minna. Pöördu tagasi.";
  s.energy -= EXP_ENERGY; r.stage++;
  const depth = 1 + (r.stage - 1) * 0.35;
  const roll = rnd();
  if (roll < 0.34) {
    expFind(s, r, x, depth, `Etapp ${r.stage}: leidsid`);
  } else if (roll < 0.52) {
    const keys = Object.keys(EXP_EVENTS); const ev = keys[Math.floor(rnd() * keys.length)];
    r.pending = { kind: "choice", ev }; r.log.push(`Etapp ${r.stage}: ${EXP_EVENTS[ev].text}`);
  } else if (roll < 0.8) {
    makeAmbush(r, x, depth); r.log.push(`Etapp ${r.stage}: varitsus! ${(r.pending as unknown as { foe: string }).foe} astub teele.`);
  } else if (roll < 0.86) {
    const rad = Math.round(4 * x.danger); s.rad = Math.min(100, s.rad + rad);
    r.log.push(`Etapp ${r.stage}: kiirgustasku. +${rad} kiirgust.`);
  } else if (roll < 0.95) {
    r.pending = { kind: "lock", tier: Math.min(3, Math.ceil(x.danger)) };
    r.log.push(`Etapp ${r.stage}: lukustatud seif! Muugi see lahti.`);
  } else {
    r.log.push(`Etapp ${r.stage}: peidik!`);
    giveRelic(s, makeRelic(x.danger * 0.05));
  }
  gainXp(s, Math.round(5 * x.danger * depth), "exploration");
  return expAfter(s, r, x);
}

const lootMultOf = (s: GameState, depth: number) => depth * (hasPerk(s, "w3") ? 1.5 : 1) * (hasPerk(s, "w5") ? 1.3 : 1);
function expFind(s: GameState, r: ExpRun, x: Expedition, depth: number, prefix: string, mult = 1) {
  const [id, max] = x.loot[Math.floor(rnd() * x.loot.length)];
  const n = Math.max(1, Math.round((1 + rnd() * max) * Math.min(2.2, 1 + (lootMultOf(s, depth) - 1) * 0.5) * mult));
  r.loot[id] = (r.loot[id] || 0) + n;
  r.log.push(`${prefix} ${ITEMS[id]?.icon ?? ""} ${ITEMS[id]?.name ?? id} ×${n}.`);
}
function makeAmbush(r: ExpRun, x: Expedition, depth: number) {
  const f = FOES[Math.min(FOES.length - 1, Math.floor(x.danger - 1 + rnd() * 1.5))];
  r.pending = { kind: "ambush", foe: f[0], hp: Math.round(f[1] * depth * (0.8 + x.danger * 0.2)), atk: Math.round(f[2] * (0.6 + x.danger * 0.25) * depth) };
}
const expDepth = (r: ExpRun) => 1 + (r.stage - 1) * 0.35;
const hurt = (s: GameState, raw: number) => {
  const dmg = Math.max(1, Math.round((raw - armorDef(s) * 0.5) * (hasPerk(s, "w2") ? 0.7 : 1) * (hasPerk(s, "w5") ? 0.7 : 1)));
  s.hp -= dmg; return dmg;
};

/** Called after every stage action: handles death and reaching the end. */
function expAfter(s: GameState, r: ExpRun, x: Expedition): string | null {
  if (s.hp <= 0) {
    s.hp = 1; s.exp = null;
    if (s.insured) {
      // Insurance: keep half of the expedition haul, policy is used up.
      s.insured = false;
      const kept = Object.entries(r.loot || {}).map(([k, v]) => [k, Math.floor(v / 2)] as const).filter(([, v]) => v > 0);
      kept.forEach(([k, v]) => { s.inv[k] = (s.inv[k] || 0) + v; });
      log(s, `💀 Ekspeditsioon ${x.name} lõppes katastroofiga. 📜 Kindlustus päästis poole saagist${kept.length ? ": " + kept.map(([k, v]) => `${ITEMS[k]?.icon ?? k}${v}`).join(" ") : ""}.`, "bad");
    } else log(s, `💀 Ekspeditsioon ${x.name} lõppes katastroofiga. Roomasid tagasi peaaegu surnuna — kogu retke saak jäi maha.`, "bad");
    s.hp = Math.max(1, Math.round(s.maxHp * 0.15));
    return null;
  }
  if (r.stage >= x.stages && !r.pending) {
    r.log.push("Jõudsid retke lõppu!");
    giveRelic(s, makeRelic(x.id === "x_rift" ? 0.3 : x.danger * 0.06));
    const gear = EXP_GEAR[x.id]; if (gear && rnd() < 0.4) { r.loot[gear] = (r.loot[gear] || 0) + 1; r.log.push(`Leidsid varustuse: ${ITEMS[gear]?.icon ?? ""} ${ITEMS[gear]?.name ?? gear}!`); }
    return finishExp(s, true);
  }
  return null;
}

/** Companion ability, once per expedition. */
export function expCompanion(s: GameState): string | null {
  const r = s.exp; if (!r || !companionCanUse(s)) return "Kaaslane ei saa praegu aidata.";
  const x = EXPEDITIONS.find((e) => e.id === r.id)!;
  r.compUsed = true;
  if (r.comp === "liis") { const h = Math.round(s.maxHp * 0.3); s.hp = Math.min(s.maxHp, s.hp + h); r.log.push(`🩹 Liis sidus su haavad. +${h} HP.`); }
  else if (r.comp === "mirko") { s.energy = Math.min(100, s.energy + 15); r.log.push("🗺️ Mirko näitas otseteed. +15 ⚡."); }
  else if (r.comp === "kid") expFind(s, r, x, expDepth(r), "👀 Tom märkas peidikut:", 1.2);
  else if (r.comp === "archivist") { r.pending = null; r.log.push("📡 Arhivaar hoiatas õigel ajal — hiilisite vaenlasest mööda."); }
  return expAfter(s, r, x);
}

export function expRetreat(s: GameState): string | null {
  if (!s.exp) return "Pole retkel.";
  if (s.exp.pending?.kind === "ambush") return "Vaenlane on ees — võitle või põgene.";
  s.exp.pending = null; return finishExp(s, false);
}

/** Resolve a choice event (option index 0–2). */
export function expChoose(s: GameState, opt: number): string | null {
  const r = s.exp; const p = r?.pending; if (!r || !p || p.kind !== "choice") return "Pole valikut.";
  const x = EXPEDITIONS.find((e) => e.id === r.id)!; const d = expDepth(r); const L = (t: string) => r.log.push(`→ ${t}`);
  r.pending = null;
  const tire = (n: number) => { s.energy = Math.max(0, s.energy - n); };
  switch (p.ev) {
    case "car":
      if (opt === 0) { const q = rnd(); if (q < 0.35) { L(`Rott hüppas näkku! −${hurt(s, 6 * x.danger * d)} HP.`); } else if (q < 0.5) { const rad = Math.round(5 * x.danger); s.rad = Math.min(100, s.rad + rad); L(`Pagasnik lekib. +${rad} kiirgust.`); } if (rnd() < 0.55) expFind(s, r, x, d, "Kindalaekast:", 1.5); if (rnd() < 0.12) { L("Istme all oli peidetud kast!"); giveRelic(s, makeRelic(x.danger * 0.06)); } }
      else if (opt === 1) { tire(4); L("Hiilisid vaikselt mööda."); }
      else { if (rnd() < 0.5) { L("Krabin vaikis… ja autost lipsas välja mutant!"); makeAmbush(r, x, d * 0.8); } else { L("Ainult tuul. Otsid auto rahulikult läbi."); expFind(s, r, x, d, "Leidsid"); } }
      break;
    case "bunker":
      if (opt === 0) { if (rnd() < 0.5) L(`Kang libises. −${hurt(s, 8 * x.danger * d)} HP.`); if (rnd() < 0.6) expFind(s, r, x, d, "Punkrist:", 1.2); else L("Uks ei andnud järele."); }
      else if (opt === 1) { if (!(s.inv.core > 0)) { r.pending = p; return "Sul pole tuumikut."; } add(s, "core", -1); L("⚛️ Tuumik sulatas luku vaikselt läbi."); expFind(s, r, x, d, "Punkri riiulitelt:", 2.5); if (rnd() < 0.35) giveRelic(s, makeRelic(x.danger * 0.08)); }
      else L("Jätsid punkri rahule.");
      break;
    case "body":
      if (opt === 0) { if ((s.inv.bandage || 0) > 0) { add(s, "bandage", -1); L("Sidusid ränduri haavad."); if (rnd() < 0.7) { const g = rnd() < 0.5 ? "can" : "antirad"; r.loot[g] = (r.loot[g] || 0) + 1; L(`Tänutäheks andis ${ITEMS[g]?.icon} ${ITEMS[g]?.name}.`); } gainXp(s, 10, "medicine"); } else L("Sul pole sidet. Said vaid lohutada."); }
      else if (opt === 1) { expFind(s, r, x, d, "Seljakotis oli", 1.3); if (rnd() < 0.3) L(`Rändur haaras su käest! −${hurt(s, 4 * x.danger)} HP.`); }
      else L("Jätsid ta rahule.");
      break;
    case "well":
      if (opt === 0) { if (rnd() < 0.4) L(`Kivi libises. −${hurt(s, 7 * x.danger * d)} HP.`); expFind(s, r, x, d, "Kaevu põhjast:", 1.8); }
      else if (opt === 1) { if (rnd() < 0.6) expFind(s, r, x, d, "Õngitsesid välja", 0.8); else L("Köis katkes. Midagi ei saanud."); }
      else L("Läksid edasi.");
      break;
    case "glow":
      if (opt === 0) { const rad = Math.round(9 * x.danger); s.rad = Math.min(100, s.rad + rad); r.loot.crystal = (r.loot.crystal || 0) + 1; L(`Said 💎 kristalli. +${rad} kiirgust.`); }
      else if (opt === 1) { tire(6); const rad = Math.round(3 * x.danger); s.rad = Math.min(100, s.rad + rad); if (rnd() < 0.6) { r.loot.crystal = (r.loot.crystal || 0) + 1; L(`Said kristalli. +${rad} kiirgust.`); } else L(`Kristall murenes. +${rad} kiirgust.`); }
      else L("Jätsid kuma rahule.");
      break;
    case "trader":
      if (opt === 0) { if ((s.inv.cash || 0) >= 15) { add(s, "cash", -15); const g = ["medkit", "antirad", "salve", "water"][Math.floor(rnd() * 4)]; r.loot[g] = (r.loot[g] || 0) + 1; L(`Ostsid ${ITEMS[g]?.icon} ${ITEMS[g]?.name}.`); } else L("Sul pole piisavalt münte."); }
      else if (opt === 1) { const k = Object.keys(r.loot).find((q) => r.loot[q] > 0); if (k) { r.loot[k]--; if (!r.loot[k]) delete r.loot[k]; r.loot.bandage = (r.loot.bandage || 0) + 2; L(`Vahetasid ${ITEMS[k]?.icon} kahe 🩹 sideme vastu.`); } else L("Sul pole midagi vahetada."); }
      else L("Kaupmees kadus hägusse.");
      break;
    case "noise":
      if (opt === 0) { tire(4); if (rnd() < 0.65) L("Nad läksid mööda."); else { L("Sind märgati!"); makeAmbush(r, x, d); } }
      else if (opt === 1) { makeAmbush(r, x, d); const a = r.pending as unknown as Extract<ExpPending, { kind: "ambush" }>; a.hp = Math.round(a.hp * 0.6); L("Lõid esimesena — vaenlane on haavatud."); }
      else { tire(8); L("Kiirustasid edasi."); }
      break;
  }
  return expAfter(s, r, x);
}

/** Ambush: 0 = fight, 1 = flee, 2 = throw a lure. */
export function expAmbush(s: GameState, act: number): string | null {
  const r = s.exp; const p = r?.pending; if (!r || !p || p.kind !== "ambush") return "Pole lahingut.";
  const x = EXPEDITIONS.find((e) => e.id === r.id)!; const L = (t: string) => r.log.push(`→ ${t}`);
  if (act === 2) {
    if (!(s.inv[LURE] > 0)) return "Sul pole peibutiseks liha.";
    add(s, LURE, -1); r.pending = null; L(`Viskasid 🥩 liha kõrvale — ${p.foe} tormas sellele järele.`); return expAfter(s, r, x);
  }
  if (act === 1) {
    r.pending = null;
    const k = Object.keys(r.loot); if (k.length && rnd() < 0.6) { const id = k[Math.floor(rnd() * k.length)]; const lost = Math.max(1, Math.ceil(r.loot[id] / 2)); r.loot[id] -= lost; if (r.loot[id] <= 0) delete r.loot[id]; L(`Põgenesid, kuid kukutasid maha ${ITEMS[id]?.icon} ×${lost}.`); }
    else L(`Põgenesid. Vaenlane jõudis siiski lüüa: −${hurt(s, p.atk * 0.6)} HP.`);
    return expAfter(s, r, x);
  }
  let rounds = 0; let taken = 0;
  while (p.hp > 0 && s.hp > 0 && rounds < 3) { p.hp -= Math.round(weaponDmg(s) * (0.8 + rnd() * 0.5)); rounds++; if (p.hp > 0) taken += hurt(s, p.atk * (0.7 + rnd() * 0.6)); }
  if (p.hp <= 0) {
    r.pending = null; gainXp(s, Math.round(8 * x.danger), "combat");
    const [id] = x.loot[0]; r.loot[id] = (r.loot[id] || 0) + 1 + (rnd() < 0.4 ? 1 : 0);
    L(`Võitsid ${p.foe}! −${taken} HP. Said ${ITEMS[id]?.icon} saaki.`);
  } else L(`Raske heitlus: −${taken} HP. ${p.foe} on veel jalul (❤️ ${p.hp}).`);
  return expAfter(s, r, x);
}

/** Lockpick result from the mini-game: hits = 0..3 successful presses. */
export function expLock(s: GameState, hits: number): string | null {
  const r = s.exp; const p = r?.pending; if (!r || !p || p.kind !== "lock") return "Pole seifi.";
  const x = EXPEDITIONS.find((e) => e.id === r.id)!; const d = expDepth(r); const L = (t: string) => r.log.push(`→ ${t}`);
  r.pending = null;
  if (hits >= 3) { L("Lukk avanes täiuslikult!"); expFind(s, r, x, d, "Seifist:", 2); if (rnd() < 0.35) giveRelic(s, makeRelic(x.danger * 0.07)); }
  else if (hits === 2) { L("Lukk andis järele."); expFind(s, r, x, d, "Seifist:", 1.3); }
  else if (hits === 1) { L("Muukraud murdus, said vaid praost sisse piiluda."); if (rnd() < 0.5) expFind(s, r, x, d, "Haarasid", 0.7); }
  else L(`Lõks! Seif sähvatas. −${hurt(s, 5 * x.danger * d)} HP.`);
  return expAfter(s, r, x);
}

export const CAMP_FOOD = ["cooked", "can", "fish", "meat", "berries"];
/** Temporary camp between stages: 2 wood + 1 food → +20 ⚡ and 15% HP, but 30% chance the smell draws an ambush. Once per 3 stages. */
export function expCamp(s: GameState): string | null {
  const r = s.exp; if (!r) return "Pole retkel.";
  if (r.pending) return "Lahenda enne praegune olukord.";
  if (r.stage < 1) return "Liigu enne edasi.";
  if (r.campAt != null && r.stage - r.campAt < 3) return "Laagrit saab teha iga 3 etapi tagant.";
  const food = CAMP_FOOD.find((f) => s.inv[f] > 0);
  if ((s.inv.wood || 0) < 2 || !food) return "Vaja 2 puitu ja 1 toitu.";
  const x = EXPEDITIONS.find((e) => e.id === r.id)!;
  add(s, "wood", -2); add(s, food, -1); r.campAt = r.stage;
  s.energy = Math.min(100, s.energy + 20); s.hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * 0.15));
  r.log.push(`🔥 Tegid ajutise laagri (${ITEMS[food]?.icon}). +20 ⚡, +15% elu.`);
  if (rnd() < 0.3) { makeAmbush(r, x, expDepth(r)); r.log.push(`→ Lõkke lõhn meelitas ligi: ${(r.pending as unknown as { foe: string }).foe}!`); }
  return null;
}

/** Use a consumable from the backpack mid-expedition (not during a fight). */
export function expUse(s: GameState, id: string): string | null {
  const r = s.exp; if (!r) return "Pole retkel.";
  if (r.pending?.kind === "ambush") return "Lahingu ajal ei jõua.";
  if (!(s.inv[id] > 0)) return "Sul pole seda.";
  useItem(s, id); r.log.push(`🎒 Kasutasid: ${ITEMS[id]?.icon} ${ITEMS[id]?.name}.`); return null;
}

function finishExp(s: GameState, full: boolean): null {
  const r = s.exp!; const x = EXPEDITIONS.find((e) => e.id === r.id)!;
  Object.entries(r.loot).forEach(([k, v]) => add(s, k, v));
  const wk = weekKey(new Date());
  if (s.expWeek?.week !== wk) s.expWeek = { week: wk, n: 0, claimed: false };
  if (r.stage > 0) s.expWeek.n++;
  const got = Object.entries(r.loot).map(([k, v]) => `${ITEMS[k]?.icon ?? ""}×${v}`).join(" ") || "mitte midagi";
  if (full) gainXp(s, Math.round(20 * x.danger), "exploration");
  log(s, `${full ? "🏁 Retk lõpetatud" : "↩️ Pöördusid tagasi"}: ${x.name}, ${r.stage}/${x.stages} etappi. Tõid kaasa: ${got}.`, "good");
  s.exp = null;
  return null;
}

export function claimExpWeek(s: GameState): string | null {
  if (expWeekCount(s) < EXP_WEEK_GOAL) return "Nädala eesmärk pole veel täis.";
  if (s.expWeek!.claimed) return "Juba võetud.";
  s.expWeek!.claimed = true;
  add(s, "cash", 40); gainXp(s, 150);
  giveRelic(s, makeRelic(0.25));
  log(s, "🗓️ Nädala retked tehtud! +40 🪙, +150 XP ja eriline leid.", "good");
  return null;
}

/** Reset the skill tree for a fee; all spent points come back. */
export const RESPEC_COST = 500;
export function respecPerks(s: GameState): string | null {
  if (!(s.perks || []).length) return "Sul pole veel ühtegi oskust.";
  if ((s.inv.cash || 0) < RESPEC_COST) return `Vajad ${RESPEC_COST} 🪙.`;
  s.inv.cash -= RESPEC_COST; s.perks = [];
  log(s, `🔄 Oskuspuu nullitud (−${RESPEC_COST} 🪙). Kõik punktid on tagasi — vali uuesti.`, "good");
  return null;
}
