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
});
