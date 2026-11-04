import {runSimCli} from '../src/sim/cli';

const result = runSimCli(process.argv.slice(2));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.code);
