import { build } from 'esbuild';
import { createBuildSettings } from './settings.js';

async function buildProject() {
  const buildConfigs = createBuildSettings();

  for (const config of buildConfigs) {
    await build(config);
  }
}

buildProject().catch((err) => {
  console.error(err);
  process.exit(1);
});
