"use client";

import { Card } from "@/components/ui/card";
import type { FieldState, Gen, SideField } from "@/components/calculator/calc-utils";

const btn = (on: boolean) =>
  `rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, l]) => (
          <button key={v || "none"} onClick={() => onChange(v)} className={btn(value === v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

const SIDE_TOGGLES: [keyof SideField, string, boolean?][] = [
  ["isSR", "Stealth Rock"],
  ["isReflect", "Reflect"],
  ["isLightScreen", "Light Screen"],
  ["isAuroraVeil", "Aurora Veil"],
  ["isProtected", "Protect"],
  ["isTailwind", "Tailwind"],
  ["isSeeded", "Leech Seed"],
  ["isSaltCured", "Salt Cure"],
  ["isForesight", "Foresight"],
  ["isFlowerGift", "Flower Gift"],
  ["isCharge", "Charge"],
  ["isSwitching", "Switching out"],
  ["isHelpingHand", "Helping Hand", true],
  ["isFriendGuard", "Friend Guard", true],
  ["isBattery", "Battery", true],
  ["isPowerSpot", "Power Spot", true],
  ["isSteelySpirit", "Steely Spirit", true],
];

export function FieldPanel({
  gen,
  field,
  onChange,
  names,
  accents,
  onLevel,
}: {
  gen: Gen;
  field: FieldState;
  onChange: (f: FieldState) => void;
  names: [string, string];
  accents: [string, string];
  onLevel?: (level: number) => void;
}) {
  const g = gen.num;
  const doubles = field.gameType === "Doubles";
  const set = (p: Partial<FieldState>) => onChange({ ...field, ...p });
  const setSide = (i: 0 | 1, p: Partial<SideField>) =>
    onChange({ ...field, sides: field.sides.map((s, j) => (j === i ? { ...s, ...p } : s)) as [SideField, SideField] });

  const weathers: [string, string][] = [
    ["", "None"], ["Sun", "Sun"], ["Rain", "Rain"], ["Sand", "Sand"],
    g >= 9 || g === 0 ? ["Snow", "Snow"] : ["Hail", "Hail"],
    ...(g >= 6 || g === 0 ? ([["Harsh Sunshine", "Harsh Sun"], ["Heavy Rain", "Heavy Rain"], ["Strong Winds", "Strong Winds"]] as [string, string][]) : []),
  ];
  const showTerrain = g >= 6 || g === 0;

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-lg font-black">Field</h2>

      <Choice label="Format" value={field.gameType} options={[["Singles", "Singles"], ["Doubles", "Doubles"]]} onChange={(v) => set({ gameType: v })} />
      {onLevel && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Set both levels</p>
          <div className="flex gap-1">
            {[50, 100].map((l) => <button key={l} onClick={() => onLevel(l)} className={btn(false)}>Lv {l}</button>)}
          </div>
        </div>
      )}
      <Choice label="Weather" value={field.weather} options={weathers} onChange={(v) => set({ weather: v })} />
      {showTerrain && (
        <Choice
          label="Terrain"
          value={field.terrain}
          options={[["", "None"], ["Electric", "Electric"], ["Grassy", "Grassy"], ["Psychic", "Psychic"], ["Misty", "Misty"]]}
          onChange={(v) => set({ terrain: v })}
        />
      )}

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Field</p>
        <div className="flex flex-wrap gap-1">
          {([
            ["isGravity", "Gravity", true],
            ["isMagicRoom", "Magic Room", g >= 5 || g === 0],
            ["isWonderRoom", "Wonder Room", g >= 5 || g === 0],
            ["isFairyAura", "Fairy Aura", g >= 6 || g === 0],
            ["isDarkAura", "Dark Aura", g >= 6 || g === 0],
            ["isAuraBreak", "Aura Break", g >= 6 || g === 0],
            ["isBeadsOfRuin", "Beads of Ruin", g >= 9 || g === 0],
            ["isSwordOfRuin", "Sword of Ruin", g >= 9 || g === 0],
            ["isTabletsOfRuin", "Tablets of Ruin", g >= 9 || g === 0],
            ["isVesselOfRuin", "Vessel of Ruin", g >= 9 || g === 0],
          ] as [keyof FieldState, string, boolean][])
            .filter(([, , show]) => show)
            .map(([k, l]) => (
              <button key={k} onClick={() => set({ [k]: !field[k] } as Partial<FieldState>)} className={btn(!!field[k])}>{l}</button>
            ))}
        </div>
      </div>

      {([0, 1] as const).map((i) => (
        <div key={i} className="space-y-2 rounded-lg border p-2.5" style={{ borderColor: `${accents[i]}55` }}>
          <p className="truncate text-xs font-bold" style={{ color: accents[i] }}>{names[i]}&apos;s side</p>
          <div className="flex flex-wrap gap-1">
            {SIDE_TOGGLES.filter(([, , d]) => !d || doubles)
              .filter(([k]) => k !== "isAuroraVeil" || g >= 7 || g === 0)
              .map(([k, l]) => (
                <button key={k} onClick={() => setSide(i, { [k]: !field.sides[i][k] } as Partial<SideField>)} className={btn(!!field.sides[i][k])}>{l}</button>
              ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Spikes
            {[0, 1, 2, 3].map((n) => (
              <button key={n} onClick={() => setSide(i, { spikes: n })} className={btn(field.sides[i].spikes === n)}>{n}</button>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
