const webpack = require('webpack');

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      'util': require.resolve('util'),
      'assert': require.resolve('browser-assert'),
      'path': require.resolve('path-browserify'),
      'stream': require.resolve('stream-browserify'),
      'crypto': require.resolve('crypto-browserify'),
      'os': require.resolve('os-browserify') // Add this line for os module
    },
    alias: {
      'fs': 'memfs', // Alias 'fs' to 'memfs'
      // 'fs/promises': 'xxx' // You might need to ensure that memfs exports promises-compatible methods
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new webpack.NormalModuleReplacementPlugin(/os/, resource => {
      if (resource.request === 'os') {
        resource.request = '../test/os-mock.cjs'; // Path to your os-mock.js file
      }
    }),
  ]
};
