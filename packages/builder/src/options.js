import Reporter from "./reporter";

const { t } = require( "@quase/config" );
const fs = require( "fs-extra" );

export const schema = {
  mode: {
    type: t.union( [ "production", "development" ].map( t.value ) ),
    required: true
  },
  context: {
    type: "string",
    required: true
  },
  entries: {
    type: t.array( {
      type: "string"
    } ),
    required: true
  },
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
  warn: {
    type: "function",
    default: ( () => {} )
  },
  fs: {
    type: t.object( {
      writeFile: {
        type: "function",
        default: fs.writeFile
      },
      mkdirp: {
        type: "function",
        default: fs.mkdirp
      }
    } )
  },
  cli: {
    type: "object"
  },
  reporter: {
    type: t.union( [
      "string",
      "function",
      t.tuple( [
        t.union( [ "string", "function" ] ),
        "object"
      ] )
    ] ),
    default: Reporter
  },
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
    merge: "concat",
    default: []
  },
  performance: {
    type: t.object( {
      hints: {
        type: t.union( [ "warning", "error" ].map( t.value ) ),
        map: x => ( x === true ? "warning" : x ),
        default: "warning"
      },
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
    } )
  },
  optimization: {
    type: t.object( {
      hashId: {
        type: "boolean"
      },
      hashing: {
        type: "boolean"
      },
      sourceMaps: {
        type: t.union( [ "boolean", t.value( "inline" ) ] ),
        default: false
      },
      /* minification: boolean,
      concatenateModules: boolean,
      treeShaking: boolean, */
      cleanup: {
        type: "boolean"
      }
    } )
  },
  serviceWorker: {
    type: "object",
    default: {
      staticFileGlobs: [],
      stripPrefixMulti: {}
    }
  }
};
