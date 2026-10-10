import { describe, it, expect } from "vitest";
import { newGame, save, loadSave, wipe, migrateSave } from "../engine";

describe("server-only save", () => {
  it("save() writes nothing to localStorage (server save is the only source)", () => {
    localStorage.clear();
    save(newGame());
    expect(localStorage.getItem("tuhk-save-v1")).toBeNull();
  });

  it("loadSave() never returns a local copy, even if one exists", () => {
    localStorage.setItem("tuhk-save-v1", JSON.stringify(newGame()));
    expect(loadSave()).toBeNull();
    wipe();
    expect(localStorage.getItem("tuhk-save-v1")).toBeNull();
  });

  it("migrateSave() clears the transient fx banner so a refresh never replays KATKESTATUD", () => {
    const g = newGame();
    g.fx = { k: "interrupt", t: Date.now() };
    const loaded = migrateSave(JSON.parse(JSON.stringify(g)));
    expect(loaded.fx).toBeUndefined();
  });
});
