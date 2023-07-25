/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import esbuildPluginTsc from 'esbuild-plugin-tsc'
import fs from 'fs'
import path from 'path'
import { polyfillNode } from 'esbuild-plugin-polyfill-node'

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
      platform: 'node',
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
      outfile: `dist/${filename}.browser.iife.js`,
      format: 'iife',
      platform: 'browser',
      target: 'es2015',
      entryPoints: [entryPoint],
      plugins: [
        polyfillNode({}),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ...commonSettings.plugins
      ]
    }

    const browserESMConfig = {
      ...browserConfig,
      outfile: `dist/${filename}.browser.esm.js`,
      format: 'esm'
    }

    const browserCJSConfig = {
      ...browserConfig,
      outfile: `dist/${filename}.browser.cjs.js`,
      format: 'cjs'
    }

    return [cjsConfig, esmConfig, browserConfig, browserESMConfig, browserCJSConfig]
  })

  return configs.flat()
}
