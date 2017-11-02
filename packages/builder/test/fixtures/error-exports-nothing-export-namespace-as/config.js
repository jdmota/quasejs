module.exports = {
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ],
    plugins: [ "transform-export-extensions" ]
  },
  _error: "./a exports nothing. See index.js:1:7"
};
