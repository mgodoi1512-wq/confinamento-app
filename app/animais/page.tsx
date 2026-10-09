
import { supabase } from "@/lib/supabase";

export default async function AnimaisPage() {
  const { data, error } = await supabase
    .from("animais")
    .select("*");

  if (error) {
    return (
      <main className="p-8">
        <h1>Erro:</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Gestão de Animais
      </h1>
<button
          className="bg-green-700 text-white px-5 py-3 rounded" 
        >
         <a
  href="/animais/novo"> + Animal
         </a>
        </button>
      <table className="w-full bg-white rounded-xl shadow">
        <thead>
          <tr>
            <th className="p-3 text-left">Brinco</th>
            <th className="p-3 text-left">Lote</th>
            <th className="p-3 text-left">Peso</th>
            <th className="p-3 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {data?.map((animal) => (
            <tr key={animal.id}>
              <td className="p-3">{animal.brinco}</td>
              <td className="p-3">{animal.lote}</td>
              <td className="p-3">{animal.peso_atual}</td>
              <td className="p-3">{animal.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}