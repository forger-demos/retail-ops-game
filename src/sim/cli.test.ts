import {join} from 'path';

import {describe, expect, test} from 'bun:test';

import type {SimReport} from './cli';
import {DEFAULT_SEED, runSimCli} from './cli';
import {compare} from './engine';
import {DEFAULT_PARAMS} from './params';

describe('runSimCli', () => {
  test('--json prints both scenarios for the given seed', () => {
    const result = runSimCli(['--json', '--seed', '7']);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout) as SimReport;
    const expected = compare(7, DEFAULT_PARAMS);
    expect(report).toEqual({seed: 7, today: expected.today.metrics, hub: expected.hub.metrics});
  });

  test('the seed defaults when omitted', () => {
    expect((JSON.parse(runSimCli(['--json']).stdout) as SimReport).seed).toBe(DEFAULT_SEED);
  });

  test('without --json it prints a readable table', () => {
    const {code, stdout} = runSimCli([]);
    expect(code).toBe(0);
    expect(stdout).toContain('salesLostGbp');
  });

  test.each([[['--seed']], [['--seed', 'x']], [['--seed', '-1']], [['--wat']]])('bad arguments %p exit 2 with usage', argv => {
    const result = runSimCli(argv);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('usage');
  });
});

test('`bun run sim --json --seed 3` runs end to end', () => {
  const proc = Bun.spawnSync(['bun', 'run', 'sim', '--json', '--seed', '3'], {cwd: join(import.meta.dir, '../..')});
  expect(proc.exitCode).toBe(0);
  const report = JSON.parse(proc.stdout.toString()) as SimReport;
  expect(report.seed).toBe(3);
  expect(report.today.walkIns).toBe(report.hub.walkIns);
});
