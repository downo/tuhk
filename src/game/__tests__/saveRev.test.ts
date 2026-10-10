import { describe, it, expect } from "vitest";
import { acceptsWrite, buildingTotal, rememberServerRev, nextRev, confirmRev } from "../saveRev";

describe("save revisions protect the base", () => {
  it("rejects an upload from an old window that read an older save", () => {
    // stored save is at rev 9, the old window still thinks rev 5 → sends 6
    expect(acceptsWrite(9, 6)).toBe(false);
  });

  it("accepts the next upload from the window that has the latest save", () => {
    expect(acceptsWrite(9, 10)).toBe(true);
  });

  it("accepts the first guarded write over an old save without a revision", () => {
    expect(acceptsWrite(undefined, 1)).toBe(true);
  });

  it("each window counts up from the save it last read", () => {
    rememberServerRev({ rev: 4 });
    expect(nextRev()).toBe(5);
    confirmRev(5);
    expect(nextRev()).toBe(6);
  });

  it("counts building levels so a loss can be detected", () => {
    expect(buildingTotal({ structures: { campfire: 1, wall: 3 } })).toBe(4);
  });
});
