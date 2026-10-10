import { describe, expect, it } from "vitest";
import { newGame } from "../engine";
import { askService, survivorProduce, PROD_CAP } from "../survivors";
const H = 3_600_000;
describe("survivors", () => {
  it("Liis heal has a 12h cooldown", () => {
    const s = newGame(0); s.npcs.push("liis"); s.hp = 10;
    expect(askService(s, "liis", 1000)).toBeNull();
    expect(s.hp).toBe(50);
    expect(askService(s, "liis", 1000 + 11 * H)).not.toBeNull();
    expect(askService(s, "liis", 1000 + 12 * H + 1)).toBeNull();
  });
  it("Liis makes one bandage per 8h, capped at 3 waiting", () => {
    const s = newGame(0); s.npcs.push("liis"); const b = s.inv.bandage || 0;
    survivorProduce(s, 1);
    survivorProduce(s, 1 + 8 * H);
    expect((s.inv.bandage || 0) - b).toBe(1);
    survivorProduce(s, 1 + 1000 * H);
    expect((s.inv.bandage || 0) - b).toBe(1 + PROD_CAP);
  });
});
