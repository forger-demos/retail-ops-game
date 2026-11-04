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

/** One deliberate tap: waits out the double-tap guard so each tap counts. */
async function tap(page: Page): Promise<void> {
  await page.locator('#screen').tap();
  await page.waitForTimeout(360);
}

async function tapUntil(page: Page, target: string): Promise<void> {
  for (let i = 0; i < 60 && (await step(page)) !== target; i++) await tap(page);
  await expect(page.locator('body')).toHaveAttribute('data-step', target);
}

test.describe('on a phone', () => {
  test.use({viewport: {width: 412, height: 839}, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true});

  test('a tap walks every step of the pitch as SPACE does, and the prompts say TAP', async ({page}) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PRESENTER);
    await expect(page.locator('body')).toHaveAttribute('data-input', 'touch');
    await expect(page.locator('#prompt')).toHaveText('TAP TO START');
    await expect(page.locator('#screen')).toHaveAttribute('aria-label', /Tap to start/);

    await tap(page);
    await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
    await expect(page.locator('#prompt')).toHaveText('TODAY. EVERY TIN IS MIXED IN THE SHOP.');
    await tap(page);
    await expect(page.locator('#prompt')).not.toHaveText('TODAY. EVERY TIN IS MIXED IN THE SHOP.');

    for (const target of ['today-results', 'hub', 'comparison']) await tapUntil(page, target);
    await expect(page.locator('#screen')).toHaveAttribute('aria-label', /Tap to replay/);
    await tap(page);
    await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
    await expect(page.locator('#prompt')).toHaveText('TODAY. EVERY TIN IS MIXED IN THE SHOP.');
    expect(errors).toEqual([]);
  });

  test('a double tap moves one step, not two', async ({page}) => {
    await page.goto(`${URL}?scene=results`);
    const box = await page.locator('#screen').boundingBox();
    if (!box) throw new Error('no screen');
    const at = {x: box.x + box.width / 2, y: box.y + box.height / 2};
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.locator('body')).toHaveAttribute('data-step', 'hub');
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toHaveAttribute('data-step', 'hub');
  });

  test('reshuffle is a finger-sized button shown only at the comparison', async ({page}) => {
    await page.goto(`${URL}?scene=results`);
    const button = page.getByRole('button', {name: 'RESHUFFLE'});
    await expect(button).toBeHidden();

    await page.goto(`${URL}?scene=comparison`);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    const viewport = page.viewportSize();
    const screen = await page.locator('#screen').boundingBox();
    if (!box || !viewport || !screen) throw new Error('no layout');
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.y).toBeGreaterThanOrEqual(screen.y + screen.height);

    const first = await page.locator('#prompt').textContent();
    await button.tap();
    await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
    await expect(button).toBeHidden();
    for (const target of ['today-results', 'hub', 'comparison']) await tapUntil(page, target);
    await expect(page.locator('#prompt')).not.toHaveText(String(first));
  });

  test('taps cannot zoom or scroll the page', async ({page}) => {
    await page.goto(PRESENTER);
    expect(await page.locator('.stage').evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('width=device-width');
    await page.touchscreen.tap(10, 10);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => [window.scrollX, window.scrollY, window.visualViewport?.scale])).toEqual([0, 0, 1]);
  });
});

test.describe('on a desktop', () => {
  test('the prompts still say PRESS SPACE and a click advances', async ({page}) => {
    await page.goto(PRESENTER);
    await expect(page.locator('body')).toHaveAttribute('data-input', 'keyboard');
    await expect(page.locator('#prompt')).toHaveText('PRESS SPACE');
    await page.locator('#screen').click();
    await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
  });

  test('the reshuffle button is keyboard focusable and SPACE on it reshuffles', async ({page}) => {
    await page.goto(`${URL}?scene=comparison`);
    const first = await page.locator('#prompt').textContent();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'RESHUFFLE'})).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('body')).toHaveAttribute('data-step', 'today');
    for (let i = 0; i < 200 && (await step(page)) !== 'comparison'; i++) await page.keyboard.press('Space');
    await expect(page.locator('#prompt')).not.toHaveText(String(first));
  });
});
