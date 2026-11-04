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

const body = (page: Page) => page.locator('body');
const live = (page: Page) => page.locator('#prompt');

async function spaceUntil(page: Page, target: string): Promise<void> {
  for (let i = 0; i < 200 && (await body(page).getAttribute('data-step')) !== target; i++) await page.keyboard.press('Space');
  await expect(body(page)).toHaveAttribute('data-step', target);
}

async function resultsAnnouncement(page: Page): Promise<string> {
  await page.keyboard.press('Space');
  await spaceUntil(page, 'today-results');
  return String(await live(page).textContent());
}

test.describe('with a keyboard', () => {
  test('S opens the menu from the title and BACK returns to it', async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PRESENTER);
    await page.keyboard.press('KeyS');
    await expect(body(page)).toHaveAttribute('data-step', 'settings');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 8 HRS.');
    await page.keyboard.press('Space');
    await expect(body(page)).toHaveAttribute('data-step', 'settings');
    await page.keyboard.press('Escape');
    await expect(body(page)).toHaveAttribute('data-step', 'title');
    expect(errors).toEqual([]);
  });

  test('arrows move and change values, and the next run uses them', async ({page}) => {
    await page.goto(PRESENTER);
    const baseline = await resultsAnnouncement(page);

    await page.goto(PRESENTER);
    await page.keyboard.press('KeyS');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(live(page)).toHaveText('STAFF ON FLOOR: 1.');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('STAFF ON FLOOR: 4.');
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('STAFF ON FLOOR: 4.');
    await page.keyboard.press('Enter');
    await expect(body(page)).toHaveAttribute('data-step', 'title');
    expect(await resultsAnnouncement(page)).not.toBe(baseline);
  });

  test('values survive a reload and RESET restores the defaults', async ({page}) => {
    await page.goto(PRESENTER);
    await page.keyboard.press('KeyS');
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 9 HRS.');

    await page.reload();
    await page.keyboard.press('KeyS');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 9 HRS.');

    await page.getByRole('button', {name: 'RESET'}).click();
    await expect(live(page)).toHaveText('Defaults restored. SHIFT LENGTH: 8 HRS.');
    await page.reload();
    await page.keyboard.press('KeyS');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 8 HRS.');
  });

  test('order sizes that do not total 100 block BACK until they do', async ({page}) => {
    await page.goto(PRESENTER);
    await page.keyboard.press('KeyS');
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
    await expect(live(page)).toHaveText('ORDERS OF 1 TIN: 55 %.');
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('ORDERS OF 1 TIN: 56 %. MUST TOTAL 100.');
    await expect(page.getByRole('button', {name: 'BACK'})).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await expect(body(page)).toHaveAttribute('data-step', 'settings');
    await expect(live(page)).toHaveText(/Cannot leave the menu: MUST TOTAL 100/);

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('button', {name: 'BACK'})).toHaveAttribute('aria-disabled', 'false');
    await page.keyboard.press('Escape');
    await expect(body(page)).toHaveAttribute('data-step', 'title');
  });

  test('R in the menu draws a new day that the pitch then uses', async ({page}) => {
    await page.goto(PRESENTER);
    const seed = await body(page).getAttribute('data-seed');
    await page.keyboard.press('KeyS');
    await page.keyboard.press('KeyR');
    await expect(body(page)).not.toHaveAttribute('data-seed', String(seed));
    await page.keyboard.press('Escape');
    await expect(body(page)).not.toHaveAttribute('data-seed', String(seed));
  });

  test('the buttons are reachable by Tab and Enter on one does what it says, not BACK', async ({page}) => {
    await page.goto(PRESENTER);
    await page.keyboard.press('KeyS');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Decrease value'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Increase value'})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 9 HRS.');
    await expect(body(page)).toHaveAttribute('data-step', 'settings');
    await page.getByRole('button', {name: 'RESET'}).click();
  });

  test('with browser storage blocked the values still apply and a note says so', async ({page}) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await page.goto(PRESENTER);
    await page.keyboard.press('KeyS');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 8 HRS. Not saved, browser storage is off.');
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('SHIFT LENGTH: 9 HRS. Not saved, browser storage is off.');
    await page.keyboard.press('Escape');
    await expect(body(page)).toHaveAttribute('data-step', 'title');
    await page.keyboard.press('KeyS');
    await expect(live(page)).toHaveText(/^SHIFT LENGTH: 9 HRS/);
  });
});

test.describe('on a phone', () => {
  test.use({viewport: {width: 412, height: 839}, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true});

  test('the title has a SETTINGS button, rows are tapped to select and -/+ change them', async ({page}) => {
    await page.goto(PRESENTER);
    const open = page.getByRole('button', {name: 'SETTINGS'});
    await expect(open).toBeVisible();
    await open.tap();
    await expect(body(page)).toHaveAttribute('data-step', 'settings');
    await expect(open).toBeHidden();

    const box = await page.locator('#screen').boundingBox();
    if (!box) throw new Error('no screen');
    const scale = box.height / 144;
    const row = (n: number) => ({x: box.x + box.width / 2, y: box.y + (14 + n * 11 + 5) * scale});
    await page.touchscreen.tap(row(2).x, row(2).y);
    await expect(live(page)).toHaveText('STAFF ON FLOOR: 1.');

    const plus = page.getByRole('button', {name: 'Increase value'});
    const minus = page.getByRole('button', {name: 'Decrease value'});
    for (const b of [plus, minus, page.getByRole('button', {name: 'RESET'}), page.getByRole('button', {name: 'BACK'}), page.getByRole('button', {name: 'RESHUFFLE'})]) {
      const size = await b.boundingBox();
      expect(size?.height).toBeGreaterThanOrEqual(44);
      expect(size?.width).toBeGreaterThanOrEqual(44);
      expect((size?.x ?? 0) + (size?.width ?? 0)).toBeLessThanOrEqual(412);
      expect(size?.y ?? 0).toBeGreaterThanOrEqual(box.y + (112 * scale) - 1);
      expect((size?.y ?? 0) + (size?.height ?? 0)).toBeLessThanOrEqual(box.y + box.height + 1);
    }
    await plus.tap();
    await expect(live(page)).toHaveText('STAFF ON FLOOR: 2.');
    await minus.tap();
    await minus.tap();
    await expect(live(page)).toHaveText('STAFF ON FLOOR: 1.');
    await plus.tap();
    await page.getByRole('button', {name: 'BACK'}).tap();
    await expect(body(page)).toHaveAttribute('data-step', 'title');
    await expect(page.locator('#screen')).toHaveAttribute('aria-label', /Tap to start/);

    await open.tap();
    await page.getByRole('button', {name: 'RESET'}).tap();
    await page.getByRole('button', {name: 'BACK'}).tap();
  });

  test('a tap on the screen in the menu never advances the pitch', async ({page}) => {
    await page.goto(`${URL}?scene=settings`);
    const box = await page.locator('#screen').boundingBox();
    if (!box) throw new Error('no screen');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.1);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.95);
    await expect(body(page)).toHaveAttribute('data-step', 'settings');
  });
});
