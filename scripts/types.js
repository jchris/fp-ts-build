import fs from 'fs'
import path from 'path'
// import { createBuildSettings } from './settings.js' // import your build settings

// Get the entry points from your build settings
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
// const entryPoints = ['database', 'index', 'types']// createBuildSettings({}).map(config => path.basename(config.entryPoints[0], '.ts'))

function generateIndexFile() {
  const typesDir = path.resolve('dist/types')
  const srcTypesPath = path.resolve('src/types.d.ts')

  // Read the contents of src/types.d.ts
  const srcTypesContent = fs.readFileSync(srcTypesPath, 'utf8')

  // Write the contents to dist/types/types.d.ts
  fs.writeFileSync(path.join(typesDir, 'types.d.ts'), srcTypesContent, 'utf8')

//   // Read the existing .d.ts files and create export statements
//   const files = fs.readdirSync(typesDir)
//   const exports = files
//     .filter(file => file.endsWith('.d.ts') && entryPoints.includes(file.replace('.d.ts', ''))) // filter only entry points
//     .map(file => `export * from './${file.replace('.d.ts', '')}';`)
//     .join('\n')
//   console.log(entryPoints, exports)
//   // Write the export statements to dist/types/index.d.ts
//   fs.writeFileSync(path.join(typesDir, 'index.d.ts'), exports, 'utf8')
}

// Call this function as part of your build process
generateIndexFile()
