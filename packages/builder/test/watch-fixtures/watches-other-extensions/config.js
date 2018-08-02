module.exports = {
  resolve: {
    extensions: [ ".js", ".ts" ]
  },
  plugins: [
    function() {
      return {
        getTypeTransforms( module, importer ) {
          if ( !importer && module.type === "ts" ) {
            return [ "js" ];
          }
          if ( importer && importer.type === "js" ) {
            return [ "js" ];
          }
        },
        transformType: {
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
