// @flow
import { addNamed } from "@babel/helper-module-imports";
import { parseAsync, buildExternalHelpers, transformFromAstAsync } from "@babel/core";
import type { ModuleUtils } from "../../modules/utils";
import type { Plugin } from "../../types";

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
      js( importee, importerUtils ) {
        if ( importee === HELPERS ) {
          return importerUtils.createFakePath( HELPERS );
        }
      }
    },
    parse: {
      js( data, module: ModuleUtils ) {
        return parseAsync( data, Object.assign( {
          sourceType: "module",
          parserOpts: {
            sourceType: "module",
            plugins: [
              "dynamicImport"
            ]
          },
          filename: module.normalized,
          filenameRelative: module.path
        }, options ) );
      }
    },
    transformAst: {
      async js( ast, module ) {

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

        const { ast: newAst } = await transformFromAstAsync( ast, "", babelOpts );
        return newAst;
      }
    }
  };
}
