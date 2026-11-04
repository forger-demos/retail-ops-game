import {existsSync} from 'fs';
import {join} from 'path';
import {pathToFileURL} from 'url';

import {expect, type Page, test} from '@playwright/test';

const BUILD = join(import.meta.dirname, '../../dist/paint-rush.html');
const URL = pathToFileURL(BUILD).href;
const DILEMMA = 'A TRADE ORDER: 10 TINS. MIX THEM NOW?';
const UNMANNED = 'THE COUNTER IS UNMANNED. NOBODY CAN SERVE.';
/** The shortest round the menu allows, so a test can play both. */
const ROUND_SECONDS = 20;

test.beforeAll(() => {
  if (!existsSync(BUILD)) throw new Error(`${BUILD} is missing; run \`bun run build\` first`);
});

const body = (page: Page) => page.locator('body');
const live = (page: Page) => page.locator('#prompt');

async function shortRounds(page: Page): Promise<void> {
  await page.addInitScript(seconds => {
    window.localStorage.setItem('paint-rush.settings', JSON.stringify({version: 1, values: {roundSeconds: seconds}}));
  }, ROUND_SECONDS);
}

test.describe('with a keyboard', () => {
  test('SPACE on the title starts round 1 on the trade order; SPACE cannot skip it, and a click mixes', async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL);
    await page.keyboard.press('Space');
    await expect(body(page)).toHaveAttribute('data-step', 'round-1');
    await expect(live(page)).toHaveText(DILEMMA);

    const serve = page.locator('#serve');
    const mix = page.locator('#mix');
    await expect(mix).toHaveText(/MIX 10 TINS\s*KEY 2/);
    await expect(mix).toHaveAttribute('aria-disabled', 'false');
    await expect(serve).toHaveAttribute('aria-disabled', 'true');
    await expect(serve).toHaveText(/SERVE\s*NOBODY WAITING/);
    await expect(page.locator('#hub')).toBeHidden();

    await page.keyboard.press('Space');
    await expect(body(page)).toHaveAttribute('data-step', 'round-1');

    await mix.click();
    await expect(live(page)).toHaveText(UNMANNED);
    await expect(serve).toHaveText(/MIXING/);
    await expect(mix).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits for an aria-disabled button to enable; a person can still press it, and hears why it did nothing.
    await serve.click({force: true});
    await expect(live(page)).toHaveText('SERVE is not available: mixing.');
    expect(errors).toEqual([]);
  });

  test('round 2 offers SEND TO HUB for the trade order, and it keeps the assistant on the floor', async ({page}) => {
    await page.goto(`${URL}?scene=play&round=2`);
    const hub = page.locator('#hub');
    await expect(hub).toBeVisible();
    await expect(hub).toHaveText(/SEND TO HUB\s*KEY 3/);
    await page.keyboard.press('Digit3');
    await expect(live(page)).not.toHaveText(UNMANNED);
    await expect(hub).toHaveText(/NO ORDER/);
    await expect(page.locator('#serve')).toHaveAttribute('aria-disabled', 'false', {timeout: 3000});
    await page.keyboard.press('Digit1');
    await expect(page.locator('#serve')).toHaveText(/SERVING/);
  });
});

test.describe('on a phone', () => {
  test.use({viewport: {width: 412, height: 839}, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true});

  test('the screen takes most of the width and the buttons stay finger-sized', async ({page}) => {
    await page.goto(`${URL}?scene=play`);
    const viewport = page.viewportSize();
    const screen = await page.locator('#screen').boundingBox();
    if (!viewport || !screen) throw new Error('no layout');
    expect(screen.width).toBeGreaterThanOrEqual(viewport.width * 0.75);
    for (const id of ['#serve', '#mix']) {
      const box = await page.locator(id).boundingBox();
      if (!box) throw new Error(`no ${id}`);
      expect(box.width).toBeGreaterThanOrEqual(88);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(screen.y + screen.height);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });

  test('both rounds are played by touch, each ends on its result, and the day follows', async ({page}) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await shortRounds(page);
    await page.goto(URL);
    await page.locator('#screen').tap();
    await expect(body(page)).toHaveAttribute('data-step', 'round-1');
    await expect(page.locator('#mix')).toHaveText(/^MIX 10 TINS\s*$/);

    await page.locator('#mix').tap();
    await expect(live(page)).toHaveText(UNMANNED);
    await expect(body(page)).toHaveAttribute('data-step', 'round-1-result', {timeout: (ROUND_SECONDS + 5) * 1000});
    await expect(live(page)).toHaveText(/^Round 1 result: GBP[\d,]+ in sales made, \d+ customers walked out, \d+ shop minutes with the counter unmanned\./);
    const unmanned1 = Number(/(\d+) shop minutes/.exec(String(await live(page).textContent()))?.[1]);
    expect(unmanned1).toBeGreaterThan(0);

    await page.waitForTimeout(400);
    await page.locator('#screen').tap();
    await expect(body(page)).toHaveAttribute('data-step', 'round-2');
    await page.getByRole('button', {name: 'SEND TO HUB'}).tap();
    const serve = page.locator('#serve');
    const deadline = Date.now() + ROUND_SECONDS * 1000;
    while (Date.now() < deadline && (await body(page).getAttribute('data-step')) === 'round-2') {
      if ((await serve.getAttribute('aria-disabled')) === 'false') await serve.tap();
      await page.waitForTimeout(150);
    }
    await expect(body(page)).toHaveAttribute('data-step', 'round-2-result', {timeout: 5000});
    await expect(live(page)).toHaveText(/^Round 2 result: .* 0 shop minutes with the counter unmanned\. 10 tins sent to the hub\./);

    await page.waitForTimeout(400);
    await page.locator('#screen').tap();
    await expect(body(page)).toHaveAttribute('data-step', 'today');
    expect(errors).toEqual([]);
  });
});
