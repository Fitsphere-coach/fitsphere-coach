import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import expoPlugin from 'eslint-plugin-expo';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/.expo/',
    'apps/mobile/android/',
    'apps/mobile/ios/',
    'apps/mobile/expo-env.d.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  // eslint-config-expo 58 bundles a React plugin that fails on ESLint 10, so the app uses the
  // two plugins from it that matter here directly. Switch back once it supports ESLint 10.
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    plugins: { expo: expoPlugin },
    rules: {
      // Expo builds only literal process.env.EXPO_PUBLIC_* reads into the app.
      'expo/no-dynamic-env-var': 'error',
      'expo/no-env-var-destructuring': 'error',
    },
  },
);
