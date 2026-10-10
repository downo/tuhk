import { describe, expect, it } from "vitest";
import { newGame, startAction, capacity, armorDef, siegeAct } from "../engine";
import { hotzoneFor, maybeMutate, cureMutations, startSiege } from "../frontier";

describe("vehicles", () => {
  it("bike halves travel energy and adds 10 carry", () => {
    const s = newGame() as any; s.energy = 50; s.discovered.push("ruins");
    const c0 = capacity(s); s.structures.garage = 1; s.inv.bike = 1;
    expect(capacity(s)).toBe(c0 + 10);
    expect(startAction(s, "travel", "x", "ruins")).toBeNull(); expect(s.energy).toBe(45);
  });
  it("buggy travels for 0 energy and burns 1 fuel, +30 carry", () => {
    const s = newGame() as any; s.energy = 50; s.structures.garage = 1; s.inv.buggy = 1; s.inv.fuel = 2;
    const c = capacity(s); delete s.inv.buggy; const c0 = capacity(s); s.inv.buggy = 1; expect(c - c0).toBe(30);
    expect(startAction(s, "travel", "x", "ruins")).toBeNull(); expect(s.energy).toBe(50); expect(s.inv.fuel).toBe(1);
  });
});
describe("hotzone", () => {
  it("picks a dangerous region deterministically per day", () => { expect(hotzoneFor(5)).toBe(hotzoneFor(5)); expect(hotzoneFor(5)).not.toBe("camp"); });
});
describe("mutations", () => {
  it("stone skin gives +5 def; Liis cures for 300 cash", () => {
    const s = newGame() as any; const d = armorDef(s); s.muts = ["stone"]; expect(armorDef(s)).toBe(d + 5);
    s.structures.hospital = 1; s.npcs.push("liis"); s.inv.cash = 300;
    expect(cureMutations(s, "liis")).toBeNull(); expect(s.muts).toEqual([]); expect(s.inv.cash).toBe(0);
  });
  it("no mutation without trigger", () => { const s = newGame() as any; expect(maybeMutate(s, false, 0)).toBeNull(); });
});
describe("siege", () => {
  it("cannon costs 2 scrap; repair costs 3 wood", () => {
    const s = newGame() as any; s.structures.turret = 1; s.inv.scrap = 2; s.inv.wood = 3; startSiege(s, 50);
    expect(siegeAct(s, "cannon")).toBeNull(); expect(s.inv.scrap || 0).toBe(0);
    expect(siegeAct(s, "repair")).toBeNull(); expect(s.inv.wood).toBe(0);
  });
});
