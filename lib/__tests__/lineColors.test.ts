import { describe, expect, it } from 'vitest';
import {
  contrastRatio, forDarkTheme, forLightTheme, hexToHsl, hslToHex, lineColorCss,
} from '../lineColors';

const LIGHT_GROUND = '#fbfafc';
const DARK_GROUND = '#0b0710';
const AA = 4.5;

// The three BMRCL lines as the feed gives them, plus two plausible future ones.
const FEED = {
  GREEN: '#009933',
  YELLOW: '#FFDF00',
  PURPLE: '#8C2877',
  BLUE: '#0066CC',
  PINK: '#FF69B4',
};

describe('hex/hsl round trip', () => {
  it('survives a round trip within rounding error', () => {
    for (const hex of Object.values(FEED)) {
      const back = hslToHex(hexToHsl(hex));
      // Allow one step per channel for integer rounding.
      for (let i = 1; i < 7; i += 2) {
        const a = parseInt(hex.slice(i, i + 2), 16);
        const b = parseInt(back.slice(i, i + 2), 16);
        expect(Math.abs(a - b), `${hex} -> ${back}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('handles shorthand hex and a missing hash', () => {
    expect(hexToHsl('#fff').l).toBeCloseTo(1, 5);
    expect(hexToHsl('000').l).toBeCloseTo(0, 5);
  });
});

describe('theme adjustment', () => {
  it('clears WCAG AA on the light ground for every line', () => {
    for (const [name, hex] of Object.entries(FEED)) {
      expect(contrastRatio(forLightTheme(hex), LIGHT_GROUND), name).toBeGreaterThanOrEqual(AA);
    }
  });

  it('clears WCAG AA on the dark ground for every line', () => {
    for (const [name, hex] of Object.entries(FEED)) {
      expect(contrastRatio(forDarkTheme(hex), DARK_GROUND), name).toBeGreaterThanOrEqual(AA);
    }
  });

  it('does not leave yellow unreadable on white, the case that motivated this', () => {
    // #FFDF00 straight from the feed is about 1.1:1 on white.
    expect(contrastRatio(FEED.YELLOW, LIGHT_GROUND)).toBeLessThan(2);
    expect(contrastRatio(forLightTheme(FEED.YELLOW), LIGHT_GROUND)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps dark-theme colours bright rather than merely passing', () => {
    // Minimum-passing on a near-black ground produced muddy colours; the
    // lightness floor is what keeps them close to the old hand-tuned palette.
    for (const [name, hex] of Object.entries(FEED)) {
      expect(hexToHsl(forDarkTheme(hex)).l, name).toBeGreaterThanOrEqual(0.55);
    }
  });

  it('preserves hue, so a line still looks like its own colour', () => {
    for (const [name, hex] of Object.entries(FEED)) {
      const h = hexToHsl(hex).h;
      expect(Math.abs(hexToHsl(forLightTheme(hex)).h - h), name).toBeLessThan(4);
      expect(Math.abs(hexToHsl(forDarkTheme(hex)).h - h), name).toBeLessThan(4);
    }
  });

  it('leaves a colour alone when it already has enough contrast', () => {
    // Purple is already dark enough for the light ground.
    expect(forLightTheme('#8C2877').toLowerCase()).toBe('#8c2877');
  });
});

describe('lineColorCss', () => {
  const css = lineColorCss([{ id: 'PURPLE', color: '#8C2877' }, { id: 'BLUE', color: '#0066CC' }]);

  it('declares a variable per line in every theme state', () => {
    expect(css).toContain('--line-PURPLE');
    expect(css).toContain('--line-BLUE');
    expect(css).toContain(':root{');
    expect(css).toContain('prefers-color-scheme:dark');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('.surface-dark');
  });

  it('strips characters that could break out of the rule', () => {
    // route_id comes from a third-party feed and lands in a <style> block.
    const hostile = lineColorCss([{ id: 'X}body{display:none', color: '#8C2877' }]);
    expect(hostile).not.toContain('body{display:none');
    expect(hostile).toContain('--line-Xbodydisplaynone');
  });

  it('drops a line whose id sanitises away entirely', () => {
    expect(lineColorCss([{ id: '}{', color: '#8C2877' }])).not.toContain('--line-:');
  });

  it('emits only #rrggbb colours, never feed text', () => {
    const matches = css.match(/#[0-9a-f]{6}/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    expect(css).not.toMatch(/url\(|expression|javascript:/i);
  });
});
