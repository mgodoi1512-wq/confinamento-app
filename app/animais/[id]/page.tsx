export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

export default async function AnimalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: animal } = await supabase
    .from("animais")
    .select("*")
    .eq("id", id)
    .single();

  const { data: pesagens } = await supabase
    .from("pesagens")
    .select("*")
    .eq("animal_id", id)
    .order("data_pesagem", {
      ascending: false,
    });
const pesoInicial = Number(animal?.peso_inicial || 0);
const pesoAtual = Number(animal?.peso_atual || 0);

let gmd = 0;

if (pesagens && pesagens.length > 1) {
  const primeiraData = new Date(
    pesagens[pesagens.length - 1].data_pesagem
  );

  const ultimaData = new Date(
    pesagens[0].data_pesagem
  );

  const dias =
    (ultimaData.getTime() - primeiraData.getTime()) /
    (1000 * 60 * 60 * 24);

  if (dias > 0) {
    gmd = (pesoAtual - pesoInicial) / dias;
  }
}
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Animal {animal?.brinco}
      </h1>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <p>Brinco: {animal?.brinco}</p>
        <p>Peso Atual: {animal?.peso_atual} kg</p>
        <p>
  Peso Inicial: {animal?.peso_inicial} kg
</p>

<p>
  GMD: {gmd.toFixed(2)} kg/dia
</p>
        <p>Status: {animal?.status}</p>
      </div>

      <h2 className="text-2xl font-bold mb-4">
        Histórico de Pesagens
      </h2>

      <table className="w-full bg-white rounded-xl shadow">
        <thead>
          <tr>
            <th className="p-3 text-left">Data</th>
            <th className="p-3 text-left">Peso</th>
          </tr>
        </thead>

        <tbody>
          {pesagens?.map((pesagem) => (
            <tr key={pesagem.id}>
              <td className="p-3">
                {pesagem.data_pesagem}
              </td>

              <td className="p-3">
                {pesagem.peso} kg
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}