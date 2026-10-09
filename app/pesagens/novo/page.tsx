"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NovaPesagem() {
  const [animais, setAnimais] = useState<any[]>([]);
  const [animalId, setAnimalId] = useState("");
  const [peso, setPeso] = useState("");
  const [dataPesagem, setDataPesagem] = useState("");

  useEffect(() => {
    async function carregarAnimais() {
      const { data } = await supabase
        .from("animais")
        .select("id, brinco");

      if (data) {
        setAnimais(data);
      }
    }

    carregarAnimais();
  }, []);

  async function salvarPesagem(e: React.FormEvent) {
  e.preventDefault();

  const novoPeso = Number(peso);

  // Guarda a pesagem
  const { error: erroPesagem } = await supabase
    .from("pesagens")
    .insert([
      {
        animal_id: Number(animalId),
        peso: novoPeso,
        data_pesagem: dataPesagem,
      },
    ]);

  if (erroPesagem) {
    alert(erroPesagem.message);
    return;
  }

  // Atualiza o peso atual do animal
  const { error: erroAnimal } = await supabase
    .from("animais")
    .update({
      peso_atual: novoPeso,
    })
    .eq("id", Number(animalId));

  if (erroAnimal) {
    alert(erroAnimal.message);
    return;
  }

  alert("Pesagem cadastrada com sucesso!");

  setAnimalId("");
  setPeso("");
  setDataPesagem("");
}

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Nova Pesagem
      </h1>

      <form
        onSubmit={salvarPesagem}
        className="space-y-4 max-w-md"
      >
        <select
          value={animalId}
          onChange={(e) => setAnimalId(e.target.value)}
          className="w-full border p-3 rounded"
        >
          <option value="">
            Selecione um animal
          </option>

          {animais.map((animal) => (
            <option
              key={animal.id}
              value={animal.id}
            >
              Brinco {animal.brinco}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Peso (kg)"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          type="date"
          value={dataPesagem}
          onChange={(e) => setDataPesagem(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <button
          type="submit"
          className="bg-green-600 text-white px-5 py-3 rounded"
        >
          Salvar Pesagem
        </button>
      </form>
    </main>
  );
}
