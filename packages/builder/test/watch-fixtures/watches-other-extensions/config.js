module.exports = {
  entries: [
    [ "working/index.js", "atual/dist.js" ]
  ],
  resolve: {
    extensions: [ ".js", ".ts" ]
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
