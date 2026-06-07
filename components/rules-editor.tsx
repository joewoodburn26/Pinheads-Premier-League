"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { updateRules } from "@/lib/actions";

export function RulesEditor({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [StarterKit, Link],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-content min-h-80 rounded-md border bg-background p-4 outline-none"
      }
    }
  });

  return (
    <form
      action={(formData) => {
        formData.set("content", editor?.getHTML() ?? "");
        updateRules(formData);
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().toggleBold().run()}>B</Button>
        <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().toggleItalic().run()}>I</Button>
        <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</Button>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name="content" />
      <Button>Save Rules</Button>
    </form>
  );
}
