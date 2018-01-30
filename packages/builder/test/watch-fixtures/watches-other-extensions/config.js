module.exports = {
  resolve: {
    extensions: [ ".js", ".ts" ]
  },
  loaders: function( path ) {
    if ( /\.ts$/.test( path ) ) {
      return [ "my-ts-loader" ];
    }
  },
  loaderAlias: {
    "my-ts-loader": function( obj ) {
      obj.type = "js";
      return obj;
    }
  }
};
