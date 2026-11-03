// supabase-js needs a full URL implementation (Supabase's React Native guide).
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';
import { config } from '../config';
import type { AuthDeps } from './service';
import { createSessionStorage } from './storage';

/** The real Supabase client with the publishable key; null until apps/mobile/.env has both values. */
export function createAuthDeps(): AuthDeps | null {
  if (!config.supabaseUrl || !config.supabasePublishableKey) return null;
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      storage: createSessionStorage(),
      storageKey: 'fitsphere-coach-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Email links carry a one-time code, not tokens (same as the trainee app).
      flowType: 'pkce',
    },
  });
  // Refresh the session only while the app is in the foreground (Supabase's React Native guide).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  return {
    client: supabase.auth as unknown as AuthDeps['client'],
    apiUrl: config.apiUrl || undefined,
    // `fitspherecoach://verified` in a build; an `exp://…/--/verified` address in Expo Go. Both must
    // be in Supabase's Redirect URLs (runbook §5).
    links: { verified: Linking.createURL('verified'), resetPassword: Linking.createURL('reset-password') },
  };
}
