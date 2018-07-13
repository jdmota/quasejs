// @flow
import { addNamed } from "@babel/helper-module-imports";
import { buildExternalHelpers, transformSync, transformFromAstSync } from "@babel/core";
import type ModuleUtils from "../module-utils";
import type { Plugin } from "../types";

const HELPERS = "babel_helpers.js";

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

const PLUGIN_NAME = "quase_builder_babel_plugin";

export default function babelPlugin( options: Object ): Plugin {
  return {
    name: PLUGIN_NAME,
    load( path, importerUtils ) {
      if ( path === importerUtils.createFakePath( HELPERS ) ) {
        return babelExternalsCode;
      }
    },
    resolve: {
      js( importee: string, importerUtils: ModuleUtils ) {
        if ( importee === HELPERS ) {
          return importerUtils.createFakePath( HELPERS );
        }
      }
    },
    transform: {
      js( { data, ast: prevAst, map }, module: ModuleUtils ) {

        if ( module.path === module.createFakePath( HELPERS ) ) {
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

        const { ast } = prevAst ? transformFromAstSync( prevAst, data.toString(), babelOpts ) : transformSync( data.toString(), babelOpts );

        return {
          data,
          ast,
          map
        };
      }
    }
  };
}
