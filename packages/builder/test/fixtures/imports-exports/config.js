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
    plugins: [ require( "babel-plugin-transform-export-extensions" ) ]
  },
  _out: [
    "1 2 3 4 5 6 7 8 9 10 11"
  ]
};
