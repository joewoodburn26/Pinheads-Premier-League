import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { denied, requireCoachEditor, requireTeamEditor } from "@/lib/auth";

const uploadSchema = z.object({
  targetId: z.string().min(1),
  kind: z.enum(["team-logo", "coach-image"])
});

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  try {
    if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return fail("Supabase is not configured.");
    }

    const formData = await request.formData();
    const parsed = uploadSchema.safeParse({
      targetId: formData.get("targetId"),
      kind: formData.get("kind"),
    });
    if (!parsed.success) return fail("Missing team/coach id — assign a coach to this team first.");
    const input = parsed.data;

    const blocked = await denied(() =>
      input.kind === "team-logo" ? requireTeamEditor(input.targetId) : requireCoachEditor(input.targetId)
    );
    if (blocked) return fail(blocked, 403);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("No file uploaded.");

    const supabase = createSupabaseAdminClient();
    const extension = file.name.split(".").pop() ?? "png";
    const path = `${input.kind}/${input.targetId}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from("team-assets")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) return fail(error.message, 500);

    const { data } = supabase.storage.from("team-assets").getPublicUrl(path);
    const { error: dbError } = input.kind === "team-logo"
      ? await supabase.from("teams").update({ logo_url: data.publicUrl }).eq("id", input.targetId)
      : await supabase.from("coaches").update({ image_url: data.publicUrl }).eq("id", input.targetId);
    if (dbError) return fail(dbError.message, 500);

    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Upload failed", 500);
  }
}
