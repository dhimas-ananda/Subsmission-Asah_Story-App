const path = require('path');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.bundle.js',         
    chunkFilename: '[name].chunk.js',
    publicPath: '/',                   
    clean: false,                      
  },

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.js$/i,
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
      filename: 'styles.css',
      chunkFilename: '[id].css',
    }),

    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'src', 'public'), to: path.resolve(__dirname, 'dist') },
      ],
    }),
  ],

  optimization: {
    splitChunks: {
      chunks: 'all',
      name: false,
    },
    runtimeChunk: false,
  },
});
