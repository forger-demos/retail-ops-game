import {readPalette} from './render/palette';
import {createScreen} from './render/screen';
import {drawTitle, promptVisible} from './scenes/title';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('#screen canvas is missing from index.html');

const css = getComputedStyle(document.documentElement);
const screen = createScreen(canvas, readPalette(token => css.getPropertyValue(token)));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const start = performance.now();
const frame = (now: number): void => {
  drawTitle(screen.rect, promptVisible(now - start, reducedMotion.matches));
  requestAnimationFrame(frame);
};
drawTitle(screen.rect, true);
document.body.dataset.scene = 'title';
requestAnimationFrame(frame);
