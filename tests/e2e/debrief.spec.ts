import {existsSync} from 'fs';
import {join} from 'path';
import {pathToFileURL} from 'url';

import {expect, type Page, test} from '@playwright/test';

const BUILD = join(import.meta.dirname, '../../dist/paint-rush.html');
const URL = pathToFileURL(BUILD).href;

test.beforeAll(() => {
  if (!existsSync(BUILD)) throw new Error(`${BUILD} is missing; run \`bun run build\` first`);
});

const body = (page: Page) => page.locator('body');
const live = (page: Page) => page.locator('#prompt');
const step = (page: Page, name: string) => expect(body(page)).toHaveAttribute('data-step', name);

test.describe('the title mode choice', () => {
  test('PLAY is chosen first; an arrow key switches to PRESENTER, which runs the autoplay pitch with take-control', async ({page}) => {
    await page.goto(URL);
    const modeButton = page.locator('#mode');
    await expect(modeButton).toHaveText('MODE: PLAY');
    await expect(live(page)).toContainText('Play mode');
    await page.keyboard.press('ArrowDown');
    await expect(modeButton).toHaveText('MODE: PRESENTER');
    await expect(live(page)).toHaveText(/^Presenter mode/);
    await page.keyboard.press('Space');
    await step(page, 'today');
    await expect(modeButton).toBeHidden();
    await expect(page.locator('#control')).toBeVisible();
  });

  test('the mode button switches by click, and the title canvas says which mode is chosen', async ({page}) => {
    await page.goto(URL);
    await page.locator('#mode').click();
    await expect(page.locator('#screen')).toHaveAttribute('aria-label', /Presenter mode/);
    await page.locator('#mode').click();
    await expect(page.locator('#screen')).toHaveAttribute('aria-label', /Play mode/);
    await page.locator('#screen').click();
    await step(page, 'round-1');
  });
});

test.describe('the debrief in play mode', () => {
  test('SPACE walks round 1 result, round 2, comparison, the whole-day card, then the day; each result is in the live region', async ({page}) => {
    await page.goto(`${URL}?scene=round-result`);
    await expect(live(page)).toHaveText(/^Round 1 result: /);
    await page.keyboard.press('Space');
    await step(page, 'round-2');

    await page.goto(`${URL}?scene=rounds`);
    await expect(live(page)).toHaveText(/^Round 1 against round 2\. .* Press space to see a whole real day\.$/);
    await page.keyboard.press('Space');
    await step(page, 'whole-day');
    await expect(live(page)).toHaveText(/^Now a whole real day: .* Press space to play it\.$/);
    await page.keyboard.press('Space');
    await step(page, 'today');
  });

  test('a click advances each card too', async ({page}) => {
    await page.goto(`${URL}?scene=rounds`);
    await page.locator('#screen').click();
    await step(page, 'whole-day');
    await page.waitForTimeout(400);
    await page.locator('#screen').click();
    await step(page, 'today');
  });

  test('the whole day runs on autoplay: no take-control button, and C does nothing', async ({page}) => {
    await page.goto(`${URL}?scene=shop`);
    await expect(page.locator('#control')).toBeHidden();
    await expect(page.locator('#screen')).not.toHaveAttribute('aria-label', /take control/i);
    await page.keyboard.press('KeyC');
    await expect(live(page)).not.toHaveText(/YOU DECIDE/);
    await expect(page.locator('#control')).toBeHidden();
  });

  test('the estate comparison is the same in play and presenter mode, footnote included', async ({page}) => {
    await page.goto(`${URL}?scene=comparison`);
    const play = await live(page).textContent();
    expect(play).toMatch(/across \d+ stores\. Excludes central prep and delivery costs\./);
    await page.goto(`${URL}?mode=presenter&scene=comparison`);
    await expect(live(page)).toHaveText(String(play));
  });
});
