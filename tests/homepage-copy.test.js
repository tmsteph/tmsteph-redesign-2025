import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('homepage personal positioning', () => {
  it('keeps tmsteph framed as a personal site', async () => {
    const html = await readFile('index.html', 'utf8');

    expect(html).toContain(
      'Personal notes, tools, and experiments from a life spent learning in public.'
    );
    expect(html).not.toContain('launch-in-3-days');
    expect(html).not.toContain('Launch in 3 Days');
    expect(html).not.toContain('Need a site, offer, or business system live fast?');
  });

  it('links to the regenerative farm tracker', async () => {
    const html = await readFile('index.html', 'utf8');
    const trackerHtml = await readFile('regenerative-farm/index.html', 'utf8');

    expect(html).toContain('href="regenerative-farm/index.html"');
    expect(html).toContain('Regenerative Farm Tracker');
    expect(trackerHtml).toContain('<title>Regenerative Farm Tracker</title>');
    expect(trackerHtml).toContain('California FarmLink');
    expect(trackerHtml).toContain('Urban Agriculture Incentive Zone');
    expect(trackerHtml).toContain('Project New Village');
    expect(trackerHtml).toContain('RCD incubator plots');
    expect(trackerHtml).toContain('Local Models to Visit');
  });
});
