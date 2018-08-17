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
  runtime: t.object( {
    properties: {
      browser: {
        type: "boolean",
        default: true
      },
      node: {
        type: "boolean",
        default: true
      },
      worker: {
        type: "boolean",
        default: true
      }
    }
  } ),
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
  codeFrame: t.object( {
    additionalProperties: true
  } ),
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
  watchOptions: t.object( {
    additionalProperties: true
  } ),
  hmr: {
    type: "boolean",
    description: "Enable hot module replacement"
  },
  plugins: t.array( {
    itemType: "any",
    merge: "concat"
  } ),
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
      staticFileGlobs: t.array( {
        itemType: "any"
      } ),
      stripPrefixMulti: t.object( {
        additionalProperties: true
      } )
    },
    additionalProperties: true
  } )
};
