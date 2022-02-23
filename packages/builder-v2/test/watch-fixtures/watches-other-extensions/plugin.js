module.exports = function() {
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
        js( ast ) {
          return {
            data: `export default 10;\n`
          };
        }
      }
    }
  }
};
