import {renameSync} from 'fs';
import {join} from 'path';

import {defineConfig, type Plugin} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

const OUT_DIR = 'dist';
const BUILD_FILE = 'paint-rush.html';

// The single-file plugin inlines into index.html during bundling, so the
// rename has to wait until the file is on disk.
function renameEntry(): Plugin {
  return {
    name: 'paint-rush-rename-entry',
    apply: 'build',
    closeBundle() {
      renameSync(join(OUT_DIR, 'index.html'), join(OUT_DIR, BUILD_FILE));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), renameEntry()],
  build: {outDir: OUT_DIR, emptyOutDir: true},
});
