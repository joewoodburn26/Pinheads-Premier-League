"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

// Vercel rejects request bodies over ~4.5 MB, so shrink images in the browser first.
const MAX_DIMENSION = 1600;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

async function shrinkImage(file: File): Promise<File> {
  // Leave GIFs/SVGs alone (resizing would lose animation / vectors)
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

export function ImageUploadForm({ targetId, kind }: { targetId: string; kind: "team-logo" | "coach-image" }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const picked = new FormData(form).get("file");

        if (!targetId) {
          setMessage("No coach/team linked yet — assign one first.");
          return;
        }
        if (!(picked instanceof File) || picked.size === 0) {
          setMessage("Choose an image first.");
          return;
        }

        startTransition(async () => {
          try {
            setMessage("Uploading…");
            const file = await shrinkImage(picked);
            if (file.size > MAX_UPLOAD_BYTES) {
              setMessage("Image is too large — try a smaller one.");
              return;
            }

            const formData = new FormData();
            formData.set("file", file);
            formData.set("targetId", targetId);
            formData.set("kind", kind);

            const response = await fetch("/api/uploads", { method: "POST", body: formData });
            const text = await response.text();
            let payload: { ok?: boolean; message?: string } = {};
            try {
              payload = JSON.parse(text);
            } catch {
              payload = { ok: false, message: response.status === 413 ? "Image is too large." : `Upload failed (${response.status})` };
            }

            if (response.ok && payload.ok) {
              setMessage("Uploaded");
              window.location.reload();
            } else {
              setMessage(payload.message ?? "Upload failed");
            }
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Upload failed");
          }
        });
      }}
    >
      <input name="file" type="file" accept="image/*" className="max-w-56 text-sm text-muted-foreground" />
      <Button disabled={pending} variant="secondary">
        <Upload size={16} />
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </form>
  );
}
