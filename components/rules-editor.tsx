"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  ArrowDown, ArrowUp, Bold, Check, Heading3, Italic, Link2, List, ListOrdered,
  Pencil, Plus, Search, ShieldBan, Trash2, Unlink, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateRules } from "@/lib/actions";
import { serializeRules, slugify, stripHtml, type RuleSection } from "@/lib/rules";

export type BannedMon = {
  id: string;
  name: string;
  spriteUrl: string;
  category: "Mythical" | "Legendary" | "Paradox" | "Ultra Beast" | "Other";
};

const BANNED_ID = "banned-pokemon";
const CATEGORY_ORDER: BannedMon["category"][] = ["Legendary", "Mythical", "Paradox", "Ultra Beast", "Other"];

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

export function RulesEditor({ sections, banned }: { sections: RuleSection[]; banned: BannedMon[] }) {
  const [current, setCurrent] = useState(sections);
  const [editing, setEditing] = useState(false);

  return editing ? (
    <RulesEditMode
      sections={current}
      onCancel={() => setEditing(false)}
      onSaved={(saved) => {
        setCurrent(saved);
        setEditing(false);
      }}
    />
  ) : (
    <RulesView sections={current} banned={banned} onEdit={() => setEditing(true)} />
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
  onEdit: () => void;
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

        <Button variant="secondary" className="w-full" onClick={onEdit}>
          <Pencil size={14} className="mr-2" /> Edit Rules
        </Button>
      </aside>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div ref={contentRef} className="min-w-0 space-y-4">
        {empty && (
          <Card className="p-10 text-center text-muted-foreground">
            <p className="text-sm">No rules added yet.</p>
            <p className="mt-1 text-xs">Click “Edit Rules” to add your first section.</p>
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

// ════════════════════════════════════════════════════════════════════════════
// Edit mode
// ════════════════════════════════════════════════════════════════════════════

type Draft = { key: string; title: string; html: string };

let keySeq = 0;
const newKey = () => `s${Date.now()}-${keySeq++}`;

function RulesEditMode({
  sections,
  onCancel,
  onSaved,
}: {
  sections: RuleSection[];
  onCancel: () => void;
  onSaved: (saved: RuleSection[]) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    sections.map((s) => ({ key: newKey(), title: s.title, html: s.html })),
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setDirty(true);
  }

  function insertAt(index: number) {
    setDrafts((d) => [...d.slice(0, index), { key: newKey(), title: "", html: "" }, ...d.slice(index)]);
    setDirty(true);
  }

  function move(index: number, dir: -1 | 1) {
    setDrafts((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setDirty(true);
  }

  function remove(key: string) {
    setDrafts((d) => d.filter((x) => x.key !== key));
    setConfirmDelete(null);
    setDirty(true);
  }

  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onCancel();
  }

  function save() {
    setError("");
    const cleaned = drafts.filter((d) => d.title.trim() || stripHtml(d.html));
    const fd = new FormData();
    fd.set("content", serializeRules(cleaned));
    startTransition(async () => {
      try {
        await updateRules(fd);
        setDirty(false);
        const ids = new Map<string, number>();
        onSaved(
          cleaned.map((d) => {
            const title = d.title.trim() || "Untitled section";
            const base = slugify(title);
            const n = ids.get(base) ?? 0;
            ids.set(base, n + 1);
            return { id: n === 0 ? base : `${base}-${n + 1}`, title, html: d.html };
          }),
        );
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // Production builds hide server error details behind a generic message
        setError(
          !msg || msg.includes("Server Components render")
            ? "Couldn't save the rules. Your edits are still here, so try again."
            : msg,
        );
      }
    });
  }

  return (
    <div className="space-y-3 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Editing Rules</h2>
          <p className="text-sm text-muted-foreground">
            Each card is one section. Use the toolbar for bold, lists, sub-headings and links.
          </p>
        </div>
      </div>

      <AddSectionButton onClick={() => insertAt(0)} />

      {drafts.map((d, i) => (
        <div key={d.key} className="space-y-3">
          <Card className="overflow-hidden border-blue-500/30">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600/20 text-sm font-black text-blue-300">
                {i + 1}
              </span>
              <Input
                value={d.title}
                onChange={(e) => update(d.key, { title: e.target.value })}
                placeholder="Section title (e.g. Trades)"
                className="min-w-0 flex-1 text-base font-bold"
              />
              <div className="flex items-center gap-1">
                <IconBtn title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></IconBtn>
                <IconBtn title="Move down" disabled={i === drafts.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></IconBtn>
                {confirmDelete === d.key ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => remove(d.key)}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-500"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <IconBtn title="Delete section" onClick={() => setConfirmDelete(d.key)} danger><Trash2 size={15} /></IconBtn>
                )}
              </div>
            </div>
            <SectionBodyEditor html={d.html} onChange={(html) => update(d.key, { html })} />
          </Card>
          <AddSectionButton onClick={() => insertAt(i + 1)} />
        </div>
      ))}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <span className={`text-sm ${dirty ? "text-yellow-400" : "text-muted-foreground"}`}>
            {dirty ? "● Unsaved changes" : "No changes yet"}
          </span>
          {error && <span className="text-sm text-red-400">✗ {error}</span>}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={cancel} disabled={isPending}>Cancel</Button>
            <Button onClick={save} disabled={isPending || !dirty}>
              {isPending ? "Saving…" : "Save all"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSectionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-blue-500/50 hover:bg-blue-500/5 hover:text-blue-300"
    >
      <Plus size={14} /> Add section here
    </button>
  );
}

function IconBtn({
  children, title, onClick, disabled, danger,
}: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 text-muted-foreground transition-colors disabled:opacity-30 ${
        danger ? "hover:bg-red-500/10 hover:text-red-400" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ── One section's body editor ────────────────────────────────────────────────

function SectionBodyEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      // h2 is reserved for section titles, so only allow sub-headings in the body
      StarterKit.configure({ heading: { levels: [3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: html,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "rich-content min-h-[120px] px-5 py-4 text-sm outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="h-10 border-b border-white/5" />;

  const btn = (active: boolean, title: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded p-1.5 transition-colors ${
        active ? "bg-blue-600/25 text-blue-300" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );

  function setLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url === "https://") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-white/5 bg-muted/30 px-3 py-1.5">
      {btn(editor.isActive("bold"), "Bold", () => editor.chain().focus().toggleBold().run(), <Bold size={15} />)}
      {btn(editor.isActive("italic"), "Italic", () => editor.chain().focus().toggleItalic().run(), <Italic size={15} />)}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn(editor.isActive("heading", { level: 3 }), "Sub-heading", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 size={15} />)}
      {btn(editor.isActive("bulletList"), "Bullet list", () => editor.chain().focus().toggleBulletList().run(), <List size={15} />)}
      {btn(editor.isActive("orderedList"), "Numbered list", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={15} />)}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn(editor.isActive("link"), "Add / edit link", setLink, <Link2 size={15} />)}
      {editor.isActive("link") &&
        btn(false, "Remove link", () => editor.chain().focus().unsetLink().run(), <Unlink size={15} />)}
    </div>
  );
}
