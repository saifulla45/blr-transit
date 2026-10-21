/**
 * Line colours, derived from the feed rather than hand-written.
 *
 * Why this exists: `lineVar()` used to map PURPLE/GREEN and fall through to
 * yellow for anything else. When BMRCL opens the Blue and Pink lines the feed
 * will carry them automatically — every station, timetable, fare and journey
 * would appear with no code change — but both new lines would have rendered
 * YELLOW. Silently. No crash, no warning, just wrong colours on the station
 * rows, line tags, rail markers and map.
 *
 * The pipeline already stores each route's real colour from route_color in
 * stops.txt. This turns that into CSS custom properties so a new line needs
 * no code at all.
 *
 * The catch is that a brand colour is not automatically a readable one. BMRCL
 * yellow is #FFDF00, which is invisible on white; the hand-tuned palette used
 * #b38600 on light and #e8c33a on dark for exactly that reason. So the hue and
 * saturation come from the feed and only the lightness is clamped per theme,
 * which reproduces the hand-tuning without hard-coding any line.
 */

export interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
    : max === g ? (b - r) / d + 2
    : (r - g) / d + 4;

  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(clean.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The grounds these colours actually sit on, from globals.css. */
const LIGHT_GROUND = '#fbfafc';
const DARK_GROUND = '#0b0710';

/** WCAG AA for normal text. Line tags and distances are small, so AA not AA-large. */
const MIN_CONTRAST = 4.5;

/**
 * Walk lightness until the colour is legible on `ground`, keeping hue.
 *
 * Solved rather than guessed. A flat lightness cap looked right but left BMRCL
 * green at #009933, which is 3.3:1 on white — under AA, and the reason the
 * old palette hand-darkened it to #00752a. Stepping toward the contrast
 * target reproduces that automatically for any line the feed adds.
 */
function adjustForContrast(hex: string, ground: string, direction: 'darker' | 'lighter'): string {
  const hsl = hexToHsl(hex);
  const step = direction === 'darker' ? -0.01 : 0.01;

  let { l } = hsl;
  // Saturation is eased on dark grounds: a fully saturated hue at high
  // lightness glares against near-black.
  const s = direction === 'lighter' ? Math.min(hsl.s, 0.62) : hsl.s;

  /*
    On dark the first colour to clear 4.5:1 is the DIMMEST acceptable one —
    green stopped at #218c45 where the hand-tuned palette used a far brighter
    #3cc46a. Minimum-passing is the wrong target against a near-black ground,
    so lightness also has to clear a floor before the loop is allowed to stop.
  */
  const minLightness = direction === 'lighter' ? 0.6 : 0;

  for (let i = 0; i <= 100; i += 1) {
    const candidate = hslToHex({ h: hsl.h, s, l });
    if (contrastRatio(candidate, ground) >= MIN_CONTRAST && l >= minLightness) return candidate;
    l += step;
    if (l <= 0 || l >= 1) break;
  }
  // Ran out of range — return the extreme rather than something unreadable.
  return hslToHex({ h: hsl.h, s, l: direction === 'darker' ? 0.12 : 0.9 });
}

/** The feed colour, darkened only as far as a light background requires. */
export function forLightTheme(hex: string): string {
  return adjustForContrast(hex, LIGHT_GROUND, 'darker');
}

/** The feed colour, lightened only as far as a dark background requires. */
export function forDarkTheme(hex: string): string {
  return adjustForContrast(hex, DARK_GROUND, 'lighter');
}

/**
 * CSS declaring `--line-<ID>` for every line in the feed, in both themes.
 *
 * Emitted into the document head so all 14 `lineVar()` call sites resolve
 * without threading the lines array through every component.
 */
export function lineColorCss(lines: Array<{ id: string; color: string }>): string {
  /*
    The id becomes part of a CSS property name and the whole string is
    injected into a <style>. route_id comes from a third-party feed, so it is
    restricted to characters that cannot terminate the rule — a route_id
    containing "}" would otherwise let upstream data write arbitrary CSS.
    Colours are safe by construction: they are parsed to HSL and re-emitted
    as #rrggbb, never passed through.
  */
  const safe = lines
    .map((l) => ({ id: l.id.replace(/[^A-Za-z0-9_-]/g, ''), color: l.color }))
    .filter((l) => l.id.length > 0);

  const light = safe.map((l) => `--line-${l.id}:${forLightTheme(l.color)}`).join(';');
  const dark = safe.map((l) => `--line-${l.id}:${forDarkTheme(l.color)}`).join(';');

  // Mirrors the three-state theme handling in globals.css: bare :root is the
  // light palette, the media query covers the un-stamped "system" default, and
  // the [data-theme] stamps let an explicit choice win either way.
  return [
    `:root{${light}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}`,
    `:root[data-theme="dark"]{${dark}}`,
    // The landing page swaps to its own dark surface regardless of theme.
    `.surface-dark{${dark}}`,
  ].join('');
}
