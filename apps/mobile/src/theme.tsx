// FitSphere design tokens (docs/design/design-system.md), shared with the trainee app. The theme
// follows the phone setting; Dark is the hero theme.
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export const darkColors = {
  bg: '#11212D',
  surface: '#182B37',
  surfaceRaised: '#213744',
  surfaceSunken: '#0C1820',
  border: '#2C4250',
  track: '#263C49',
  ink: '#F1EAE5',
  inkMuted: '#A79E9C',
  inkSubtle: '#6F7F88',
  accent: '#C99A73',
  accentTint: '#3A332C',
  primary: '#B58863',
  primaryPressed: '#9C7150',
  onPrimary: '#161616',
  success: '#7FB89A',
  successTint: 'rgba(127,184,154,0.14)',
  warning: '#E8C37C',
  danger: '#E5806F',
  dangerTint: 'rgba(229,128,111,0.12)',
  focus: '#E3D5CC',
  scrim: 'rgba(5,10,14,0.66)',
  stripe: 'rgba(201,154,115,0.08)',
};

export type Colors = typeof darkColors;

export const lightColors: Colors = {
  bg: '#F4EFEC',
  surface: '#FBF8F6',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EDE5E0',
  border: '#DDD1CA',
  track: '#E6DCD6',
  ink: '#11212D',
  inkMuted: '#3D4D55',
  inkSubtle: '#8A817F',
  accent: '#7D5434',
  accentTint: '#F3E6DA',
  primary: '#B58863',
  primaryPressed: '#9C7150',
  onPrimary: '#161616',
  success: '#3F7A5C',
  successTint: 'rgba(63,122,92,0.10)',
  warning: '#96650F',
  danger: '#B0463A',
  dangerTint: 'rgba(176,70,58,0.08)',
  focus: '#11212D',
  scrim: 'rgba(17,33,45,0.40)',
  stripe: 'rgba(125,84,52,0.07)',
};

/** Font family names as loaded in the root layout. */
export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  displayBold: 'BarlowCondensed_700Bold',
  displayItalic: 'BarlowCondensed_800ExtraBold_Italic',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
};

export const radius = { xs: 2, sm: 4, md: 8, sheet: 16 };

export type Theme = { scheme: 'dark' | 'light'; colors: Colors };

export function themeFor(scheme: string | null | undefined): Theme {
  return scheme === 'light' ? { scheme: 'light', colors: lightColors } : { scheme: 'dark', colors: darkColors };
}

const ThemeContext = createContext<Theme>(themeFor('dark'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return <ThemeContext.Provider value={themeFor(scheme)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
