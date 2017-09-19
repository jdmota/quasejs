module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  plugins: [
    {
      transform: function( previous ) {
        const code = previous.code;
        return require( "babel-core" ).transform( code, {
          sourceMaps: true,
          comments: false
        } );
      }
    }
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  },
  _error: "./a doesn't export default. See files/index.js:5:7"
};
