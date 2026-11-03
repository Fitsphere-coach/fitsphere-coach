// Fonts are files the bundler serves to the app. Tests have no bundler, so fonts count as loaded.
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
  useFonts: () => [true, null],
}));
