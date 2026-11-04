import {existsSync} from 'fs';
import {join} from 'path';
import {pathToFileURL} from 'url';

import {expect, type Page, test} from '@playwright/test';

const BUILD = join(import.meta.dirname, '../../dist/paint-rush.html');
const URL = pathToFileURL(BUILD).href;
const DECISION = 'W: SERVE THE WALK-IN. O: MIX THE ORDER.';

test.beforeAll(() => {
  if (!existsSync(BUILD)) throw new Error(`${BUILD} is missing; run \`bun run build\` first`);
});

/** SPACE skips narration beats, so the replay reaches its first decision quickly. */
async function reachDecision(page: Page): Promise<void> {
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyC');
  for (let i = 0; i < 80; i++) {
    if ((await page.locator('#prompt').textContent()) === DECISION) return;
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  throw new Error('the replay never asked for a decision');
}

test('C asks the presenter at a decision, and a pick resumes the shift', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await reachDecision(page);
  await expect(page.getByRole('button', {name: 'SERVE WALK-IN'})).toBeVisible();
  await page.keyboard.press('KeyO');
  await expect(page.locator('#prompt')).not.toHaveText(DECISION);
  await expect(page.getByRole('button', {name: 'MIX ORDER'})).toBeHidden();
  expect(errors).toEqual([]);
});

test('the on-screen buttons make the pick', async ({page}) => {
  await page.goto(URL);
  await reachDecision(page);
  await page.getByRole('button', {name: 'SERVE WALK-IN'}).click();
  await expect(page.locator('#prompt')).not.toHaveText(DECISION);
});

test('doing nothing falls back to autoplay', async ({page}) => {
  await page.goto(URL);
  await reachDecision(page);
  await expect(page.locator('#prompt')).not.toHaveText(DECISION, {timeout: 9000});
});
