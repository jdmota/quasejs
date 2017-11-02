module.exports = {
  resolve: {
    extensions: [ ".js", ".ts" ]
  },
  plugins: [
    function( obj ) {
      if ( obj.type === "ts" ) {
        obj.type = "js";
        return obj;
      }
    }
  ]
};
