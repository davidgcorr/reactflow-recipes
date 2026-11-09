import { describe, expect, it } from 'vitest';
import { defaultTheme } from './model';
import { themeVariables } from './theme';

describe('workspace theme', () => {
  it('starts with an achromatic black and white palette', () => {
    const vars = themeVariables(defaultTheme);
    expect(vars['--background']).toBe('oklch(1 0 0)');
    expect(vars['--primary']).toBe('oklch(0.205 0 0)');
    for (const [key, value] of Object.entries(vars)) {
      if (key !== '--radius') expect(value).toMatch(/^oklch\([\d.]+ 0 0\)$/);
    }
  });
  it('tunes surfaces and controls through the same color space in light and dark modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const vars = themeVariables({ mode, hue: 255, chroma: 0.17, radius: 4 });
      expect(vars['--primary']).toContain('255');
      expect(vars['--primary']).not.toContain(' 0 255');
      expect(vars['--card']).toContain('255');
      expect(vars['--radius']).toBe('4px');
    }
  });
});
