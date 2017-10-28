module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  hashing: true,
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  }
};
