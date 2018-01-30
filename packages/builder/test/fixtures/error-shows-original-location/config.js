module.exports = {
  loaders: function() {
    return [
      function( obj ) {
        if ( obj.type === "js" ) {
          const { code, map } = require( "@babel/core" ).transform( obj.data, {
            sourceMaps: true,
            comments: false
          } );
          obj.data = code;
          obj.map = map;
          return obj;
        }
      }
    ];
  },
  _error: "./a doesn't export default. See index.js:5:7"
};
