module.exports = {
  babelOpts: {
    presets: [
      [ "@babel/env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ],
  },
  _error: "./a exports nothing. See index.js:1:7"
};
