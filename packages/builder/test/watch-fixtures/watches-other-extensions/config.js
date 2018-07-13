module.exports = {
  resolve: {
    extensions: [ ".js", ".ts" ]
  },
  plugins: [
    function() {
      return {
        getGeneration( module, importer ) {
          if ( !importer && module.type === "ts" ) {
            return [ "js" ];
          }
          if ( importer && importer.type === "js" ) {
            return [ "js" ];
          }
        },
        generate: {
          ts: {
            js( obj ) {
              return obj;
            }
          }
        }
      }
    }
  ]
};
