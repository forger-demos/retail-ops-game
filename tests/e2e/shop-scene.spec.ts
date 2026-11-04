import {existsSync} from 'fs';
import {join} from 'path';
import {pathToFileURL} from 'url';

import {expect, type Page, test} from '@playwright/test';

import {PALETTE_TOKENS} from '../../src/render/palette';

const BUILD = join(import.meta.dirname, '../../dist/paint-rush.html');
const URL = pathToFileURL(BUILD).href;
/** The autoplay pitch: SPACE on its title goes straight to the full-shift replay. */
const PRESENTER = `${URL}?mode=presenter`;

test.beforeAll(() => {
  if (!existsSync(BUILD)) throw new Error(`${BUILD} is missing; run \`bun run build\` first`);
});

async function coloursOutsidePalette(page: Page): Promise<string[]> {
  return page.evaluate(tokens => {
    const el = document.querySelector('#screen') as HTMLCanvasElement;
    const css = getComputedStyle(document.documentElement);
    const probe = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const toRgb = (c: string): string => {
      probe.fillStyle = c;
      probe.fillRect(0, 0, 1, 1);
      return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(',');
    };
    const palette = tokens.map(t => toRgb(css.getPropertyValue(t).trim()));
    const data = (el.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, el.width, el.height).data;
    const seen = new Set<string>();
    for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return [...seen].filter(c => !palette.includes(c));
  }, [...PALETTE_TOKENS]);
}

test('SPACE on the title starts the shop replay, narrated, in palette colours', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(PRESENTER);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'title');
  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.locator('#screen')).toHaveAttribute('aria-label', /TODAY/);
  await expect(page.locator('#prompt')).toHaveText('TODAY. EVERY TIN IS MIXED IN THE SHOP.');
  await page.keyboard.press('Space');
  await expect(page.locator('#prompt')).not.toHaveText('TODAY. EVERY TIN IS MIXED IN THE SHOP.');
  expect(await coloursOutsidePalette(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a deep link opens the hub run at a given minute', async ({page}) => {
  await page.goto(`${URL}?scene=shop&scenario=hub&minute=480`);
  await expect(page.locator('#screen')).toHaveAttribute('aria-label', /WITH CENTRAL HUB/);
  await expect(page.locator('#prompt')).toHaveText(/^CLOSING TIME\. \d+ WALKED OUT\. GBP\d+ LOST\.$/);
});

test('without a 2D canvas the results show as text', async ({page}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto(PRESENTER);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.getByText('This demo needs a modern browser.')).toBeVisible();
  await expect(page.getByText(/^TODAY: \d+ of \d+ walk-ins served/)).toBeVisible();
  await expect(page.getByText(/saves GBP\d+ in one shift/)).toBeVisible();
});

test('the style frame shows the composed dilemma and the unmanned counter, in palette colours', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${URL}?scene=style-frame`);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'style-frame');
  await expect(page.locator('#prompt')).toHaveText('A TRADE ORDER: 10 TINS. MIX THEM NOW?');
  expect(await coloursOutsidePalette(page)).toEqual([]);
  await page.goto(`${URL}?scene=style-frame&moment=unmanned`);
  await expect(page.locator('#prompt')).toHaveText('THE COUNTER IS UNMANNED. ANOTHER SALE WALKS OUT.');
  expect(await coloursOutsidePalette(page)).toEqual([]);
  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'title');
  expect(errors).toEqual([]);
});
