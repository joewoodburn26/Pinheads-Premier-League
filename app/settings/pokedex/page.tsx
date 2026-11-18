import { redirect } from "next/navigation";

// The Pokédex settings (points and bans) now live in Point Restructure.
export default function PokedexPage() {
  redirect("/settings/point-restructure");
}
