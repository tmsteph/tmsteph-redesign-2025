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
    expect(trackerHtml).toContain('https://www.sdmake.org/');
    expect(trackerHtml).toContain('MAKE Projects');
    expect(trackerHtml).toContain('https://cafarmandgarden.com/');
    expect(trackerHtml).toContain('California Farm & Garden');
  });

  it('keeps the regenerative farm page compact on narrow displays', async () => {
    const trackerHtml = await readFile('regenerative-farm/index.html', 'utf8');

    expect(trackerHtml).toContain('@media (max-width: 480px)');
    expect(trackerHtml).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(trackerHtml).toContain('min-height: 178px;');
    expect(trackerHtml).toContain('font-size: clamp(2.35rem, 15vw, 2.9rem);');
  });

  it('tracks relocation and farm incentive research leads', async () => {
    const trackerHtml = await readFile('regenerative-farm/index.html', 'utf8');

    expect(trackerHtml).toContain('Relocation and Farm Incentive Leads');
    expect(trackerHtml).toContain('South Dakota Beginning Farmer Bond Program');
    expect(trackerHtml).toContain('ISMEA Generazione Terra');
    expect(trackerHtml).toContain('Kansas Rural Opportunity Zones');
    expect(trackerHtml).toContain('Minnesota Beginning Farmer Tax Credit');
    expect(trackerHtml).toContain('Nebraska NextGen Beginning Farmer Program');
    expect(trackerHtml).toContain('Iowa beginning farmer programs');
    expect(trackerHtml).toContain('Classify every incentive as relocation-only');
  });

  it('tracks family-friendly farm work-trade and caretaker paths', async () => {
    const trackerHtml = await readFile('regenerative-farm/index.html', 'utf8');

    expect(trackerHtml).toContain('Family Work-Trade + Caretaker Path');
    expect(trackerHtml).toContain('WWOOF');
    expect(trackerHtml).toContain('RanchWork');
    expect(trackerHtml).toContain('CAFF Jobs + Farm Bureau');
    expect(trackerHtml).toContain('Workaway');
    expect(trackerHtml).toContain('Worldpackers');
    expect(trackerHtml).toContain('Foundation for Intentional Community');
    expect(trackerHtml).toContain('Toddler Safety Filter');
    expect(trackerHtml).toContain('Julian WWOOF farm-to-table camp/conference center');
    expect(trackerHtml).toContain('https://www.ranchwork.com/jcategory/ranch-jobs-with-housing/');
  });

  it('tracks microgreens as a first farm pilot', async () => {
    const trackerHtml = await readFile('regenerative-farm/index.html', 'utf8');

    expect(trackerHtml).toContain('Microgreens as the First Farm Pilot');
    expect(trackerHtml).toContain('90-day microgreens pilot');
    expect(trackerHtml).toContain('Keep microgreens separate from sprouts');
    expect(trackerHtml).toContain('MU Extension: Microgreens Planning Budget');
    expect(trackerHtml).toContain('CDFA Produce Safety Program');
    expect(trackerHtml).toContain('UT Extension: Regulatory Considerations for Sprouts, Microgreens and Baby Greens');
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

  it('links to the yuga cycle map app', async () => {
    const html = await readFile('index.html', 'utf8');
    const yugaHtml = await readFile('yuga-cycles/index.html', 'utf8');

    expect(html).toContain('href="yuga-cycles/index.html"');
    expect(html).toContain('Yuga Cycle Map');
    expect(yugaHtml).toContain('<title>The Long Horoscope, Yugas & Builder-Yuga</title>');
    expect(yugaHtml).toContain('Back to tmsteph');
  });
});
