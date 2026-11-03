import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthDeps, MinimalSession } from './service';

type AuthState = { signedIn: boolean | null; email: string | null; userId: string | null };
type AuthContextValue = AuthState & { deps: AuthDeps };

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSession(session: MinimalSession | null): AuthState {
  return { signedIn: session !== null, email: session?.user.email ?? null, userId: session?.user.id ?? null };
}

/** Follows the Supabase session on this phone; `signedIn` is null until it has been read. */
export function AuthProvider({ deps, children }: { deps: AuthDeps; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ signedIn: null, email: null, userId: null });

  useEffect(() => {
    let active = true;
    void deps.client.getSession().then(({ data }) => {
      if (active) setState(fromSession(data.session));
    });
    const { data } = deps.client.onAuthStateChange((_event, session) => {
      if (active) setState(fromSession(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [deps]);

  return <AuthContext.Provider value={{ ...state, deps }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
