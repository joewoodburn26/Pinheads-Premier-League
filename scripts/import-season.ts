import xlsx from "xlsx";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

type Row = Record<string, string | number | boolean | undefined>;

function value(row: Row, keys: string[]) {
  const found = keys.find((key) => row[key] !== undefined && row[key] !== "");
  return found ? row[found] : undefined;
}

async function main() {
  const [, , filePath, seasonName = "Imported Season", budget = "105"] = process.argv;
  if (!filePath) throw new Error("Usage: npm run import:season -- ./draft.xlsx 'Season 2028' 105");

  const workbook = xlsx.readFile(filePath);
  const pokemonSheet = workbook.Sheets.Pokemon ?? workbook.Sheets.PokemonDatabase ?? workbook.Sheets[workbook.SheetNames[0]];
  const pokemonRows = xlsx.utils.sheet_to_json<Row>(pokemonSheet);
  const supabase = createSupabaseAdminClient();

  const { data: season, error } = await supabase
    .from("seasons")
    .insert({ name: seasonName, draft_budget: Number(budget), active_season: false })
    .select("id")
    .single();

  if (error) throw error;

  for (const row of pokemonRows) {
    const dexNumber = Number(value(row, ["dexNumber", "Dex", "Dex Number", "#"]));
    const name = String(value(row, ["name", "Name"]));
    if (!dexNumber || !name) continue;

    await supabase.from("pokemon").upsert({
      dex_number: dexNumber,
      name,
      sprite_url: String(value(row, ["spriteUrl", "Sprite"]) ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNumber}.png`),
      primary_type: String(value(row, ["primaryType", "Type 1", "Type"]) ?? "Normal"),
      secondary_type: value(row, ["secondaryType", "Type 2"]) ?? null,
      hp: Number(value(row, ["hp", "HP"]) ?? 0),
      attack: Number(value(row, ["attack", "Atk"]) ?? 0),
      defense: Number(value(row, ["defense", "Def"]) ?? 0),
      special_attack: Number(value(row, ["specialAttack", "SpA"]) ?? 0),
      special_defense: Number(value(row, ["specialDefense", "SpD"]) ?? 0),
      speed: Number(value(row, ["speed", "Spe"]) ?? 0),
      bst: Number(value(row, ["bst", "BST"]) ?? 0),
      point_value: Number(value(row, ["pointValue", "Cost", "Points"]) ?? 1),
      legendary: Boolean(value(row, ["legendary", "Legendary"]) ?? false),
      mythical: Boolean(value(row, ["mythical", "Mythical"]) ?? false),
      paradox: Boolean(value(row, ["paradox", "Paradox"]) ?? false)
    });
  }

  console.log(`Imported ${pokemonRows.length} Pokemon rows for ${seasonName} (${season.id}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
