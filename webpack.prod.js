const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');

module.exports = merge(common, {
  mode: 'production',
  output: {
    filename: 'app.[contenthash].js',
    chunkFilename: 'chunk.[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  
  optimization: {
    splitChunks: {
      chunks: 'async',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        critical: {
          test: /[\\/](idb|offline-sync|idb-service)\.js$/,
          name: 'app',
          chunks: 'all',
          enforce: true,
          priority: 20,
        },
      },
    },
    runtimeChunk: false,
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
    new MiniCssExtractPlugin({ 
      filename: 'app.[contenthash].css' 
    }),
    
    new CopyPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, 'src/public/manifest.json'), 
          to: path.resolve(__dirname, 'dist/manifest.json'),
          noErrorOnMissing: true 
        },
        { 
          from: path.resolve(__dirname, 'src/public/assets'), 
          to: path.resolve(__dirname, 'dist/assets'),
          noErrorOnMissing: true 
        },
        { 
          from: path.resolve(__dirname, 'src/public/_redirects'), 
          to: path.resolve(__dirname, 'dist/_redirects'),
          noErrorOnMissing: true,
          toType: 'file' 
        },
      ]
    }),
    
    new InjectManifest({
      swSrc: path.resolve(__dirname, 'src/public/sw.js'),
      swDest: 'sw.js',
      include: [/\.html$/, /\.js$/, /\.css$/],
      exclude: [/\.map$/, /^manifest.*\.js$/, /_redirects$/],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    }),
  ],
});