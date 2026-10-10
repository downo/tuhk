import { describe, expect, it } from "vitest";
import { equipItem, newGame } from "../engine";
describe("level-gated gear", () => {
  it("nailgun needs level 8", () => {
    const s = newGame() as any; s.level = 7; s.inv.nailgun = 1; const before = s.equip.weapon;
    equipItem(s, "nailgun"); expect(s.equip.weapon).toBe(before);
    s.level = 8; equipItem(s, "nailgun"); expect(s.equip.weapon).toBe("nailgun");
  });
});
