import { DamageCalculator } from "@/components/damage-calculator";
import { getPokemon } from "@/lib/data";

export default async function DamageCalculatorPage() {
  const pokemon = await getPokemon();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Damage Calculator</h1>
      <DamageCalculator pokemon={pokemon} />
    </div>
  );
}
