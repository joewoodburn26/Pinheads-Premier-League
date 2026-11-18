"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPointList, deletePointList, importPointsWorkbook, renamePointList } from "@/lib/point-list-actions";
import type { PointList } from "@/lib/types";

type Mode = null | "new" | "rename" | "delete";

/** Pick / create / rename / delete a point list, plus the Excel download and upload. */
export function ListBar({
  lists,
  list,
  format,
  formatName,
  dirty,
  onSwitch,
}: {
  lists: PointList[];
  list: PointList;
  format: string;
  formatName: string;
  /** Unsaved edits on the page (blocks uploads and switching without a warning) */
  dirty: boolean;
  onSwitch: (listId: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState(list.id);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const open = (m: Mode, presetName = "") => {
    setMode(m);
    setName(presetName);
    setCopyFrom(list.id);
    setMessage(null);
  };

  const act = (fn: () => Promise<{ error?: string; id?: string }>, done: string, goTo?: (id?: string) => string | undefined) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) return setMessage({ text: res.error, tone: "error" });
      setMode(null);
      setMessage({ text: done, tone: "ok" });
      const target = goTo?.(res.id);
      if (target) router.push(`/settings/point-restructure?list=${target}`);
      else router.refresh();
    });

  const upload = (file: File) => {
    if (dirty) {
      setMessage({ text: "Save or discard your changes on this page before uploading.", tone: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await importPointsWorkbook(list.id, fd);
      if (fileRef.current) fileRef.current.value = "";
      if (res.error) return setMessage({ text: res.error, tone: "error" });
      const nf = res.notFound?.length ? ` Not found: ${res.notFound.slice(0, 8).join(", ")}${res.notFound.length > 8 ? "…" : ""}.` : "";
      setMessage({
        text: `Updated ${res.updated} Pokémon in ${list.name} (${res.unchanged} unchanged).${nf}`,
        tone: res.notFound?.length ? "error" : "ok",
      });
      router.refresh();
    });
  };

  const inUse = list.seasons.length > 0;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Point list</label>
          <select
            value={list.id}
            onChange={(e) => onSwitch(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-base font-bold"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.seasons.length ? ` · ${l.seasons.map((s) => s.name).join(", ")}` : " · not used"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => open("new")}><Plus size={14} className="mr-1" /> New</Button>
          <Button variant="secondary" onClick={() => open("new", `${list.name} copy`)}><Copy size={14} className="mr-1" /> Duplicate</Button>
          <Button variant="secondary" onClick={() => open("rename", list.name)}><Pencil size={14} className="mr-1" /> Rename</Button>
          <Button
            variant="secondary"
            onClick={() => open("delete")}
            disabled={inUse}
            title={inUse ? "Seasons still use this list" : "Delete this list"}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Used by:</span>
        {inUse ? (
          list.seasons.map((s) => (
            <span key={s.id} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.activeSeason ? "border-primary/50 bg-primary/10 text-primary" : ""}`}>
              {s.name}{s.activeSeason ? " · active" : ""}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No seasons yet. Pick it for a season under Season Management.</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href={`/api/point-lists/${list.id}/workbook?format=${encodeURIComponent(format)}`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80"
            title={`Excel file of the Pokémon legal in ${formatName}`}
          >
            <Download size={14} /> Download Excel
          </a>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 ${isPending ? "pointer-events-none opacity-50" : ""}`}>
            <Upload size={14} /> {isPending ? "Working…" : "Upload Excel"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {mode === "new" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New list name</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gen 5 Default" />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start with the points from</label>
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <Button disabled={isPending || !name.trim()} onClick={() => act(() => createPointList(name, copyFrom), `Created ${name.trim()}.`, (id) => id)}>
            Create
          </Button>
          <Button variant="secondary" onClick={() => setMode(null)}><X size={14} /></Button>
        </div>
      )}

      {mode === "rename" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rename {list.name}</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button disabled={isPending || !name.trim()} onClick={() => act(() => renamePointList(list.id, name), "Renamed.")}>Save</Button>
          <Button variant="secondary" onClick={() => setMode(null)}><X size={14} /></Button>
        </div>
      )}

      {mode === "delete" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <span>Delete <b>{list.name}</b>? Its points and bans are removed for good.</span>
          <Button
            className="ml-auto bg-red-600 text-white hover:bg-red-700"
            disabled={isPending}
            onClick={() => act(() => deletePointList(list.id), `Deleted ${list.name}.`, () => lists.find((l) => l.id !== list.id)?.id)}
          >
            Delete
          </Button>
          <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.tone === "error" ? "text-red-400" : "text-green-400"}`}>{message.text}</p>
      )}
    </Card>
  );
}
