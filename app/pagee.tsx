export default function Home() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Menu */}
      <aside className="w-64 bg-green-800 text-white p-6">
        <h1 className="text-2xl font-bold mb-8">
          LiBen Confinamento
        </h1>

        <nav className="space-y-4">
          <p>📊 Dashboard</p>
          <p>🐂 Animais</p>
          <p>📦 Lotes</p>
          <p>🌽 Nutrição</p>
          <p>💉 Sanidade</p>
          <p>💰 Financeiro</p>
          <p>📈 Relatórios</p>
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-8">
        <h1 className="text-4xl font-bold mb-8">
          Dashboard
        </h1>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow">
            <p>Animais</p>
            <h2 className="text-3xl font-bold">8453</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <p>Lotes</p>
            <h2 className="text-3xl font-bold">27</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <p>Peso Médio</p>
            <h2 className="text-3xl font-bold">492 kg</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <p>GMD</p>
            <h2 className="text-3xl font-bold">1,68</h2>
          </div>
        </div>
      </main>
    </div>
  );
}