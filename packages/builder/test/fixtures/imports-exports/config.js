module.exports = {
  babelOpts: {
    presets: [
      [ "@babel/env", {
        targets: { chrome: 50 },
        modules: false,
        loose: true
      } ]
    ],
    plugins: [
      require( "@babel/plugin-proposal-export-default-from" ),
      require( "@babel/plugin-proposal-export-namespace-from" )
    ]
  },
  _out: [
    "1 2 3 4 5 6 7 8 9 10 11"
  ]
};
