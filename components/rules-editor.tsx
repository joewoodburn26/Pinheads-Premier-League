"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Check, Link2, Pencil, Search, ShieldBan, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { stripHtml, type RuleSection } from "@/lib/rules";

export type BannedMon = {
  id: string;
  name: string;
  spriteUrl: string;
  category: "Mythical" | "Legendary" | "Paradox" | "Ultra Beast" | "Other";
};

// The editor (tiptap) is only downloaded when an admin clicks Edit
const RulesEditMode = dynamic(() => import("@/components/rules-edit-mode").then((m) => m.RulesEditMode), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-muted-foreground">Loading editor…</p>,
});

const BANNED_ID = "banned-pokemon";
const CATEGORY_ORDER: BannedMon["category"][] = ["Legendary", "Mythical", "Paradox", "Ultra Beast", "Other"];

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

export function RulesEditor({
  sections,
  banned,
  canEdit = false,
}: {
  sections: RuleSection[];
  banned: BannedMon[];
  canEdit?: boolean;
}) {
  const [current, setCurrent] = useState(sections);
  const [editing, setEditing] = useState(false);

  return editing && canEdit ? (
    <RulesEditMode
      sections={current}
      onCancel={() => setEditing(false)}
      onSaved={(saved) => {
        setCurrent(saved);
        setEditing(false);
      }}
    />
  ) : (
    <RulesView sections={current} banned={banned} onEdit={canEdit ? () => setEditing(true) : undefined} />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// View mode
// ════════════════════════════════════════════════════════════════════════════

function RulesView({
  sections,
  banned,
  onEdit,
}: {
  sections: RuleSection[];
  banned: BannedMon[];
  onEdit?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      q
        ? sections.filter(
            (s) => s.title.toLowerCase().includes(q) || stripHtml(s.html).toLowerCase().includes(q),
          )
        : sections,
    [sections, q],
  );
  const visibleBanned = useMemo(
    () => (q ? banned.filter((b) => b.name.toLowerCase().includes(q)) : banned),
    [banned, q],
  );
  const showBanned = banned.length > 0 && (!q || visibleBanned.length > 0 || "banned".includes(q));

  const toc = [
    ...visible.map((s) => ({ id: s.id, title: s.title, num: sections.indexOf(s) + 1 })),
    ...(showBanned ? [{ id: BANNED_ID, title: "Banned Pokémon", num: null as number | null }] : []),
  ];

  // Highlight the section currently on screen
  useEffect(() => {
    const els = toc.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toc.map((t) => t.id).join("|")]);

  // Highlight search matches without touching the HTML (CSS Custom Highlight API)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const css = (globalThis as any).CSS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HighlightCtor = (globalThis as any).Highlight;
    if (!css?.highlights || !HighlightCtor) return;
    css.highlights.delete("rules-search");
    if (!q || !contentRef.current) return;

    const ranges: Range[] = [];
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").toLowerCase();
      let i = text.indexOf(q);
      while (i !== -1) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + q.length);
        ranges.push(r);
        i = text.indexOf(q, i + q.length);
      }
    }
    css.highlights.set("rules-search", new HighlightCtor(...ranges));
    return () => css.highlights.delete("rules-search");
  }, [q, visible, visibleBanned]);

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard blocked; ignore
    }
  }

  const empty = sections.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_1fr] lg:gap-8">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules…"
            className="pl-9 pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mobile: dropdown */}
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm lg:hidden"
          value=""
          onChange={(e) => e.target.value && jumpTo(e.target.value)}
        >
          <option value="">Jump to section…</option>
          {toc.map((t) => (
            <option key={t.id} value={t.id}>
              {t.num ? `${t.num}. ` : ""}{t.title}
            </option>
          ))}
        </select>

        {/* Desktop: list */}
        <nav className="hidden space-y-0.5 lg:block">
          {toc.map((t) => (
            <button
              key={t.id}
              onClick={() => jumpTo(t.id)}
              className={`flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                activeId === t.id
                  ? "bg-blue-600/15 font-semibold text-blue-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="w-5 shrink-0 tabular-nums opacity-70">
                {t.num ?? <ShieldBan size={13} className="mt-1" />}
              </span>
              <span className="min-w-0">{t.title}</span>
            </button>
          ))}
        </nav>

        {onEdit && (
          <Button variant="secondary" className="w-full" onClick={onEdit}>
            <Pencil size={14} className="mr-2" /> Edit Rules
          </Button>
        )}
      </aside>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div ref={contentRef} className="min-w-0 space-y-4">
        {empty && (
          <Card className="p-10 text-center text-muted-foreground">
            <p className="text-sm">No rules added yet.</p>
            {onEdit && <p className="mt-1 text-xs">Click “Edit Rules” to add your first section.</p>}
          </Card>
        )}

        {!empty && q && visible.length === 0 && !showBanned && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No rules match “{query}”.
          </Card>
        )}

        {visible.map((s) => {
          const num = sections.indexOf(s) + 1;
          return (
            <Card key={s.id} id={s.id} className="group scroll-mt-24 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600/20 text-sm font-black text-blue-300">
                  {num}
                </span>
                <h2 className="min-w-0 flex-1 text-lg font-black leading-tight">{s.title}</h2>
                <button
                  onClick={() => copyLink(s.id)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                  title="Copy link to this section"
                >
                  {copiedId === s.id ? <><Check size={13} /> Copied</> : <><Link2 size={13} /> Link</>}
                </button>
              </div>
              {stripHtml(s.html) ? (
                <div className="rich-content px-5 py-4 text-sm text-foreground/90" dangerouslySetInnerHTML={{ __html: s.html }} />
              ) : (
                <p className="px-5 py-4 text-sm italic text-muted-foreground">Nothing here yet.</p>
              )}
            </Card>
          );
        })}

        {showBanned && <BannedSection banned={q && visibleBanned.length > 0 ? visibleBanned : banned} />}
      </div>
    </div>
  );
}

function BannedSection({ banned }: { banned: BannedMon[] }) {
  const groups = CATEGORY_ORDER
    .map((cat) => ({ cat, mons: banned.filter((b) => b.category === cat) }))
    .filter((g) => g.mons.length > 0);

  return (
    <Card id={BANNED_ID} className="scroll-mt-24 overflow-hidden border-red-500/20">
      <div className="flex items-center gap-3 border-b border-white/5 bg-red-500/5 px-5 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-600/20 text-red-300">
          <ShieldBan size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-tight">Banned Pokémon</h2>
          <p className="text-xs text-muted-foreground">Synced automatically from Pokédex settings</p>
        </div>
        <span className="text-sm font-bold text-muted-foreground">{banned.length}</span>
      </div>
      <div className="space-y-5 px-5 py-4">
        {groups.map(({ cat, mons }) => (
          <div key={cat}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {cat} · {mons.length}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
              {mons.map((m) => (
                <div key={m.id} className="flex flex-col items-center rounded-lg bg-white/[0.03] p-2 text-center">
                  <Image src={m.spriteUrl} alt="" width={56} height={56} className="size-12 object-contain" />
                  <span className="mt-1 text-[11px] font-semibold leading-tight">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
