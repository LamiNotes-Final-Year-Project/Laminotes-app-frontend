const { EnvironmentPlugin } = require('webpack');
require('dotenv').config();

module.exports = {
  plugins: [
    new EnvironmentPlugin([
      'CLAUDE_API_KEY'
    ])
  ]
};