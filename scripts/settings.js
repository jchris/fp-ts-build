/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import esbuildPluginTsc from 'esbuild-plugin-tsc'
import fs from 'fs'
import path from 'path'

// Obtain all .ts files in the src directory
const entryPoints = fs
  .readdirSync('src')
  .filter(file => path.extname(file) === '.ts')
  .map(file => path.join('src', file))

export function createBuildSettings(options) {
  const commonSettings = {
    entryPoints,
    bundle: true,
    sourcemap: true,
    plugins: [
      esbuildPluginTsc({
        force: true
      })
    ],
    ...options
  }

  // Generate build configs for each entry point
  const configs = entryPoints.map(entryPoint => {
    const filename = path.basename(entryPoint, '.ts')

    const cjsConfig = {
      ...commonSettings,
      outfile: `dist/${filename}.cjs.js`,
      format: 'cjs',
      entryPoints: [entryPoint]
    }

    const esmConfig = {
      ...commonSettings,
      outfile: `dist/${filename}.esm.js`,
      format: 'esm',
      platform: 'node',
      entryPoints: [entryPoint]
    }

    const browserConfig = {
      ...commonSettings,
      outfile: `dist/${filename}.browser.js`,
      format: 'iife',
      platform: 'browser',
      target: 'es2015',
      entryPoints: [entryPoint]
    }

    return [cjsConfig, esmConfig, browserConfig]
  })

  return configs.flat()
}
