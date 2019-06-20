const pnp = require( "../.pnp.js" );
pnp.setup();
const fs = require( "fs-extra" );
const path = require( "path" );
const prependFile = require( "prepend-file" );

/* eslint-disable no-console */

const TS_ORIGINAL_PATH = path.dirname( path.dirname( require.resolve( "typescript" ) ) );
const PNP = path.resolve( __dirname, "../.pnp.js" ).replace( /\\/g, "/" );
const TS_PATH = path.resolve( __dirname, "node_modules/typescript" ).replace( /\\/g, "/" );
const TS_LIB = path.resolve( __dirname, "node_modules/typescript/lib" ).replace( /\\/g, "/" );
const PNP_RELATIVE = path.relative( TS_LIB, PNP ).replace( /\\/g, "/" );
const PACKAGES = path.resolve( __dirname, "../packages" ).replace( /\\/g, "/" );

const patch = `
var ts;
(function (ts) {
  var pnp = require( "${PNP_RELATIVE}" );
  pnp.setup();
  var { resolveModuleName } = require( "ts-pnp" );
  var path = require( "path" );
  var fs = require( "fs" );

  var PACKAGES = "${PACKAGES}";
  var DIST = ${/\/packages\/[^]+\/dist\//};
  function enhance(obj) {
    if (obj) {
      var file = obj.resolvedFileName.replace( ${/\\/g}, "/" );
      if (file.startsWith(PACKAGES) && DIST.test(file)) {
        file = file.replace("/dist/","/src/").replace(${/\.js$/},".ts");
        if (fs.existsSync(file)) {
          obj.resolvedFileName = file;
          obj.extension = ".ts";
        }
      }
    }
    return obj;
  }
  function myResolve(a,b,c,d,e) {
    var r = resolveModuleName(a,b,c,d,e);
    return {
      resolvedModule: enhance(r.resolvedModule),
      resolvedTypeReferenceDirective: r.resolvedTypeReferenceDirective,
      failedLookupLocations: r.failedLookupLocations,
    };
  }

  var resolve;
  Object.defineProperty( ts, "resolveModuleName", {
    get() {
      return resolve;
    },
    set( original ) {
      resolve = function( moduleName, containingFile, compilerOptions, compilerHost ) {
        return myResolve( moduleName, containingFile, compilerOptions, compilerHost, original );
      };
    }
  } );

  var resolveType;
  Object.defineProperty( ts, "resolveTypeReferenceDirective", {
    get() {
      return resolveType;
    },
    set( original ) {
      resolveType = function( typeReferenceDirectiveName, containingFile, options, host, redirectedReference ) {
        return resolveModuleName( typeReferenceDirectiveName, containingFile, options, host, original );
      };
    }
  } );
})(ts || (ts = {}));
`;

console.log( "Typescript path:", TS_ORIGINAL_PATH );

console.log( "Copying typescript..." );
fs.copySync( TS_ORIGINAL_PATH, TS_PATH );

const jobs = [
  "tsc.js",
  "tsserver.js",
  "tsserverlibrary.js",
  "typescript.js",
  "typescriptServices.js",
  "typingsInstaller.js"
];

for ( const job of jobs ) {
  console.log( `Patching ${job}...` );
  prependFile.sync( `${TS_LIB}/${job}`, patch );
}

console.log( "Done" );
