module.exports = {
  plugins: [
    function( obj ) {
      if ( obj.type === "js" ) {
        const { code, map } = require( "babel-core" ).transform( obj.code, {
          sourceMaps: true,
          comments: false
        } );
        obj.code = code;
        obj.map = map;
        return obj;
      }
    }
  ],
  _error: "./a doesn't export default. See index.js:5:7"
};
