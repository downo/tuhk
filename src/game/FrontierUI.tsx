import { ITEMS, REGIONS } from "./data";
import { SCENE_IMG, VEHICLE_IMG } from "./portraits";
const px = { imageRendering: "pixelated" as const };
import { clock, siegeAct, isHotzone, type GameState } from "./engine";
import { MUTATIONS, LIIS_CURE_COST, SIEGE_SCRAP, SIEGE_WOOD, activeVehicle, cureMutations, hotzoneFor, hotzoneName, vehicleCarry } from "./frontier";

type Mut = (fn: (g: GameState) => string | null | void) => void;

/** Active base defense: the player commands the base instead of swinging a weapon. */
export function SiegePanel({ s, mut }: { s: GameState; mut: Mut }) {
  const g = s.siege!; const pets = (s.pet ? 1 : 0) + (s.kennel?.length || 0);
  const scrap = (s.inv.scrap || 0) + (s.stash?.scrap || 0);
  return (
    <div className="px-panel border-destructive p-3">
      {SCENE_IMG.siege && <img src={SCENE_IMG.siege} alt="Hord ründab baasi" className="mb-2 h-36 w-full border-2 border-border object-cover" style={px} />}
      <div className="px-title text-destructive">🚨 BAASI KAITSE — hord ründab</div>
      <div className="mt-2 text-base">🧟 Hord {Math.max(0, g.foe)}/{g.foeMax}</div>
      <div className="px-bar text-destructive"><span style={{ width: `${Math.max(0, g.foe / g.foeMax) * 100}%` }} /></div>
      <div className="mt-1 text-base">🏰 Baas {Math.max(0, g.hp)}/{g.max}</div>
      <div className="px-bar text-primary"><span style={{ width: `${Math.max(0, g.hp / g.max) * 100}%` }} /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="px-btn px-btn-primary px-btn-wrap" disabled={!s.structures.turret || scrap < SIEGE_SCRAP} onClick={() => mut((x) => siegeAct(x, "cannon"))}>🎯 Lae kahureid (−{SIEGE_SCRAP} vanametalli)</button>
        <button className="px-btn px-btn-wrap" disabled={!pets || g.petReady > g.turn} onClick={() => mut((x) => siegeAct(x, "pets"))}>🐾 Lase lemmikud lahti{g.petReady > g.turn ? " (puhkavad)" : ""}</button>
        <button className="px-btn px-btn-wrap" disabled={(s.inv.wood || 0) < SIEGE_WOOD} onClick={() => mut((x) => siegeAct(x, "repair"))}>🪵 Paranda seina (−{SIEGE_WOOD} puitu)</button>
        <button className="px-btn px-btn-wrap" onClick={() => mut((x) => siegeAct(x, "fight"))}>⚔️ Võitle müüri tagant</button>
        <button className="px-btn px-btn-danger px-btn-wrap" onClick={() => mut((x) => siegeAct(x, "giveup"))}>🏳️ Anna alla</button>
      </div>
      <p className="mt-2 text-base text-muted-foreground">Võit: hord lahkub tühjade kätega. Kui baasi HP langeb nulli, riisuvad nad osa varusid (ehitised jäävad terveks).</p>
    </div>
  );
}

/** Map-side info: today's anomaly, current vehicle and mutations with cures. */
export function FrontierPanel({ s, mut }: { s: GameState; mut: Mut }) {
  const day = clock(s).day; const hz = REGIONS[hotzoneFor(day)]; const v = activeVehicle(s);
  const muts = s.muts || [];
  const vImg = VEHICLE_IMG[v ?? (s.inv.buggy ? "buggy" : "bike")];
  return (
    <div className="frontier-grid">
      <section className={`info-card info-card-danger ${isHotzone(s) ? "pulse" : ""}`}>
        {SCENE_IMG.anomaly && <img src={SCENE_IMG.anomaly} alt="" loading="lazy" className="info-thumb" style={px} />}
        <div className="min-w-0">
          <div className="info-kicker text-destructive">🔴 Anomaalia täna</div>
          <div className="font-bold">{hotzoneName(day)}</div>
          <div className="text-sm text-muted-foreground">{s.discovered.includes(hz.id) ? `${hz.icon} ${hz.name}` : "❓ tundmatu ala"} · oht +2 · kindel haruldane saak</div>
        </div>
      </section>
      <section className="info-card info-card-accent">
        {vImg && <img src={vImg} alt="" loading="lazy" className={`info-thumb ${v ? "" : "opacity-40 grayscale"}`} style={px} />}
        <div className="min-w-0">
          <div className="info-kicker text-accent">🚗 Sõiduk</div>
          <div className="font-bold">{v === "buggy" ? "Tuhabagi" : v === "bike" ? "Romuratas" : "Jalgsi"}</div>
          <div className="text-sm text-muted-foreground">{!s.structures.garage ? "Ehita Garaaž (pärast Sepikoda)." : v === "buggy" ? `0 ⚡ rännak · ⛽ ${s.inv.fuel || 0} · 🔋 ${s.inv.core || 0}` : v === "bike" ? "rännak −50% ⚡" : "Valmista sõiduk garaažis."}{vehicleCarry(s) ? ` · +${vehicleCarry(s)} kandevõime` : ""}</div>
        </div>
      </section>
      <section className="info-card info-card-magic">
        {SCENE_IMG.mutation && <img src={SCENE_IMG.mutation} alt="" loading="lazy" className={`info-thumb ${muts.length ? "" : "opacity-40 grayscale"}`} style={px} />}
        <div className="min-w-0">
          <div className="info-kicker text-magic">🧬 Mutatsioonid</div>
          {!muts.length ? <><div className="font-bold">Puudub</div><div className="text-sm text-muted-foreground">Kiirgus üle 80 või must vesi võivad sind muuta.</div></> : <>
            <ul className="text-sm">{muts.map((m) => <li key={m}><b>{MUTATIONS[m].icon} {MUTATIONS[m].name}</b> <span className="text-muted-foreground">{MUTATIONS[m].good}{MUTATIONS[m].bad !== "—" ? `, ${MUTATIONS[m].bad}` : ""}</span></li>)}</ul>
            <div className="mt-1 flex flex-wrap gap-1">
              <button className="px-btn px-btn-wrap" disabled={!s.inv.purge} onClick={() => mut((g) => cureMutations(g, "purge"))}>🧪 Jook ({s.inv.purge || 0})</button>
              <button className="px-btn px-btn-wrap" disabled={s.region !== "camp" || !s.structures.hospital || (s.inv.cash || 0) < LIIS_CURE_COST} onClick={() => mut((g) => cureMutations(g, "liis"))}>👩‍🔧 Liis ({LIIS_CURE_COST} 🪙)</button>
            </div></>}
        </div>
      </section>
    </div>
  );
}
