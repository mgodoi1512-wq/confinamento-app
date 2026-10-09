"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NovoAnimal() {
  const [brinco, setBrinco] = useState("");
  const [lote, setLote] = useState("");
  const [peso, setPeso] = useState("");
  const [status, setStatus] = useState("Ativo");

  async function salvarAnimal(e: React.FormEvent) {
  e.preventDefault();

  // Verifica se o lote existe
  const { data: loteExistente } = await supabase
    .from("lotes")
    .select("*")
    .eq("nome", lote)
    .maybeSingle();

  // Se não existir, cria
  if (!loteExistente) {
    const { error: erroLote } = await supabase
      .from("lotes")
      .insert([
        {
          nome: lote,
        },
      ]);

    if (erroLote) {
      alert("Erro ao criar lote: " + erroLote.message);
      return;
    }
  }

  // Cria o animal
  const { error } = await supabase
    .from("animais")
    .insert([
      {
        brinco,
        lote,
        peso_atual: Number(peso),
        status,
      },
    ]);

  if (error) {
    alert("Erro: " + error.message);
    return;
  }

  alert("Animal cadastrado com sucesso!");

  setBrinco("");
  setLote("");
  setPeso("");
  setStatus("Ativo");
}

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Novo Animal
      </h1>

      <form onSubmit={salvarAnimal} className="space-y-4 max-w-md">
        <input
          value={brinco}
          onChange={(e) => setBrinco(e.target.value)}
          type="text"
          placeholder="Brinco"
          className="w-full border p-3 rounded"
        />

        <input
          value={lote}
          onChange={(e) => setLote(e.target.value)}
          type="text"
          placeholder="Lote"
          className="w-full border p-3 rounded"
        />

        <input
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          type="number"
          placeholder="Peso Atual"
          className="w-full border p-3 rounded"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border p-3 rounded"
        >
          <option>Ativo</option>
          <option>Vendido</option>
          <option>Morto</option>
        </select>

        <button
          type="submit"
          className="bg-green-700 text-white px-5 py-3 rounded"
        >
          Salvar Animal
        </button>
      </form>
    </main>
  );
}