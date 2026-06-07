import { NextResponse } from "next/server";
import { updateMatch } from "@/lib/actions";

export async function PATCH(request: Request) {
  const formData = await request.formData();
  await updateMatch(formData);
  return NextResponse.json({ ok: true });
}
