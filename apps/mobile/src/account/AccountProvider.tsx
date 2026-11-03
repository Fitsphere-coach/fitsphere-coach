// The signed-in account as the app last read it (GET /v1/me), shared by the screens.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, type AccountState } from '../auth/service';

type AccountContextValue = { state: AccountState | null; refresh(): Promise<AccountState> };

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { deps } = useAuth();
  const [state, setState] = useState<AccountState | null>(null);
  const refresh = useCallback(async () => {
    const next = await ensureAccount(deps);
    setState(next);
    return next;
  }, [deps]);
  return <AccountContext.Provider value={{ state, refresh }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}

/** Where each account state goes (CF01-coach-auth-ui.md §2). */
export function destinationFor(state: AccountState): string {
  switch (state.kind) {
    case 'coach':
      return '/home';
    case 'coachingOff':
      return '/coaching-off';
    case 'emailNotVerified':
      return `/check-email?email=${encodeURIComponent(state.email ?? '')}`;
    case 'signedOut':
      return '/sign-in?expired=1';
    default:
      return '/';
  }
}

export function roleLabel(roles: readonly string[]): string {
  return roles.includes('head_coach') ? 'Head coach' : 'Coach';
}
