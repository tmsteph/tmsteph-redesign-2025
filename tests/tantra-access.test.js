import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ALIAS,
  ACCESS_ROOT,
  canReviewTantra,
  canViewTantra,
  createAccessKey,
  practiceReferences,
  scenes,
} from '../tantra/app.js';

describe('tantra approval gate', () => {
  it('keeps tmsteph as the only approval alias', () => {
    expect(ADMIN_ALIAS).toBe('tmsteph');
    expect(canReviewTantra('tmsteph')).toBe(true);
    expect(canReviewTantra('TMSTEPH')).toBe(true);
    expect(canReviewTantra('guest')).toBe(false);
  });

  it('normalizes access request keys for Gun storage', () => {
    expect(createAccessKey('  Sacred Guest  ')).toBe('sacred-guest');
    expect(createAccessKey('tmsteph')).toBe('tmsteph');
  });

  it('unlocks the room only for tmsteph or approved requests', () => {
    expect(canViewTantra({ alias: 'tmsteph', request: null })).toBe(true);
    expect(canViewTantra({ alias: 'guest', request: { status: 'approved' } })).toBe(true);
    expect(canViewTantra({ alias: 'guest', request: { status: 'pending' } })).toBe(false);
    expect(canViewTantra({ alias: 'guest', request: { status: 'denied' } })).toBe(false);
  });

  it('ships an approval-only page and local image set', async () => {
    const html = await readFile('tantra/index.html', 'utf8');
    const js = await readFile('tantra/app.js', 'utf8');
    const css = await readFile('tantra/styles.css', 'utf8');
    const serviceWorker = await readFile('service-worker.js', 'utf8');

    expect(html).toContain('<title>Tantra Room - tmsteph</title>');
    expect(html).toContain('id="tantra-private" hidden');
    expect(html).toContain('id="tantra-admin-panel" hidden');
    expect(html).toContain('Approve or deny access requests');
    expect(js).toContain(ACCESS_ROOT);
    expect(css).toContain('.tantra-gallery');
    expect(serviceWorker).toContain('/tantra/app.js');
    expect(scenes).toHaveLength(8);
  });

  it('keeps external adult references inside the approval-only room', async () => {
    const html = await readFile('tantra/index.html', 'utf8');
    const homepage = await readFile('index.html', 'utf8');
    const urls = [
      'https://xhamster.com/videos/lingam-massage-will-relax-him-9419776',
      'https://xhamster.com/videos/discovering-tantra-xhZY9Ev',
    ];

    expect(practiceReferences).toEqual([
      expect.objectContaining({
        title: 'Lingam massage reference',
        url: urls[0],
      }),
      expect.objectContaining({
        title: 'Discovering Tantra reference',
        url: urls[1],
      }),
    ]);
    expect(html).toContain('id="tantra-reference-list"');
    urls.forEach((url) => {
      expect(homepage).not.toContain(url);
    });
  });

  it('links the approval-only section from the homepage', async () => {
    const html = await readFile('index.html', 'utf8');

    expect(html).toContain('href="tantra/"');
    expect(html).toContain('Tantra · Approval Only');
  });
});
