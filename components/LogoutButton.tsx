"use client";

import { createClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  async function logout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  return (
    <button
  onClick={logout}
  className="text-white cursor-pointer hover:text-red-300"
>
      🚪 Sair
    </button>
  );
}