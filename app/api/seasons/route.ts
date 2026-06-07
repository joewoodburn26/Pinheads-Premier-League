import { NextResponse } from "next/server";
import { createSeason } from "@/lib/actions";

export async function POST(request: Request) {
  const formData = await request.formData();
  await createSeason(formData);
  return NextResponse.json({ ok: true });
}
