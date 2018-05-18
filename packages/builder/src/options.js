import Reporter from "./reporter";

const { t } = require( "@quase/config" );
const fs = require( "fs-extra" );

const OptimizationOptions = t.object( {
  properties: {
    hashId: {
      type: "boolean"
    },
    hashing: {
      type: "boolean"
    },
    sourceMaps: t.union( {
      types: [ "boolean", t.value( { value: "inline" } ) ],
      default: false
    } ),
    minify: {
      type: "boolean",
    },
    cleanup: {
      type: "boolean"
    }
  }
} );

OptimizationOptions.defaults = function( path, dest ) {
  if ( dest.mode === "production" ) {
    return {
      hashId: true,
      hashing: true,
      sourceMaps: true,
      minify: true,
      cleanup: true
    };
  }
  return {
    hashId: false,
    hashing: false,
    sourceMaps: true,
    minify: false,
    cleanup: false
  };
};

export const schema = {
  mode: t.choices( {
    values: [ "production", "development" ],
    required: true
  } ),
  context: {
    type: "string",
    required: true
  },
  entries: t.array( {
    itemType: "string",
    required: true
  } ),
  dest: {
    type: "string",
    required: true
  },
  cwd: {
    type: "string",
    default: process.cwd()
  },
  publicPath: {
    type: "string",
    default: ""
  },
  fs: t.object( {
    properties: {
      writeFile: {
        type: "function",
        default: fs.writeFile
      },
      mkdirp: {
        type: "function",
        default: fs.mkdirp
      }
    }
  } ),
  cli: {
    type: "object"
  },
  reporter: t.union( {
    types: [
      "string",
      "function",
      t.tuple( {
        items: [
          t.union( {
            types: [ "string", "function" ]
          } ),
          "object"
        ]
      } )
    ],
    default: Reporter
  } ),
  watch: {
    type: "boolean",
    alias: "w",
    description: "Watch files for changes and re-build"
  },
  watchOptions: {
    type: "object"
  },
  plugins: {
    type: "array",
    merge: "concat"
  },
  performance: t.object( {
    properties: {
      hints: t.choices( {
        values: [ "warning", "error" ],
        map: x => ( x === true ? "warning" : x ),
        default: "warning"
      } ),
      maxEntrypointSize: {
        type: "number",
        default: 250000
      },
      maxAssetSize: {
        type: "number",
        default: 250000
      },
      assetFilter: {
        type: "function",
        default: f => ( !/\.map$/.test( f ) )
      }
    }
  } ),
  optimization: OptimizationOptions,
  serviceWorker: t.object( {
    properties: {
      filename: {
        type: "string",
        optional: true
      },
      staticFileGlobs: {
        type: "array"
      },
      stripPrefixMulti: {
        type: "object"
      }
    },
    additionalProperties: true
  } )
};
