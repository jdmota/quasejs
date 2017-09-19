module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ],
    plugins: [ "transform-export-extensions" ]
  },
  _error: "./a exports nothing. See files/index.js:1:7"
};
