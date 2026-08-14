import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { securePasscode } from "@/src/services/secure-store";

type AuthContextValue = { ready: boolean; unlocked: boolean; unlock: (passcode: string) => Promise<void>; lock: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    securePasscode.read().then((passcode) => setUnlocked(Boolean(passcode))).finally(() => setReady(true));
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    ready,
    unlocked,
    unlock: async (passcode) => { await securePasscode.save(passcode); setUnlocked(true); },
    lock: async () => { await securePasscode.clear(); setUnlocked(false); },
  }), [ready, unlocked]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
