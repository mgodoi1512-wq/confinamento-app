import { useContext } from "react";

import { AuthContext, type AuthValue } from "@/components/auth/auth-context";

/** Sessão e perfil do usuário autenticado. */
export const useAuth = (): AuthValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
};
