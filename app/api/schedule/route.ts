import { NextResponse } from "next/server";
import { updateMatch } from "@/lib/actions";

export async function PATCH(request: Request) {
  try {
    const formData = await request.formData();
    await updateMatch(formData);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Couldn't save the match." },
      { status: 403 },
    );
  }
}
