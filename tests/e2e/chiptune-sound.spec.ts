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

/** Counts oscillators started and contexts made, so the tests can hear without speakers. */
async function spyOnAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {__audio: {contexts: number; notes: number; types: string[]}; AudioContext: unknown};
    w.__audio = {contexts: 0, notes: 0, types: []};
    class FakeContext {
      currentTime = 0;
      destination = {};
      constructor() {
        w.__audio.contexts++;
      }
      resume = async (): Promise<void> => undefined;
      createGain = (): unknown => ({gain: {setValueAtTime() {}, linearRampToValueAtTime() {}}, connect() {}});
      createOscillator = (): unknown => {
        const osc = {
          type: '',
          frequency: {setValueAtTime() {}},
          connect() {},
          start: () => {
            w.__audio.notes++;
            w.__audio.types.push(osc.type);
          },
          stop() {},
        };
        return osc;
      };
    }
    w.AudioContext = FakeContext;
  });
}

const audio = (page: Page): Promise<{contexts: number; notes: number; types: string[]}> =>
  page.evaluate(() => (window as unknown as {__audio: {contexts: number; notes: number; types: string[]}}).__audio);

test('sound is muted on load, and the sound button is finger-sized with a label that says the state', async ({page}) => {
  await spyOnAudio(page);
  await page.goto(PRESENTER);
  const button = page.getByRole('button', {name: 'SOUND OFF'});
  const box = await button.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await button.focus();
  await expect(button).toBeFocused();
  expect(await audio(page)).toMatchObject({contexts: 0, notes: 0});
});

test('M and the button unmute, and the replay then plays synthesised square-wave effects', async ({page}) => {
  await spyOnAudio(page);
  await page.goto(PRESENTER);
  await page.keyboard.press('KeyM');
  await expect(page.getByRole('button', {name: 'SOUND ON'})).toBeVisible();
  await expect(page.locator('#prompt')).toHaveText('Sound on.');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await audio(page)).notes, {timeout: 15000}).toBeGreaterThan(0);
  expect((await audio(page)).types.every(t => t === 'square')).toBe(true);

  await page.getByRole('button', {name: 'SOUND ON'}).click();
  await expect(page.getByRole('button', {name: 'SOUND OFF'})).toBeVisible();
  const heard = (await audio(page)).notes;
  await page.waitForTimeout(1500);
  expect((await audio(page)).notes).toBe(heard);
});

test('a muted replay makes no sound', async ({page}) => {
  await spyOnAudio(page);
  await page.goto(PRESENTER);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  expect(await audio(page)).toMatchObject({contexts: 0, notes: 0});
});
