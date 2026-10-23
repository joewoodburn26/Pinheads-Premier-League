// Printable sheet for a saved Draft Plan, matching the plan page: picks, weakness
// grid, speed tiers and Prep move categories. Opens a print window (Save as PDF).

import { pokemonTypes, pokemonTypesFor, typeColors } from "@/lib/type-chart";
import type { PrepTeam } from "@/lib/prep";
import type { Pokemon } from "@/lib/types";

type Slot = { pokemon: Pokemon; note: string };

const MULT: Record<string, { label: string; bg: string; fg: string }> = {
  "0":    { label: "0", bg: "#2e3436", fg: "#d1d5db" },
  "0.25": { label: "¼", bg: "#6b0000", fg: "#ffffff" },
  "0.5":  { label: "½", bg: "#a40000", fg: "#ffffff" },
  "2":    { label: "2", bg: "#4e9a06", fg: "#ffffff" },
  "4":    { label: "4", bg: "#2b5a02", fg: "#ffffff" },
};

function speedAt(base: number, level: 50 | 100, ev: 0 | 252, plus = false) {
  const stat = Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * level) / 100) + 5;
  return plus ? Math.floor(stat * 1.1) : stat;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function badge(t: string) {
  return `<span class="badge" style="background:${typeColors[t as keyof typeof typeColors] ?? "#64748b"}">${t}</span>`;
}

export function exportPlanPdf({
  title,
  slots,
  budget,
  prep,
  categories,
  formatLabel,
}: {
  title: string;
  slots: Slot[];
  budget: number;
  prep: PrepTeam;
  categories: { key: string; label: string }[];
  formatLabel: string;
}) {
  const used = slots.reduce((n, s) => n + s.pokemon.pointValue, 0);
  const avgBst = slots.length ? Math.round(slots.reduce((n, s) => n + s.pokemon.bst, 0) / slots.length) : 0;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const byId = new Map(prep.members.map((m) => [m.pokemon.id, m.pokemon]));

  const picks = slots
    .map(({ pokemon: p, note }) => `
      <div class="card">
        <img src="${p.spriteUrl}" alt="" />
        <div class="name">${esc(p.name)}</div>
        <div class="badges">${pokemonTypesFor(p).map(badge).join("")}</div>
        <div class="pts">${p.pointValue}<span> pts</span></div>
        <div class="muted">BST ${p.bst}</div>
        ${note ? `<div class="note">“${esc(note)}”</div>` : ""}
      </div>`)
    .join("");

  const grid = `
    <table class="grid">
      <colgroup><col style="width:120px" />${pokemonTypes.map(() => "<col />").join("")}</colgroup>
      <thead><tr><th></th>${pokemonTypes
        .map((t) => `<th><span class="th" style="background:${typeColors[t]}">${t}</span></th>`)
        .join("")}</tr></thead>
      <tbody>${prep.members
        .map((m) => `<tr><td class="who"><img src="${m.pokemon.spriteUrl}" alt="" />${esc(m.pokemon.name)}</td>${pokemonTypes
          .map((t) => {
            const s = MULT[String(m.weakness[t])];
            return `<td>${s ? `<div class="cell" style="background:${s.bg};color:${s.fg}">${s.label}</div>` : ""}</td>`;
          })
          .join("")}</tr>`)
        .join("")}</tbody>
    </table>`;

  const speeds = [...prep.members]
    .sort((a, b) => b.pokemon.speed - a.pokemon.speed)
    .map((m, i) => {
      const b = m.pokemon.speed;
      return `<tr><td class="muted">${i + 1}</td><td class="who"><img src="${m.pokemon.spriteUrl}" alt="" />${esc(m.pokemon.name)}</td>
        <td>${b}</td><td class="muted">${speedAt(b, 100, 0)}</td><td>${speedAt(b, 100, 252)}</td><td><b>${speedAt(b, 100, 252, true)}</b></td>
        <td class="muted">${speedAt(b, 50, 0)}</td><td>${speedAt(b, 50, 252)}</td><td><b>${speedAt(b, 50, 252, true)}</b></td></tr>`;
    })
    .join("");

  const moves = categories
    .map((cat) => {
      const rows = prep.categories[cat.key] ?? [];
      const body = rows.length
        ? rows
            .map((r) => `<div class="move"><span class="chip" style="background:${typeColors[r.type]}">${esc(r.move)}</span>
              <span class="learners">${r.learners.map((id) => esc(byId.get(id)?.name ?? "")).filter(Boolean).join(", ")}</span></div>`)
            .join("")
        : `<div class="muted">None</div>`;
      const count = new Set(rows.flatMap((r) => r.learners)).size;
      return `<div class="box"><div class="box-title">${esc(cat.label)}<span>${count} can learn</span></div>${body}</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>
  @page { size: landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e2e8f0; padding: 24px; font-size: 12px; }
  .muted { color: #64748b; }
  .header { border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 16px; }
  .league { font-size: 10px; font-weight: 700; letter-spacing: .25em; color: #f97316; text-transform: uppercase; }
  h1 { font-size: 30px; font-weight: 900; margin: 4px 0; }
  .summary { display: flex; gap: 28px; background: #1e293b; border-radius: 10px; padding: 12px 20px; margin-bottom: 16px; }
  .summary .val { font-size: 22px; font-weight: 900; color: #f97316; line-height: 1; }
  .summary .lbl { font-size: 10px; color: #64748b; }
  h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #f97316; margin: 18px 0 8px; }
  .picks { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 8px; text-align: center; break-inside: avoid; }
  .card img { width: 56px; height: 56px; object-fit: contain; }
  .name { font-weight: 800; }
  .pts { font-size: 18px; font-weight: 900; color: #f97316; }
  .pts span { font-size: 10px; color: #64748b; font-weight: 500; }
  .note { font-size: 9px; color: #94a3b8; font-style: italic; margin-top: 4px; }
  .badges { display: flex; gap: 3px; justify-content: center; flex-wrap: wrap; margin: 4px 0; }
  .badge, .th, .chip { display: inline-block; color: #fff; font-weight: 700; border-radius: 4px; text-transform: uppercase; }
  .badge { font-size: 8px; padding: 1px 5px; }
  table { border-collapse: separate; border-spacing: 2px; width: 100%; }
  .grid { table-layout: fixed; }
  .th { display: block; font-size: 7px; padding: 2px 0; text-align: center; }
  .cell { height: 18px; line-height: 18px; text-align: center; border-radius: 3px; font-weight: 800; font-size: 10px; }
  td.who { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; font-size: 10px; }
  td.who img { width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 4px; }
  .speed { width: auto; background: #1e293b; border-radius: 10px; padding: 6px; }
  .speed th { font-size: 9px; color: #64748b; text-transform: uppercase; padding: 3px 8px; }
  .speed td { padding: 2px 8px; text-align: center; }
  .speed td.who { text-align: left; }
  .moves { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .box { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 8px; break-inside: avoid; }
  .box-title { font-weight: 800; margin-bottom: 6px; display: flex; justify-content: space-between; }
  .box-title span { color: #64748b; font-weight: 500; font-size: 10px; }
  .move { margin-bottom: 4px; }
  .chip { font-size: 9px; padding: 1px 6px; text-transform: none; }
  .learners { font-size: 10px; color: #cbd5e1; margin-left: 4px; }
  .page-break { break-before: page; }
  @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <div class="header">
    <div class="league">Pinheads Premier League · Private Draft Plan</div>
    <h1>${esc(title)}</h1>
    <div class="muted">${esc(formatLabel)} · ${slots.length} Pokémon · ${date}</div>
  </div>
  <div class="summary">
    <div><div class="val">${used}</div><div class="lbl">Points used</div></div>
    <div><div class="val" style="color:${used > budget ? "#f87171" : "#4ade80"}">${budget - used}</div><div class="lbl">Points left</div></div>
    <div><div class="val">${slots.length}</div><div class="lbl">Pokémon</div></div>
    <div><div class="val">${avgBst}</div><div class="lbl">Avg BST</div></div>
  </div>
  <div class="picks">${picks}</div>

  <h2>Weakness Grid</h2>
  ${grid}

  <h2>Speed Tiers</h2>
  <table class="speed">
    <thead><tr><th>#</th><th style="text-align:left">Pokémon</th><th>Base</th><th>L100 0</th><th>L100 252</th><th>L100 252+</th><th>L50 0</th><th>L50 252</th><th>L50 252+</th></tr></thead>
    <tbody>${speeds}</tbody>
  </table>

  <h2 class="page-break">Moves</h2>
  <div class="moves">${moves}</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}
