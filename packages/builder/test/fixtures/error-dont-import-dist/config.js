module.exports = {
  entries: [
    [ "files/index.js", "files/dist.js" ]
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  },
  _error: "Don't import the destination file. See files/index.js:1:7"
};
