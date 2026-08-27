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

  it('fits the full seven-day month grid on phones with compact ranges', async () => {
    const html = await readFile('calendar/index.html', 'utf8');
    const js = await readFile('calendar/calendar.js', 'utf8');
    const css = await readFile('calendar/calendar.css', 'utf8');

    expect(html).toContain('data-empty-month');
    expect(html).toContain('Show sample month');
    expect(js).toContain('function formatCompactRange(event)');
    expect(js).toContain("let viewDate = new Date(sampleMonth.getFullYear(), sampleMonth.getMonth(), 1);");
    expect(css).toContain('@media (max-width: 700px)');
    expect(css).toContain('.calendar-grid-shell { min-width: 0; }');
    expect(css).toContain('.event__time-compact { display: inline; }');
  });
});
