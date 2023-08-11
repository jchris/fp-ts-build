/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import esbuildPluginTsc from 'esbuild-plugin-tsc'
import alias from 'esbuild-plugin-alias'
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

    const builds = []

    const esmConfig = {
      ...commonSettings,
      outfile: `dist/${filename}.esm.js`,
      format: 'esm',
      platform: 'node',
      entryPoints: [entryPoint]
    }

    builds.push(esmConfig)

    if (/fireproof/.test(entryPoint)) {
      const cjsConfig = {
        ...commonSettings,
        outfile: `dist/${filename}.cjs`,
        format: 'cjs',
        platform: 'node',
        entryPoints: [entryPoint]
      }
      builds.push(cjsConfig)

      const browserIIFEConfig = {
        ...commonSettings,
        outfile: `dist/${filename}.browser.iife.js`,
        format: 'iife',
        platform: 'browser',
        target: 'es2015',
        entryPoints: [entryPoint],
        plugins: [
          polyfillNode({}),
          alias({
            // Define your alias here
            'src/store-fs.ts': 'src/store-browser.ts'
          }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ...commonSettings.plugins
        ]
      }

      builds.push(browserIIFEConfig)

      const browserESMConfig = {
        ...browserIIFEConfig,
        outfile: `dist/${filename}.browser.esm.js`,
        format: 'esm'
      }

      builds.push(browserESMConfig)

      const browserCJSConfig = {
        ...browserIIFEConfig,
        outfile: `dist/${filename}.browser.cjs`,
        format: 'cjs'
      }
      builds.push(browserCJSConfig)
    }

    return builds
  })

  return configs.flat()
}
