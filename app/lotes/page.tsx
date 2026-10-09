
import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
export default async function LotesPage() {
  noStore();

  const { data } = await supabase
    .from("lotes")
    .select("*");
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Gestão de Lotes
      </h1>

      <table className="w-full bg-white rounded-xl shadow">
        <thead>
          <tr>
            <th className="p-3 text-left">ID</th>
            <th className="p-3 text-left">Nome</th>
          </tr>
        </thead>

        <tbody>
          {data?.map((lote) => (
            <tr key={lote.id}>
              <td className="p-3">{lote.id}</td>
              <td className="p-3">{lote.nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}