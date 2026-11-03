import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { checkApi } from './api/health';
import Foundation from './app/index';
import { darkColors, lightColors, themeFor } from './theme';

describe('theme', () => {
  it('follows the phone setting and defaults to dark', () => {
    expect(themeFor('light').colors).toBe(lightColors);
    expect(themeFor('dark').colors).toBe(darkColors);
    expect(themeFor(null).scheme).toBe('dark');
  });

  it('has the same tokens in both themes', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
  });
});

describe('checkApi', () => {
  const ok = (body: unknown) => (async () => Response.json(body)) as typeof fetch;

  it('needs an address', async () => {
    expect(await checkApi('')).toBe('not-configured');
  });
  it('is reachable only when the coach API answers', async () => {
    expect(await checkApi('http://pc:3100', ok({ status: 'ok', service: 'coach-api' }))).toBe('reachable');
    expect(await checkApi('http://pc:3100', ok({ status: 'ok' }))).toBe('unreachable');
  });
  it('is unreachable on a network error', async () => {
    const failing = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    expect(await checkApi('http://pc:3100', failing)).toBe('unreachable');
  });
});

describe('Foundation screen', () => {
  it('shows the coach wordmark and asks for the API address when none is set', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <Foundation apiUrl="" />
      </SafeAreaProvider>,
    );
    expect(screen.getByLabelText('FitSphere Coach')).toBeTruthy();
    expect(await screen.findByText(/Set EXPO_PUBLIC_API_URL/)).toBeTruthy();
  });
});
