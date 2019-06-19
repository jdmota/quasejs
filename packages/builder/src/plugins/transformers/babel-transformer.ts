// @ts-ignore
import { addNamed } from "@babel/helper-module-imports";
// @ts-ignore
import { parseAsync, buildExternalHelpers, transformFromAstAsync } from "@babel/core";
import { join } from "path";
import { writeFileSync } from "fs";
import { Transformer } from "../../types";

const babelExternalsFile = join( __dirname, "babel-helpers.js" );
const babelExternalsCode = buildExternalHelpers( null, "module" );
writeFileSync( babelExternalsFile, babelExternalsCode );

function importHelperPlugin() {
  return {
    pre( file: any ) {
      const cachedHelpers: { [key: string]: any } = {};
      file.set( "helperGenerator", ( name: string ) => {
        if ( cachedHelpers[ name ] ) {
          return cachedHelpers[ name ];
        }
        return ( cachedHelpers[ name ] = addNamed( file.path, name, babelExternalsFile ) );
      } );
    }
  };
}

const NAME = "quase_builder_babel_transformer";

export const transformer: Transformer = {
  name: NAME,

  async parse( options, asset, module ) {
    const program = await parseAsync(
      module.dataToString( asset.data ),
      Object.assign( {
        sourceType: "module",
        parserOpts: {
          sourceType: "module",
          plugins: [
            "dynamicImport"
          ]
        },
        filename: module.relativePath,
        filenameRelative: module.path
      }, options )
    );

    return {
      type: "babel",
      version: "7",
      isDirty: false,
      program
    };
  },

  async transform( options, asset, module ) {

    if ( !asset.ast || module.path === babelExternalsFile ) {
      return asset;
    }

    const babelOpts = Object.assign( {
      sourceType: "module",
      filename: module.relativePath,
      filenameRelative: module.path,
      sourceMaps: false,
      code: false,
      ast: true
    }, options ) as any;

    babelOpts.plugins = ( babelOpts.plugins || [] ).concat( importHelperPlugin );

    const { ast: newAst } = await transformFromAstAsync( asset.ast.program, "", babelOpts );
    asset.type = "js";
    asset.ast.program = newAst;
    asset.ast.isDirty = true;
    return asset;
  }
};

export default transformer;
