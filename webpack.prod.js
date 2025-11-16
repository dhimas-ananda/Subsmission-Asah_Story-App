const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = merge(common, {
  mode: 'production',
  output: {
    filename: 'app.[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({ filename: 'app.[contenthash].css' }),
    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'src/public/sw.js'), to: 'sw.js', noErrorOnMissing: true, toType: 'file' },
        { from: path.resolve(__dirname, 'src/public/manifest.json'), to: 'manifest.json', noErrorOnMissing: true, toType: 'file' },
        { from: path.resolve(__dirname, 'src/public/assets'), to: 'assets', noErrorOnMissing: true, toType: 'dir' },
        { from: path.resolve(__dirname, 'src/public/_redirects'), to: '_redirects', noErrorOnMissing: true, toType: 'file' }
      ]
    }),
  ],
});
