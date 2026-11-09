import type { ThemeSettings } from './model';

// All surfaces, blocks, handles, Radix portals, and controls share these shadcn tokens.
export function themeVariables(theme: ThemeSettings): Record<string, string> {
  const dark = theme.mode === 'dark';
  const color = (lightness: number, scale = 1) => `oklch(${lightness} ${Number((theme.chroma * scale).toFixed(4))} ${theme.hue})`;
  const foreground = color(dark ? 0.985 : 0.145, 0.04);
  const primary = color(theme.chroma ? (dark ? 0.78 : 0.5) : (dark ? 0.922 : 0.205), dark ? 0.65 : 1);
  return {
    '--radius': `${theme.radius}px`,
    '--background': color(dark ? 0.145 : 1, 0.025), '--foreground': foreground,
    '--card': color(dark ? 0.205 : 1, 0.04), '--card-foreground': foreground,
    '--popover': color(dark ? 0.205 : 1, 0.04), '--popover-foreground': foreground,
    '--primary': primary, '--primary-foreground': color(dark ? 0.145 : 0.985, 0.02),
    '--secondary': color(dark ? 0.269 : 0.97, 0.08), '--secondary-foreground': foreground,
    '--muted': color(dark ? 0.269 : 0.97, 0.06), '--muted-foreground': color(dark ? 0.708 : 0.556, 0.08),
    '--accent': color(dark ? 0.3 : 0.95, 0.1), '--accent-foreground': foreground,
    '--border': color(dark ? 0.32 : 0.9, 0.06), '--input': color(dark ? 0.35 : 0.9, 0.06),
    '--ring': color(dark ? 0.556 : 0.708, 0.3),
    '--grid-color': color(dark ? 0.33 : 0.85, 0.06),
  };
}
