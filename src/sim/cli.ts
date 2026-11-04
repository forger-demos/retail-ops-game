import {compare} from './engine';
import type {Metrics} from './metrics';
import {DEFAULT_PARAMS} from './params';

export const DEFAULT_SEED = 1;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SimReport {
  seed: number;
  today: Metrics;
  hub: Metrics;
}

const USAGE = 'usage: bun run sim [--json] [--seed <non-negative integer>]';

/** The `sim` command, pure: argv in, exit code and output out. */
export function runSimCli(argv: readonly string[]): CliResult {
  let json = false;
  let seed = DEFAULT_SEED;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--seed') {
      const value = argv[++i];
      if (value === undefined || !/^\d+$/.test(value)) return {code: 2, stdout: '', stderr: `--seed needs a non-negative integer\n${USAGE}\n`};
      seed = Number(value);
    } else return {code: 2, stdout: '', stderr: `unknown argument: ${arg}\n${USAGE}\n`};
  }

  const result = compare(seed, DEFAULT_PARAMS);
  const report: SimReport = {seed, today: result.today.metrics, hub: result.hub.metrics};
  return {code: 0, stdout: json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report), stderr: ''};
}

function formatReport(report: SimReport): string {
  const keys = Object.keys(report.today) as (keyof Metrics)[];
  const width = Math.max(...keys.map(k => k.length));
  const lines = [`seed ${report.seed}`, `${''.padEnd(width)}  ${'today'.padStart(8)}  ${'hub'.padStart(8)}`];
  for (const key of keys) lines.push(`${key.padEnd(width)}  ${String(report.today[key]).padStart(8)}  ${String(report.hub[key]).padStart(8)}`);
  return `${lines.join('\n')}\n`;
}
