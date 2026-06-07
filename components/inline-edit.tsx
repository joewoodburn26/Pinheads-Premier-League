"use client";

import { useState, useTransition } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InlineEdit({
  value,
  name,
  action,
  multiline = false
}: {
  value: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button className="group inline-flex items-center gap-2 text-left" onClick={() => setEditing(true)}>
        <span>{value || "Click to edit"}</span>
        <Pencil className="opacity-50 group-hover:opacity-100" size={14} />
      </button>
    );
  }

  return (
    <form
      className="flex w-full items-start gap-2"
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          setEditing(false);
        });
      }}
    >
      {multiline ? (
        <textarea name={name} defaultValue={value} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" />
      ) : (
        <Input name={name} defaultValue={value} />
      )}
      <Button disabled={pending} className="shrink-0">
        <Save size={16} />
      </Button>
    </form>
  );
}
