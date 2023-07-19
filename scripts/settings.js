import esbuildPluginTsc from 'esbuild-plugin-tsc'

export function createBuildSettings (options) {
  const commonSettings = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    plugins: [
      esbuildPluginTsc({
        force: true
      })
    ],
    ...options
  }

  const cjsConfig = {
    ...commonSettings,
    outfile: 'dist/fireproof.cjs.js',
    format: 'cjs'
  }

  const esmConfig = {
    ...commonSettings,
    outfile: 'dist/fireproof.esm.js',
    format: 'esm'
  }

  const browserConfig = {
    ...commonSettings,
    outfile: 'dist/fireproof.browser.js',
    format: 'iife', // 'iife' format is suitable for browsers
    platform: 'browser', // build for browser platform
    target: 'es2015' // transpile to ES2015 syntax for compatibility with older browsers
  }

  return [cjsConfig, esmConfig, browserConfig]
}
