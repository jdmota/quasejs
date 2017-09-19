module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.[hash].js" ]
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  }
};
