import { NPCS } from "./data";
import { SURVIVORS, companionCanUse } from "./survivors";
import { useEffect, useRef, useState } from "react";
import { ITEMS, REGIONS } from "./data";
import { clock, dailyFor, dailyProgress, QUESTS, seasonFor, weatherFor, weeklyContribution, weeklyFor, type GameState } from "./engine";
import {
  AFFIX, BRANCHES, EXPEDITIONS, EXP_ENERGY, EXP_WEEK_GOAL, PERKS, RARITY, bonus, claimExpWeek, expAdvance, expCamp, CAMP_FOOD, expAmbush, expChoose, expLock, expUse, EXP_EVENTS, LURE, expAvailable, expRetreat, expWeekCount, expCompanion,
  hasPerk, learnPerk, respecPerks, RESPEC_COST, perkCost, perkBlocked, perkPoints, relicName, scrapRelic, startExpedition, wearRelic, type AffixKey, type Relic,
} from "./progress";
import { PARDI_JUTUD } from "./tekstid";
import { WorldEventLine } from "./WorldTab";
import { REGION_IMG } from "./portraits";
import { PathPanel } from "./LoreTabs";

type Mut = (fn: (g: GameState) => string | null | void) => void;
function H({ children }: { children: React.ReactNode }) { return <h2 className="px-title mb-2 mt-1 text-primary">&gt; {children}</h2>; }
const affixText = (r: Relic) => Object.entries(r.affixes).map(([k, v]) => AFFIX[k as AffixKey].label(v!)).join(" · ");

const NPC_LINES = [
  ["👩‍🔧 Liis", ["Sidemed hakkavad otsa saama. Too riiet.", "Vanametall on alati teretulnud.", "Keldrites on veel tööriistu, olen kindel."]],
  ["📚 Arhivaar", ["Leidsin uue KOIDIKU signaali. Uuri piirkondi.", "Šahti sügavuses on midagi, mis kumab.", "Lõhe serv laulab öösiti. Ära mine üksi."]],
] as const;

export function TodayTab({ s, mut, go }: { s: GameState; mut: Mut; go: (tab: "exp" | "skills" | "quests" | "world") => void }) {
  const c = clock(s); const w = weatherFor(s); const se = seasonFor(s);
  const pick = <T,>(arr: readonly T[], k: number) => arr[(c.day * 7 + k) % arr.length];
  const nextQuest = QUESTS.find((q) => !q.done(s));
  const wk = weeklyFor(s.wk.week || "x-W01");
  const expN = expWeekCount(s); const pts = perkPoints(s);
  const goals: { done: boolean; text: string }[] = [
    ...dailyFor(s.daily.day).map((q) => ({ done: dailyProgress(s, q) >= q.n, text: `${q.icon} ${q.name} (${Math.min(q.n, dailyProgress(s, q))}/${q.n})` })),
    ...(nextQuest ? [{ done: false, text: `📖 Lugu: ${nextQuest.name} — ${nextQuest.desc}` }] : []),
    ...(pts ? [{ done: false, text: `⭐ Sul on ${pts} oskuspunkt${pts > 1 ? "i" : ""} — õpi uus oskus` }] : []),
  ];
  return (
    <div>
      <H>TUHK — täna (päev {c.day}, {c.label})</H>
      <p className="mb-3 text-muted-foreground">{w.icon} {w.name} · {se.icon} {se.name} {c.night ? "· 🌙 öö" : ""}</p>
      <WorldEventLine s={s} />
      <PathPanel s={s} mut={mut} />
      <ul className="mb-3 space-y-1">
        <li className="border-2 p-2"><span className="text-accent">🧔 Pärt:</span> «{pick(PARDI_JUTUD, 0)}»</li>
        {NPC_LINES.map(([who, lines], i) => <li key={who} className="border-2 p-2"><span className="text-accent">{who}:</span> «{pick(lines, i + 1)}»</li>)}
      </ul>
      <H>Sinu eesmärgid</H>
      <ul className="mb-3 space-y-1">
        {goals.map((g, i) => <li key={i} className={`border-2 p-2 ${g.done ? "text-muted-foreground" : ""}`}><span className={g.done ? "text-primary" : "text-accent"}>{g.done ? "[✓]" : "[ ]"}</span> {g.text}</li>)}
      </ul>
      <div className="mb-2 border-2 p-2">🧭 Nädala retked: <span className="text-accent">{Math.min(expN, EXP_WEEK_GOAL)} / {EXP_WEEK_GOAL}</span> ekspeditsiooni</div>
      <div className="mb-3 border-2 p-2">🌍 Kogukonna väljakutse: {wk.icon} {wk.name} — sinu panus {weeklyContribution(s)} / ühine eesmärk {wk.goal}</div>
      <div className="flex flex-wrap gap-2">
        <button className="px-btn px-btn-primary" onClick={() => go("exp")}>🧭 Ekspeditsioonid</button>
        <button className="px-btn" onClick={() => go("skills")}>⭐ Oskused ja talismanid</button>
        <button className="px-btn" onClick={() => go("world")}>🌍 Maailm ja fraktsioonid</button>
        <button className="px-btn" onClick={() => go("quests")}>📖 Kõik ülesanded</button>
      </div>
    </div>
  );
}

export function ExpTab({ s, mut }: { s: GameState; mut: Mut }) {
  const run = s.exp; const x = run && EXPEDITIONS.find((e) => e.id === run.id);
  const n = expWeekCount(s);
  const comps = s.npcs.filter((c) => SURVIVORS[c] && NPCS[c]);
  const [comp, setComp] = useState("");
  if (run && x) {
    const lootList = Object.entries(run.loot ?? {});
    const hpPct = s.maxHp ? s.hp / s.maxHp : 1;
    return (
    <div>
      {/* Header: title, progress and vitals in one fixed strip */}
      <div className="relative mb-3 overflow-hidden border-2 border-border">
        {REGION_IMG[x.id] && <img src={REGION_IMG[x.id]} alt={x.name} className="h-32 w-full object-cover opacity-70" style={{ imageRendering: "pixelated" }} />}
        <div className="absolute inset-x-0 bottom-0 bg-background/85 p-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="px-title text-primary">{x.icon} {x.name}</span>
            <span className="text-base">Etapp <b className="text-accent">{run.stage}</b>/{x.stages}</span>
          </div>
          <div className="px-bar my-1 text-primary"><span style={{ width: `${(run.stage / x.stages) * 100}%` }} /></div>
          <div className="flex flex-wrap gap-3 text-base">
            <span className={hpPct < 0.3 ? "text-destructive" : ""}>❤️ {Math.round(s.hp)}/{s.maxHp}</span>
            <span className={s.energy < EXP_ENERGY ? "text-destructive" : ""}>⚡ {Math.round(s.energy)}</span>
            <span>☢️ {Math.round(s.rad)}</span>
            <span className="text-muted-foreground">Kaasas: {lootList.map(([k, v]) => `${ITEMS[k]?.icon ?? ""}×${v}`).join(" ") || "—"}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ACTION column — always first, fixed slot order */}
        <div className="order-1 flex flex-col gap-3 lg:order-2">
          <section className="border-2 border-primary bg-card p-3" style={{ minHeight: 150 }}>
            <div className="mb-2 text-sm uppercase text-muted-foreground">▶ Tegevus</div>
            {run.pending ? <ExpPendingBox s={s} mut={mut} /> : (
              <div className="grid gap-2">
                {run.stage > 0 && <button className="exp-act" disabled={(run.campAt != null && run.stage - run.campAt < 3) || (s.inv.wood || 0) < 2 || !CAMP_FOOD.some((f) => s.inv[f] > 0)} onClick={() => mut(expCamp)}>🔥 Tee ajutine laager<small>2 🪵 + 1 toit → +20 ⚡, +15% elu. 30% oht, et lõhn meelitab varitsuse.</small></button>}
                <button className="exp-act exp-act-main" disabled={s.energy < EXP_ENERGY} onClick={() => mut(expAdvance)}>⬇️ Mine edasi — etapp {run.stage + 1}<small>Kulutab {EXP_ENERGY} ⚡ energiat. Sügavamal suurem saak ja suurem oht.</small></button>
                <button className="exp-act" onClick={() => mut(expRetreat)}>↩️ Pööra tagasi<small>Lõpeta retk ja vii kogu saak laagrisse.</small></button>
              </div>
            )}
          </section>
          {run.comp && SURVIVORS[run.comp] && <section className="flex flex-wrap items-center gap-2 border-2 p-2">
            <span className="flex-1">Kaaslane: {NPCS[run.comp].icon} {NPCS[run.comp].name}{run.compUsed ? " (abi kasutatud)" : ""}</span>
            <button disabled={!companionCanUse(s)} className="px-btn px-btn-wrap" onClick={() => mut(expCompanion)}>{SURVIVORS[run.comp].companion.label}</button>
          </section>}
          <ExpBag s={s} mut={mut} disabled={run.pending?.kind === "ambush"} />
        </div>

        {/* LOG column — scrolls on its own */}
        <section className="order-2 self-start border-2 p-2 lg:order-1 w-full">
          <div className="mb-1 text-sm uppercase text-muted-foreground">📜 Retke logi</div>
          <ul className="space-y-1 overflow-y-auto pr-1 text-base" style={{ maxHeight: "50vh" }}>{[...(run.log ?? [])].reverse().map((l, i) => <li key={i} className={`border-l-2 pl-2 ${i === 0 ? "border-primary" : "text-muted-foreground"}`}>{l}</li>)}</ul>
        </section>
      </div>
    </div>
    );
  }
  return (
    <div>
      <H>Ekspeditsioonid</H>
      <p className="mb-2 text-muted-foreground">Mitmeetapilised retked. Iga etapp kulutab {EXP_ENERGY} energiat. Võid igal hetkel tagasi pöörata ja saagi alles hoida. Retke lõpus ootab alati haruldane leid.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-2 p-2">
        <span className="flex-1">🗓️ Nädala eesmärk: {Math.min(n, EXP_WEEK_GOAL)}/{EXP_WEEK_GOAL} retke · tasu 40 🪙, 150 XP ja eriline leid</span>
        {s.expWeek?.claimed && n >= EXP_WEEK_GOAL ? <span className="text-primary">[✓]</span> : <button disabled={n < EXP_WEEK_GOAL} className="px-btn px-btn-primary" onClick={() => mut(claimExpWeek)}>Võta tasu</button>}
      </div>
      {comps.length > 0 && <label className="mb-3 flex flex-wrap items-center gap-2 border-2 p-2">
        <span>🧑‍🤝‍🧑 Kaaslane:</span>
        <select className="border-2 bg-card p-1" value={comp} onChange={(e) => setComp(e.target.value)}>
          <option value="">— üksi —</option>
          {comps.map((c) => <option key={c} value={c}>{NPCS[c].icon} {NPCS[c].name} — {SURVIVORS[c].companion.label}</option>)}
        </select>
      </label>}
      <div className="grid gap-2 sm:grid-cols-2">
        {EXPEDITIONS.map((e) => { const ok = expAvailable(s, e); return (
          <div key={e.id} className={`border-2 p-2 ${ok ? "" : "opacity-50"}`}>
            {REGION_IMG[e.id] && <img src={REGION_IMG[e.id]} alt={e.name} loading="lazy" className="mb-1 max-h-32 w-full border-2 border-border object-cover" style={{ imageRendering: "pixelated" }} />}
            <div className="flex justify-between"><span>{e.icon} {e.name}</span><span className="text-accent">{"☠".repeat(Math.ceil(e.danger))}</span></div>
            <div className="text-base text-muted-foreground">{e.desc} {e.stages} etappi · {REGIONS[e.region].icon} {REGIONS[e.region].name}</div>
            <div className="text-base">Saak: {e.loot.map(([k]) => ITEMS[k]?.icon ?? "").join(" ")}</div>
            <button disabled={!ok} className="px-btn mt-1" onClick={() => mut((g) => startExpedition(g, e.id, comp || undefined))}>{ok ? "Alusta" : "Avasta piirkond enne"}</button>
          </div>); })}
      </div>
    </div>
  );
}

const BRANCH_COLOR: Record<string, string> = { fighter: "#ef4444", scav: "#ec4899", wander: "#f59e0b", surv: "#10b981" };

export function PerkAndRelics({ s, mut }: { s: GameState; mut: Mut }) {
  const b = bonus(s);
  return (
    <div>
      <div className="mb-3 border-b border-[#2a2a2a] pb-3">
        <H>Oskuspuu — vabu punkte: <span className="text-[#e85d3a]">{perkPoints(s)}</span></H>
        <p className="text-sm text-muted-foreground">Iga teine tase annab ühe punkti. Kõrgemad oskused maksavad rohkem (1–3 punkti). Kõike ei jõua — vali, milline ellujääja sinust saab. Oskused säilivad ka surma korral.</p>
        <button disabled={!(s.perks || []).length || (s.inv.cash || 0) < RESPEC_COST} className="px-btn mt-2" title="Saad kõik kasutatud punktid tagasi"
          onClick={() => { if (confirm(`Nullida oskuspuu ${RESPEC_COST} 🪙 eest? Kõik punktid tulevad tagasi.`)) mut(respecPerks); }}>🔄 Nulli oskused ({RESPEC_COST} 🪙)</button>
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BRANCHES.map((br) => { const c = BRANCH_COLOR[br.id]; return (
          <section key={br.id}>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center border text-lg" style={{ borderColor: c, background: c + "1a" }}>{br.icon}</div>
              <h3 className="font-bold uppercase italic tracking-tight" style={{ color: c }}>{br.name}</h3>
            </div>
            <div className="flex flex-col gap-2">
              {PERKS.filter((p) => p.branch === br.id).map((p) => { const got = hasPerk(s, p.id); const why = perkBlocked(s, p); const locked = !got && !!why; return (
                <div key={p.id} className={`border-l-2 p-3 ${locked ? "border-transparent bg-[#111] opacity-40" : got ? "" : "border-[#2a2a2a] bg-[#1a1a1a]/60"}`}
                  style={got ? { borderColor: c, background: c + "0d" } : undefined}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="font-bold" style={{ color: locked ? undefined : c }}>{p.icon} {p.name}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]" style={{ background: locked ? "#1f2937" : c + "33", color: locked ? "#6b7280" : c }}>tase {p.minLevel} · {perkCost(p)} p</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                  {got
                    ? <div className="mt-2 text-[10px] font-bold text-[#4ade80]">[ ✓ ÕPITUD ]</div>
                    : <button disabled={!!why} title={why ?? ""} className="mt-2 w-full cursor-pointer border py-1.5 text-xs font-bold uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderColor: c, color: c, background: c + "1a" }}
                        onMouseEnter={(e) => { if (!why) { e.currentTarget.style.background = c; e.currentTarget.style.color = "#000"; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = c + "1a"; e.currentTarget.style.color = c; }}
                        onClick={() => mut((g) => learnPerk(g, p.id))}>Õpi</button>}
                </div>); })}
            </div>
          </section>); })}
      </div>
      <H>Talismanid ({(s.relics || []).length})</H>
      <p className="mb-2 text-base text-muted-foreground">Haruldased leiud vaenlastelt, uurimisel ja retkedelt. Kanna korraga ühte. Praegused boonused: +{b.dmg} kahju, +{b.def} kaitset, +{Math.round(b.gather * 100)}% saaki, +{Math.round(b.xp * 100)}% XP{b.heal ? `, +${b.heal} HP võidust` : ""}.</p>
      {(s.relics || []).length === 0 && <p className="text-muted-foreground">Veel pole ühtegi. Minibossid ja retkede lõpud annavad neid kõige kindlamalt.</p>}
      <ul className="space-y-1">
        {(s.relics || []).map((r) => { const worn = s.charm === r.uid; return (
          <li key={r.uid} className={`flex flex-wrap items-center gap-2 px-row ${worn ? "border-primary" : ""}`}>
            <span className="flex-1"><span className={RARITY[r.rarity].color}>{RARITY[r.rarity].name}</span> {relicName(r)} <span className="text-base text-muted-foreground">· {affixText(r)}</span></span>
            <button className="px-btn" onClick={() => mut((g) => wearRelic(g, worn ? null : r.uid))}>{worn ? "Võta ära" : "Kanna"}</button>
            <button className="px-btn" onClick={() => mut((g) => scrapRelic(g, r.uid))}>Müü</button>
          </li>); })}
      </ul>
    </div>
  );
}

const BAG_TYPES = ["food", "drink", "medicine"];
function ExpBag({ s, mut, disabled }: { s: GameState; mut: Mut; disabled?: boolean }) {
  const items = Object.entries(s.inv).filter(([k, v]) => v > 0 && BAG_TYPES.includes(ITEMS[k]?.type ?? ""));
  return (
    <section className="border-2 p-2">
      <div className="mb-2 text-sm uppercase text-muted-foreground">🎒 Seljakott{disabled ? " — varitsuse ajal ei saa" : ""}</div>
      {!items.length ? <p className="text-base text-muted-foreground">Toitu ega ravimeid pole.</p> : (
        <div className="grid gap-1 sm:grid-cols-2">
          {items.map(([k, v]) => <button key={k} disabled={disabled} className="exp-item" title={ITEMS[k].desc} onClick={() => mut((g) => expUse(g, k))}><span className="min-w-0">{ITEMS[k].icon} {ITEMS[k].name}</span><span className="shrink-0 text-accent">×{v}</span></button>)}
        </div>)}
    </section>
  );
}

function ExpPendingBox({ s, mut }: { s: GameState; mut: Mut }) {
  const p = s.exp?.pending; if (!p) return null;
  if (p.kind === "choice") {
    const ev = EXP_EVENTS[p.ev];
    return (
      <div className="fadein">
        <p className="mb-3 border-l-2 border-accent pl-3 text-base leading-relaxed">❓ {ev.text}</p>
        <div className="grid gap-2">
          {ev.options.map((o, i) => <button key={i} className="exp-act" disabled={!!o.need && !(s.inv[o.need] > 0)} onClick={() => mut((g) => expChoose(g, i))}>{o.label}<small>{o.hint}</small></button>)}
        </div>
      </div>
    );
  }
  if (p.kind === "ambush") {
    const lure = s.inv[LURE] || 0;
    return (
      <div className="fadein">
        <p className="mb-3 border-l-2 border-destructive pl-3 text-base text-destructive">⚠️ Varitsus! {p.foe}<span className="ml-2 text-muted-foreground">❤️ {p.hp} · ⚔️ {p.atk}</span></p>
        <div className="grid gap-2">
          <button className="exp-act exp-act-danger" onClick={() => mut((g) => expAmbush(g, 0))}>⚔️ Võitle<small>Saad saaki ja XP-d, aga võid haavata saada.</small></button>
          <button className="exp-act" onClick={() => mut((g) => expAmbush(g, 1))}>🏃 Põgene<small>Kaotad osa saagist või HP-d.</small></button>
          <button className="exp-act" disabled={!lure} onClick={() => mut((g) => expAmbush(g, 2))}>🥩 Viska peibutis<small>{lure ? `Kulutab 1 liha (sul ×${lure}).` : "Sul pole liha."}</small></button>
        </div>
      </div>
    );
  }
  return <LockGame tier={p.tier} onDone={(hits) => mut((g) => expLock(g, hits))} />;
}

/** Lockpick: a needle sweeps back and forth; press when it is inside the green zone. 3 pins. */
function LockGame({ tier, onDone }: { tier: number; onDone: (hits: number) => void }) {
  const [pos, setPos] = useState(0); const [pin, setPin] = useState(0); const [hits, setHits] = useState(0);
  const [zone, setZone] = useState(() => 20 + Math.random() * 55); const [flash, setFlash] = useState<string | null>(null);
  const width = Math.max(10, 22 - tier * 4); const dir = useRef(1); const posRef = useRef(0);
  useEffect(() => {
    const speed = 1.2 + tier * 0.5 + pin * 0.3;
    const t = window.setInterval(() => { let n = posRef.current + dir.current * speed; if (n >= 100 || n <= 0) { dir.current *= -1; n = Math.max(0, Math.min(100, n)); } posRef.current = n; setPos(n); }, 16);
    return () => window.clearInterval(t);
  }, [tier, pin]);
  const press = () => {
    if (pin >= 3) return;
    const ok = posRef.current >= zone && posRef.current <= zone + width; const h = hits + (ok ? 1 : 0);
    setFlash(ok ? "✓ Tihvt paigas!" : "✗ Mööda!"); setHits(h);
    if (pin + 1 >= 3) { setPin(3); window.setTimeout(() => onDone(h), 500); } else { setPin(pin + 1); setZone(10 + Math.random() * 70); }
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); press(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); });
  return (
    <div className="fadein">
      <p className="mb-2">🔐 Muugi seif lahti: vajuta, kui nõel on rohelisel alal. Tihvt {Math.min(pin + 1, 3)}/3 · tabatud {hits}</p>
      <div className="relative mb-2 h-6 w-full border-2 border-border bg-muted">
        <div className="absolute inset-y-0 bg-primary/60" style={{ left: `${zone}%`, width: `${width}%` }} />
        <div className="absolute inset-y-0 w-1 bg-foreground" style={{ left: `calc(${pos}% - 2px)` }} />
      </div>
      <div className="flex items-center gap-3">
        <button className="px-btn px-btn-primary" disabled={pin >= 3} onClick={press}>🗝️ Keera (tühik)</button>
        {flash && <span className="text-base text-muted-foreground">{flash}</span>}
      </div>
    </div>
  );
}
