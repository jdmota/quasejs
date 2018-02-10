module.exports = {
  babelOpts: {
    presets: [
      [ "@babel/env", {
        targets: { ie: 10 },
        modules: false
      } ]
    ]
  },
  _out: [
    "foo"
  ]
};
