import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile, Role } from "@/lib/domain";

export type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  isGestor: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);
