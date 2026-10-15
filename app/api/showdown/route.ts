import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "raw.githubusercontent.com",
];

/**
 * GET /api/showdown?url=<encoded-github-raw-url>
 *
 * Server-side proxy for Pokémon Showdown raw data files.
 * Avoids CORS issues when fetching from the client.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "pinheads-draft/1.0" },
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status });
    }
    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
