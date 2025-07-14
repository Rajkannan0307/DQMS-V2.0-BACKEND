import path from 'path';

module.exports = {
  entry: './src/index.js', // Entry point of your server-side code
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};