// Excel download / upload for a point list (server only).
//
// Sheet "Points": one row per legal, unbanned Pokémon, sorted by points (high → low).
// Rows are tinted by their point value with conditional formatting, so the colour
// follows the number if you change it in Excel, and every value (even a new 25 tier)
// gets its own faint colour that's clearly different from the values next to it.

import ExcelJS from "exceljs";
import type { Pokemon } from "@/lib/types";

const MAX_TINTED_VALUE = 100;

/**
 * Faint, clearly different colour per point value. Hue moves 100° per point, so
 * neighbouring values differ by 100°, and a jump of 5 (20 → 25) by 140°.
 */
export function tierColor(value: number): string {
  const hue = (value * 100 + 200) % 360;
  return hslToHex(hue, 0.7, 0.87);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0").toUpperCase();
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

const HEADER = ["Points", "Name", "Type 1", "Type 2", "BST", "Dex #", "ID"] as const;

export async function buildPointsWorkbook(opts: {
  listName: string;
  formatName: string;
  pokemon: Pokemon[];
  banned: Pokemon[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pinheads Premier League";

  // ── Points ──
  const ws = wb.addWorksheet("Points", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Points", key: "points", width: 9 },
    { header: "Name", key: "name", width: 28 },
    { header: "Type 1", key: "type1", width: 11 },
    { header: "Type 2", key: "type2", width: 11 },
    { header: "BST", key: "bst", width: 7 },
    { header: "Dex #", key: "dex", width: 8 },
    { header: "ID", key: "id", width: 12, hidden: true },
  ];
  const sorted = [...opts.pokemon].sort((a, b) => b.pointValue - a.pointValue || a.name.localeCompare(b.name));
  for (const p of sorted) {
    ws.addRow({
      points: p.pointValue,
      name: p.name,
      type1: p.primaryType,
      type2: p.secondaryType ?? "",
      bst: p.bst,
      dex: p.dexNumber,
      id: p.id,
    });
  }
  const last = sorted.length + 1;

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  ws.getColumn("points").alignment = { horizontal: "center" };
  ws.getColumn("points").font = { bold: true };
  ws.getColumn("bst").alignment = { horizontal: "center" };
  ws.getColumn("dex").alignment = { horizontal: "center" };
  header.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADER.length - 1 } };

  // Whole numbers only in the Points column
  for (let r = 2; r <= last; r++) {
    ws.getCell(r, 1).dataValidation = {
      type: "whole",
      operator: "between",
      allowBlank: false,
      formulae: [0, 999],
      showErrorMessage: true,
      errorTitle: "Points",
      error: "Points must be a whole number from 0 to 999.",
    };
  }

  // Row tint by point value
  if (sorted.length > 0) {
    ws.addConditionalFormatting({
      ref: `A2:F${last}`,
      rules: Array.from({ length: MAX_TINTED_VALUE + 1 }, (_, v) => ({
        type: "expression" as const,
        priority: v + 1,
        formulae: [`$A2=${v}`],
        style: { fill: { type: "pattern" as const, pattern: "solid" as const, bgColor: { argb: `FF${tierColor(v)}` } } },
      })),
    });
  }

  // ── Banned (reference only) ──
  const bs = wb.addWorksheet("Banned");
  bs.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Category", key: "cat", width: 14 },
    { header: "Dex #", key: "dex", width: 8 },
  ];
  const cat = (p: Pokemon) =>
    p.mythical ? "Mythical" : p.legendary ? "Legendary" : p.paradox ? "Paradox" : p.ultraBeast ? "Ultra Beast" : "Other";
  for (const p of [...opts.banned].sort((a, b) => a.dexNumber - b.dexNumber)) {
    bs.addRow({ name: p.name, cat: cat(p), dex: p.dexNumber });
  }
  bs.getRow(1).font = { bold: true };
  bs.views = [{ state: "frozen", ySplit: 1 }];

  // ── Read me ──
  const rm = wb.addWorksheet("Read me");
  rm.getColumn(1).width = 100;
  [
    `Point list: ${opts.listName}`,
    `Pokémon legal in ${opts.formatName}, banned ones left out.`,
    "",
    "Change numbers in the Points column, save, and upload the file on the Point Restructure page.",
    "Only the list you upload to changes, and only the Pokémon whose points you changed.",
    "Row colours follow the points automatically. Don't change the hidden ID column.",
    "The Banned sheet is for reference: bans are changed on the website, not here.",
  ].forEach((line, i) => {
    rm.getCell(i + 1, 1).value = line;
    if (i === 0) rm.getCell(1, 1).font = { bold: true, size: 14 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type UploadedRow = { id?: string; name: string; points: number };

/** Reads the Points sheet of a downloaded workbook (or an older points CSV). */
export async function readPointsWorkbook(data: ArrayBuffer, filename: string): Promise<UploadedRow[]> {
  const table = filename.toLowerCase().endsWith(".csv") ? readCsv(new TextDecoder().decode(data)) : await readXlsx(data);
  if (table.length === 0) throw new Error("That file is empty.");

  const headerIndex = table.findIndex((r) => r.some((c) => c.toLowerCase() === "points"));
  if (headerIndex < 0) throw new Error("Couldn't find a “Points” column. Upload a file downloaded from this page.");
  const header = table[headerIndex].map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const pointsCol = col("points");
  const nameCol = col("name");
  const idCol = col("id");

  const rows: UploadedRow[] = [];
  for (const r of table.slice(headerIndex + 1)) {
    const raw = (r[pointsCol] ?? "").trim();
    const name = nameCol >= 0 ? (r[nameCol] ?? "").trim() : "";
    const id = idCol >= 0 ? (r[idCol] ?? "").trim() : "";
    if (!raw || (!name && !id)) continue;
    const points = Number(raw);
    if (!Number.isInteger(points) || points < 0 || points > 999) {
      throw new Error(`${name || id} has “${raw}” points. Points must be whole numbers from 0 to 999.`);
    }
    rows.push({ id: id || undefined, name, points });
  }
  if (rows.length === 0) throw new Error("No rows with points found in that file.");
  return rows;
}

async function readXlsx(data: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    throw new Error("Couldn't open that file. Upload the .xlsx downloaded from this page.");
  }
  const ws = wb.getWorksheet("Points") ?? wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const v = row.getCell(c).value;
      const plain =
        v && typeof v === "object" && "result" in v ? (v as { result?: unknown }).result : // formula
        v && typeof v === "object" && "richText" in v ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("") :
        v;
      cells.push(plain === null || plain === undefined ? "" : String(plain));
    }
    out.push(cells);
  });
  return out;
}

function readCsv(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const out: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") { out.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
}
