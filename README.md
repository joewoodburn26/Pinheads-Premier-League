# Pinheads Draft

Production-ready Next.js 15 App Router application for managing a Pokemon draft league across multiple seasons.

## Stack

- Next.js 15, TypeScript, Tailwind CSS
- shadcn-style UI primitives
- Supabase PostgreSQL and optional Supabase Storage
- React Hook Form and Zod validation foundation
- TipTap rich text editor for rules
- Vercel-ready deployment

## Local Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill Supabase values.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Seed demo seasons: `npm run seed`
5. Start locally: `npm run dev`

Without Supabase environment variables, the app runs against local mock data so the UI is immediately explorable.

## Spreadsheet Import

The checked-in Season 2026 data was generated from `Draft2026_v2 (1).xlsx` with:

```bash
python scripts/generate-imported-data.py "C:/Users/joewo/Downloads/Draft2026_v2 (1).xlsx" lib/imported-2026.ts
```

Import a future season workbook:

```bash
npm run import:season -- ./draft.xlsx "Season 2028" 105
```

The importer reads a `Pokemon`, `PokemonDatabase`, or first worksheet and maps common column names for dex number, name, typing, stats, point value, and legendary/mythical/paradox flags.

## Vercel Deployment

1. Push the repository to GitHub.
2. Create a Vercel project from the repository.
3. Add environment variables from `.env.example`.
4. Deploy.

## Replay Parsing Architecture

The `replay_imports` table stores Pokemon Showdown replay URLs, parser status, parsed payloads, errors, and processed timestamps. Future parser jobs can read schedule replay links, calculate KOs, deaths, games played, wins/losses, and update `pokemon_stats`.
