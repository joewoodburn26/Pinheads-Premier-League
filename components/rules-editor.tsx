"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { updateRules } from "@/lib/actions";

// ── Parse HTML into sections by h2/h3 headings ────────────────────────────────

interface RuleSection {
  title: string;
  content: string;
}

function parseRuleSections(html: string): RuleSection[] {
  if (typeof window === "undefined") return [];

  const div = document.createElement("div");
  div.innerHTML = html;

  const sections: RuleSection[] = [];
  let currentTitle = "";
  let currentNodes: Node[] = [];

  function flush() {
    if (currentTitle) {
      const wrapper = document.createElement("div");
      currentNodes.forEach(n => wrapper.appendChild(n.cloneNode(true)));
      sections.push({ title: currentTitle, content: wrapper.innerHTML });
    }
  }

  div.childNodes.forEach(node => {
    const el = node as HTMLElement;
    if (el.tagName === "H2" || el.tagName === "H3" || el.tagName === "H1") {
      flush();
      currentTitle = el.textContent ?? "";
      currentNodes = [];
    } else {
      currentNodes.push(node);
    }
  });

  flush();

  // If no headings found, treat entire content as one section
  if (sections.length === 0 && html.trim()) {
    sections.push({ title: "Rules", content: html });
  }

  return sections;
}

// ── Full editor modal ─────────────────────────────────────────────────────────

function EditorModal({ content, onClose }: { content: string; onClose: () => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Link],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-content min-h-[400px] rounded-md border bg-background p-4 outline-none focus:ring-1 focus:ring-primary"
      }
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border bg-card shadow-xl mt-8 mb-8">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-black">Edit Rules</h2>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 rounded-md border bg-muted/40 p-2">
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs font-bold"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              data-active={editor?.isActive("bold")}>B</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs italic"
              onClick={() => editor?.chain().focus().toggleItalic().run()}>I</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}>• List</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. List</Button>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}>― HR</Button>
          </div>

          <EditorContent editor={editor} />

          <p className="text-xs text-muted-foreground">
            💡 Tip: Use <strong>H2</strong> or <strong>H3</strong> headings to create separate accordion sections on the rules page.
          </p>

          <div className="flex gap-3 border-t pt-4">
            <Button onClick={() => {
              const fd = new FormData();
              fd.set("content", editor?.getHTML() ?? "");
              updateRules(fd);
              onClose();
            }}>
              Save Rules
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({ section, index }: { section: RuleSection; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-base font-bold">{section.title}</span>
        {open ? <ChevronUp size={18} className="text-muted-foreground shrink-0" /> : <ChevronDown size={18} className="text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div
          className="rich-content border-t px-5 py-4 text-sm"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RulesEditor({ content }: { content: string }) {
  const [showEditor, setShowEditor] = useState(false);
  const [sections, setSections] = useState<RuleSection[] | null>(null);

  // Parse sections client-side on first render
  if (sections === null && typeof window !== "undefined") {
    setSections(parseRuleSections(content));
  }

  return (
    <div className="space-y-4">
      {/* Edit button */}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setShowEditor(true)}>
          <Pencil size={14} className="mr-2" /> Edit Rules
        </Button>
      </div>

      {/* Accordion sections */}
      {sections && sections.length > 0 ? (
        <div className="space-y-2">
          {sections.map((section, i) => (
            <AccordionSection key={i} section={section} index={i} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-sm">No rules added yet.</p>
          <p className="text-xs mt-1">Click &quot;Edit Rules&quot; to add your first rule. Use H2 or H3 headings to create separate sections.</p>
        </Card>
      )}

      {/* Editor modal */}
      {showEditor && (
        <EditorModal content={content} onClose={() => {
          setShowEditor(false);
          // Re-parse sections after save
          setSections(parseRuleSections(content));
        }} />
      )}
    </div>
  );
}
