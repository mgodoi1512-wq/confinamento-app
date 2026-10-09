import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-green-800 text-white min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-8">
        ConfinaPro
      </h1>

      <nav className="flex flex-col gap-4">


<Link href="/">       
          📊 Dashboard
        </Link>
<Link href="/animais">       
          🐂 Animais
        </Link>
<Link href="/lotes">             
          📦 Lotes
        </Link>
<Link href="/pesagens">        
          ⚖️ Pesagens
        </Link>
      
      </nav>
    </aside>
  );
}