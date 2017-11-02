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
  _error: "./a doesn't export default. See index.js:1:7"
};
