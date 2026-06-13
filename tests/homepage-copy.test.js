import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('homepage personal positioning', () => {
  it('keeps tmsteph framed as a personal site', async () => {
    const html = await readFile('index.html', 'utf8');

    expect(html).not.toContain(
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

  it('centers incomplete Command Central link rows', async () => {
    const css = await readFile('style.css', 'utf8');

    expect(css).toContain('.quick-links');
    expect(css).toContain('display: flex;');
    expect(css).toContain('flex-wrap: wrap;');
    expect(css).toContain('justify-content: center;');
  });

  it('provides a top app search shortcut that focuses the app search', async () => {
    const html = await readFile('index.html', 'utf8');
    const js = await readFile('index.js', 'utf8');
    const css = await readFile('style.css', 'utf8');

    expect(html).toContain('href="#explore-more"');
    expect(html).toContain('data-app-search-jump');
    expect(html).toContain('id="explore-more"');
    expect(js).toContain('exploreSearchInput.focus');
    expect(js).toContain("classList.add('is-highlighted')");
    expect(css).toContain('.explore-search.is-highlighted .explore-search-input');
  });
});
