import { describe, expect, it } from "vitest";
import { baseDefense, combatAct, fuelGenerator, newGame } from "../engine";
import { assignJob, recipeCost } from "../survivors";
import { RECIPES } from "../data";
import { expCamp, startExpedition } from "../progress";
const fight = (s: any, intent: string) => { s.hp = 9999; s.maxHp = 9999; s.combat = { enemy: "ratdog", hp: 5000, defending: false, intent }; };

describe("weapon vs intent", () => {
  it("spear doubles the interrupt bonus on charge", () => {
    const a = newGame() as any; a.equip.weapon = "club"; fight(a, "charge");
    const b = newGame() as any; b.equip.weapon = "spear"; fight(b, "charge");
    expect(a.combat.sneak).toBeUndefined();
    combatAct(b, "heavy"); expect(JSON.stringify(b.log)).toContain("Oda ulatus");
  });
  it("club fully blocks a smash", () => {
    const s = newGame() as any; s.equip.weapon = "club"; s.equip.armor = null; fight(s, "smash");
    const hp = s.hp; combatAct(s, "defend"); expect(s.hp).toBe(hp);
  });
});
describe("region hazards", () => {
  it("radiation zone adds 2 rad per combat turn", () => {
    const s = newGame() as any; s.region = "radiation"; s.rad = 0; fight(s, "roar");
    combatAct(s, "defend"); expect(s.rad).toBe(2);
  });
});
describe("sneak", () => {
  it("sneak is only offered once, at the start", () => {
    const s = newGame() as any; fight(s, "swipe"); s.combat.sneak = true;
    combatAct(s, "sneak"); if (s.combat) expect(s.combat.sneak).toBe(false);
  });
});
describe("base", () => {
  it("turret only defends with scrap in the chest", () => {
    const s = newGame() as any; s.structures = { turret: 1 }; s.stash = {};
    const d0 = baseDefense(s); s.stash.scrap = 5; expect(baseDefense(s)).toBe(d0 + 7);
  });
  it("generator: 3 wood = 12 h fuel", () => {
    const s = newGame() as any; s.structures.generator = 1; s.region = "camp"; s.inv.wood = 3; s.genFuel = 0;
    expect(fuelGenerator(s, "wood", 1000)).toBeNull(); expect(s.genFuel).toBe(1000 + 12 * 3_600_000);
  });
  it("archivist in the lab cuts lab recipe costs by 25%", () => {
    const s = newGame() as any; s.npcs.push("archivist"); s.structures.lab = 1;
    const r = RECIPES.find((x) => x.id === "r_blade")!;
    expect(assignJob(s, "archivist", true)).toBeNull();
    expect(recipeCost(s, r).crystal).toBe(Math.ceil(r.cost.crystal * 0.75));
  });
});
describe("expedition camp", () => {
  it("costs 2 wood + 1 food and restores 20 energy", () => {
    const s = newGame() as any; s.energy = 50; s.discovered.push("mine"); expect(startExpedition(s, "x_mine")).toBeNull();
    s.exp.stage = 1; s.inv.wood = 2; s.inv.can = 1; const e = s.energy;
    expect(expCamp(s)).toBeNull(); expect(s.inv.wood || 0).toBe(0); expect(s.energy).toBe(Math.min(100, e + 20));
    expect(expCamp(s)).not.toBeNull();
  });
});
