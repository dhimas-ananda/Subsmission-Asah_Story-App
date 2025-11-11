const path = require('path');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
    ],
  },
  devServer: {
    static: { directory: path.resolve(__dirname, 'dist'), watch: false },
    hot: true,
    host: '0.0.0.0',
    port: 9000,
    client: {
      overlay: true,
      webSocketURL: { protocol: 'ws', hostname: 'localhost', port: 9000, pathname: '/ws' }
    },
    watchFiles: { paths: ['src/**/*'], options: { ignored: /dist|node_modules/ } }
  }
});

