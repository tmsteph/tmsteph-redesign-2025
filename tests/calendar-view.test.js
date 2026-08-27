import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('glanceable calendar', () => {
  it('is discoverable from the tmsteph homepage', async () => {
    const html = await readFile('index.html', 'utf8');
    expect(html).toContain('href="calendar/"');
    expect(html).toContain('Glanceable Calendar');
  });

  it('keeps full event ranges visible in the month grid', async () => {
    const html = await readFile('calendar/index.html', 'utf8');
    const js = await readFile('calendar/calendar.js', 'utf8');
    expect(html).toContain('Start + end times stay visible');
    expect(html).toContain('data-calendar-grid');
    expect(html).toContain('Safe public demo');
    expect(js).toContain('demo data only');
    expect(js).toContain('function formatRange(event)');
    expect(js).toContain("return `${start}–${end}${overnight ? ' +1' : ''}`;");
  });

  it('keeps month cells readable instead of squeezing them on phones', async () => {
    const css = await readFile('calendar/calendar.css', 'utf8');
    expect(css).toContain('.calendar-grid-shell { min-width: 920px; }');
    expect(css).toContain('@media (max-width: 700px)');
    expect(css).toContain('.calendar-grid-shell { min-width: 820px; }');
  });
});
