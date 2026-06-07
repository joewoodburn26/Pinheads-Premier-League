"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImageUploadForm({ targetId, kind }: { targetId: string; kind: "team-logo" | "coach-image" }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("targetId", targetId);
        formData.set("kind", kind);
        startTransition(async () => {
          const response = await fetch("/api/uploads", { method: "POST", body: formData });
          const payload = await response.json();
          setMessage(payload.message ?? (payload.ok ? "Uploaded" : "Upload failed"));
          if (payload.ok) window.location.reload();
        });
      }}
    >
      <input name="file" type="file" accept="image/*" className="max-w-56 text-sm text-muted-foreground" />
      <Button disabled={pending} variant="secondary">
        <Upload size={16} />
        Upload
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </form>
  );
}
