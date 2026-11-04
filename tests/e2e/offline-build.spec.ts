import {existsSync} from 'fs';
import {join} from 'path';
import {pathToFileURL} from 'url';

import {expect, test} from '@playwright/test';

const BUILD = join(import.meta.dirname, '../../dist/paint-rush.html');
const VIEWPORTS = [
  {name: 'phone', width: 390, height: 844},
  {name: 'phone-landscape', width: 844, height: 390},
  {name: 'desktop', width: 1280, height: 800},
];

test.beforeAll(() => {
  if (!existsSync(BUILD)) throw new Error(`${BUILD} is missing; run \`bun run build\` first`);
});

for (const viewport of VIEWPORTS) {
  test(`the built file shows the title screen offline from file:// (${viewport.name})`, async ({browser}) => {
    const context = await browser.newContext({offline: true, viewport});
    const requests: string[] = [];
    context.on('request', r => {
      if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url());
    });
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(pathToFileURL(BUILD).href);
    await expect(page.locator('body')).toHaveAttribute('data-scene', 'title');
    await expect(page.getByRole('heading', {name: 'PAINT RUSH'})).toBeAttached();
    await expect(page.getByText('PRESS SPACE')).toBeAttached();

    const canvas = page.locator('#screen');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no box');
    const scale = box.width / 160;
    expect(Number.isInteger(scale)).toBe(true);
    expect(box.height).toBe(144 * scale);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

    const drawn = await page.evaluate(() => {
      const el = document.querySelector('#screen') as HTMLCanvasElement;
      const css = getComputedStyle(document.documentElement);
      const probe = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      const toRgb = (c: string): string => {
        probe.fillStyle = c;
        probe.fillRect(0, 0, 1, 1);
        return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(',');
      };
      const palette = ['--gb-0', '--gb-1', '--gb-2', '--gb-3'].map(t => toRgb(css.getPropertyValue(t).trim()));
      const data = (el.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, el.width, el.height).data;
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return {width: el.width, height: el.height, rendering: getComputedStyle(el).imageRendering, palette, seen: [...seen]};
    });
    expect(drawn.width).toBe(160);
    expect(drawn.height).toBe(144);
    expect(['pixelated', 'crisp-edges']).toContain(drawn.rendering);
    expect(drawn.seen.length).toBeGreaterThan(1);
    for (const colour of drawn.seen) expect(drawn.palette).toContain(colour);

    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await context.close();
  });
}
