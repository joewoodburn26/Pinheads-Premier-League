"use client";

// Admin edit mode for the Rules page, loaded on demand by components/rules-editor.tsx.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  ArrowDown, ArrowUp, Bold, Heading3, Italic, Link2, List, ListOrdered, Plus, Trash2, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateRules } from "@/lib/actions";
import { serializeRules, slugify, stripHtml, type RuleSection } from "@/lib/rules";


// ════════════════════════════════════════════════════════════════════════════
// Edit mode
// ════════════════════════════════════════════════════════════════════════════

type Draft = { key: string; title: string; html: string };

let keySeq = 0;
const newKey = () => `s${Date.now()}-${keySeq++}`;

export function RulesEditMode({
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
