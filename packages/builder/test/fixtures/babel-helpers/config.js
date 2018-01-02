module.exports = {
  babelOpts: {
    presets: [
      [ "@babel/env", {
        targets: { ie: 10 }
      } ]
    ]
  },
  _out: [
    "foo"
  ]
};
