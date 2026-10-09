
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: animais } = await supabase
    .from("animais")
    .select("*");

  const { data: lotes } = await supabase
    .from("lotes")
    .select("*");

  const totalAnimais = animais?.length || 0;
  const totalLotes = lotes?.length || 0;

  const pesoMedio =
    animais && animais.length > 0
      ? (
          animais.reduce(
            (acc, animal) =>
              acc + Number(animal.peso_atual || 0),
            0
          ) / animais.length
        ).toFixed(1)
      : "0";
const gmdMedio =
  animais && animais.length > 0
    ? (
        animais.reduce((acc, animal) => {
          const pesoInicial = Number(
            animal.peso_inicial || 0
          );

          const pesoAtual = Number(
            animal.peso_atual || 0
          );

          const ganho = pesoAtual - pesoInicial;

          return acc + ganho;
        }, 0) / animais.length / 100
      ).toFixed(2)
    : "0";
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <h1 className="text-4xl font-bold mb-8">
        Dashboard do Confinamento
      </h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
  <p className="text-gray-500">
    GMD Médio
  </p>

  <h2 className="text-4xl font-bold">
    {gmdMedio}
  </h2>

  <p className="text-sm text-gray-500">
    kg/dia
  </p>
</div>
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-gray-500">
            Total de Animais
          </p>

          <h2 className="text-4xl font-bold">
            {totalAnimais}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-gray-500">
            Total de Lotes
          </p>

          <h2 className="text-4xl font-bold">
            {totalLotes}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-gray-500">
            Peso Médio
          </p>

          <h2 className="text-4xl font-bold">
            {pesoMedio} kg
          </h2>
        </div>
      </div>
    </main>
  );
}