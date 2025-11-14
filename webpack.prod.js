const path = require('path');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = merge(common, {
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    publicPath: '/'
  },
  module: {
    rules: [
      { test: /\.css$/, use: [ MiniCssExtractPlugin.loader, 'css-loader' ] },
      { test: /\.js$/, exclude: /node_modules/, use: [{ loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } }] }
    ],
  },
  optimization: {
    splitChunks: { chunks: 'all', cacheGroups: { vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', chunks: 'all' } } },
    runtimeChunk: 'single'
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({ filename: '[name].[contenthash].css', chunkFilename: '[id].[contenthash].css' })
  ],
});
