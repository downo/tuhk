import { describe, expect, it } from "vitest";
import { automationOn, buyInsurance, combatAct, insuranceCost, newGame, tick } from "../engine";

describe("insurance & escape", () => {
  it("insurance costs 30 + 5 per level and is only sold at camp", () => {
    const s = newGame() as any; s.level = 4; expect(insuranceCost(s)).toBe(50);
    s.inv.cash = 100; s.region = "forest"; expect(buyInsurance(s)).not.toBeNull();
    s.region = "camp"; expect(buyInsurance(s)).toBeNull(); expect(s.inv.cash).toBe(50); expect(s.insured).toBe(true);
  });
  it("insured death loses 15% instead of half", () => {
    const s = newGame() as any; s.inv = { wood: 20 }; s.insured = true; s.hp = 1; s.maxHp = 100;
    s.combat = { enemy: "ratdog", hp: 999, defending: false, intent: "swipe" };
    for (let i = 0; i < 50 && s.combat; i++) combatAct(s, "attack");
    expect(s.inv.wood).toBe(17); expect(s.insured).toBe(false);
  });
  it("sure escape costs 20 energy and always works", () => {
    const s = newGame() as any; s.energy = 50; s.combat = { enemy: "ratdog", hp: 999, defending: false, intent: "swipe" };
    combatAct(s, "escape"); expect(s.combat).toBeNull(); expect(s.energy).toBe(30);
  });
});
describe("automation", () => {
  it("unlocks at level 15 or a faction at 2000 rep", () => {
    const s = newGame() as any; expect(automationOn(s)).toBe(false);
    s.level = 15; expect(automationOn(s)).toBe(true);
    s.level = 3; s.rep = { order: 2000 }; expect(automationOn(s)).toBe(true);
  });
  it("campfire cooks fish while away", () => {
    const s = newGame() as any; s.level = 15; s.structures.campfire = 1; s.inv.fish = 2; const now = s.lastProduce + 120_000 * 3;
    tick(s, now); expect(s.inv.fish || 0).toBe(0); expect(s.inv.cooked).toBeGreaterThanOrEqual(2);
  });
});
