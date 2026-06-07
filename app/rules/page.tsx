import { RulesEditor } from "@/components/rules-editor";
import { getRules } from "@/lib/data";

export default async function RulesPage() {
  const initial = await getRules();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Rules</h1>
      <RulesEditor content={initial} />
    </div>
  );
}
