import {existsSync} from 'fs';
import {join} from 'path';
import {pathToFileURL} from 'url';

import {expect, type Page, test} from '@playwright/test';

const BUILD = join(import.meta.dirname, '../../dist/paint-rush.html');
const URL = pathToFileURL(BUILD).href;
/** The autoplay pitch: SPACE on its title goes straight to the full-shift replay. */
const PRESENTER = `${URL}?mode=presenter`;

test.beforeAll(() => {
  if (!existsSync(BUILD)) throw new Error(`${BUILD} is missing; run \`bun run build\` first`);
});

const step = (page: Page) => page.locator('body').getAttribute('data-step');

/** SPACE skips through a replay's beats until the step changes. */
async function spaceUntil(page: Page, target: string): Promise<void> {
  for (let i = 0; i < 200 && (await step(page)) !== target; i++) await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-step', target);
}

test('SPACE walks the whole pitch in order, and the comparison replays the same day', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(PRESENTER);
  const order: string[] = [String(await step(page))];
  for (const target of ['today', 'today-results', 'hub', 'comparison']) {
    await spaceUntil(page, target);
    order.push(target);
    if (target === 'today-results') await expect(page.locator('#prompt')).toHaveText(/^Today's results: \d+ tins mixed in store/);
  }
  expect(order).toEqual(['title', 'today', 'today-results', 'hub', 'comparison']);

  const live = page.locator('#prompt');
  await expect(live).toHaveText(/^Comparison\. Today: \d+ customers lost.* With central hub: \d+ customers lost/);
  await expect(live).toContainText('Excludes central prep and delivery costs.');
  const first = await live.textContent();

  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
  for (const target of ['today-results', 'hub', 'comparison']) await spaceUntil(page, target);
  await expect(live).toHaveText(String(first));
  expect(errors).toEqual([]);
});

test('R at the comparison reshuffles the day and replays it', async ({page}) => {
  await page.goto(`${URL}?scene=comparison`);
  const first = await page.locator('#prompt').textContent();
  await page.keyboard.press('KeyR');
  await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
  for (const target of ['today-results', 'hub', 'comparison']) await spaceUntil(page, target);
  await expect(page.locator('#prompt')).not.toHaveText(String(first));
});

test('R outside the comparison does nothing', async ({page}) => {
  await page.goto(`${URL}?scene=results`);
  await page.keyboard.press('KeyR');
  await expect(page.locator('body')).toHaveAttribute('data-step', 'today-results');
});
