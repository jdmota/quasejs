module.exports = {
  babelOpts: {
    presets: [
      [ "@babel/env", {
        targets: { chrome: 50 },
        modules: false,
        loose: true
      } ]
    ]
  },
  _error: "./a doesn't export default. See index.js:1:7"
};
