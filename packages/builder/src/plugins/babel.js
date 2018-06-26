import { addNamed } from "@babel/helper-module-imports";
import { buildExternalHelpers, transformSync, transformFromAstSync } from "@babel/core";

const HELPERS = "babel_helpers";

function importHelperPlugin() {
  return {
    pre( file ) {
      const cachedHelpers = {};
      file.set( "helperGenerator", name => {
        if ( cachedHelpers[ name ] ) {
          return cachedHelpers[ name ];
        }
        return ( cachedHelpers[ name ] = addNamed( file.path, name, HELPERS ) );
      } );
    }
  };
}

const babelExternalsCode = buildExternalHelpers( null, "module" );

export default function( options ) {
  return {
    resolve( id, _, builder ) {
      if ( id === HELPERS ) {
        return builder.createFakePath( HELPERS );
      }
    },
    load( id, builder ) {
      const helpers = builder.createFakePath( HELPERS );
      if ( id === helpers ) {
        return {
          type: "js",
          data: babelExternalsCode
        };
      }
    },
    transform( { type, data, ast: prevAst }, module, builder ) {

      if ( module.path === builder.createFakePath( HELPERS ) ) {
        return;
      }

      const babelOpts = Object.assign( {
        sourceType: "module",
        filename: module.normalized,
        filenameRelative: module.path,
        sourceMaps: false,
        code: false,
        ast: true
      }, options );

      babelOpts.plugins = ( babelOpts.plugins || [] ).concat( importHelperPlugin );

      if ( type === "js" ) {
        const { ast } = prevAst ? transformFromAstSync( prevAst, data.toString(), babelOpts ) : transformSync( data.toString(), babelOpts );

        return {
          type,
          data,
          ast
        };
      }
    }
  };
}
