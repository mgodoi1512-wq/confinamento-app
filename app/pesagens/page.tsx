
import { supabase } from "@/lib/supabase";

export default async function PesagensPage() {
  const { data, error } = await supabase
    .from("pesagens")
    .select("*");

  if (error) {
    return (
      <main className="p-8">
        <h1>Erro</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Gestão de Pesagens
      </h1>

      <table className="w-full bg-white rounded-xl shadow">
        <thead>
          <tr>
            <th className="p-3 text-left">Animal ID</th>
            <th className="p-3 text-left">Peso</th>
            <th className="p-3 text-left">Data</th>
          </tr>
        </thead>

        <tbody>
          {data?.map((pesagem) => (
            <tr key={pesagem.id}>
              <td className="p-3">{pesagem.animal_id}</td>
              <td className="p-3">{pesagem.peso} kg</td>
              <td className="p-3">{pesagem.data_pesagem}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}