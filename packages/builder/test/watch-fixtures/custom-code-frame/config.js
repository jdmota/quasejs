module.exports = {
  entries: [
    [ "working/index.js", "atual/dist.js" ]
  ],
  cli: {
    codeFrame: {
      linesAbove: 5,
      linesBelow: 5
    }
  },
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  }
};
