import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";

const uploadSchema = z.object({
  targetId: z.string().min(1),
  kind: z.enum(["team-logo", "coach-image"])
});

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 400 });
  }

  const formData = await request.formData();
  const input = uploadSchema.parse(Object.fromEntries(formData));
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No file uploaded." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop() ?? "png";
  const path = `${input.kind}/${input.targetId}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("team-assets").upload(path, file, { upsert: true });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const { data } = supabase.storage.from("team-assets").getPublicUrl(path);
  if (input.kind === "team-logo") {
    await supabase.from("teams").update({ logo_url: data.publicUrl }).eq("id", input.targetId);
  } else {
    await supabase.from("coaches").update({ image_url: data.publicUrl }).eq("id", input.targetId);
  }

  return NextResponse.json({ ok: true, url: data.publicUrl });
}
