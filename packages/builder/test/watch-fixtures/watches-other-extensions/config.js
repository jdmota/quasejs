module.exports = {
  resolve: {
    extensions: [ ".js", ".ts" ]
  },
  plugins: [
    function() {
      return {
        transform( obj ) {
          if ( obj.type === "ts" ) {
            obj.type = "js";
            return obj;
          }
        }
      }
    }
  ]
};
