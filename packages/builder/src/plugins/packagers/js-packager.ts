import { BuilderUtil } from "../context";
import { FinalAsset, FinalModule, Packager } from "../../types";
import StringBuilder from "../../utils/string-builder";
import { chunkInit, moduleArgs } from "../../runtime/create-runtime";

const importLazy = require( "import-lazy" )( require );
const path = require( "path" );
const generate = importLazy( "@babel/generator" );

const PACKAGER_NAME = "quase_builder_js_packager";

async function render( module: FinalModule, ctx: BuilderUtil ) {
  const { data, map } = module.asset;
  const ast = module.asset.ast && module.asset.ast.program;

  if ( !ast ) {
    throw new Error( `${PACKAGER_NAME}: No AST? ${module.id}` );
  }

  const meta = ast._meta;

  if ( !meta ) {
    throw new Error( `${PACKAGER_NAME}: No metadata in AST? ${module.id}` );
  }

  for ( const { source, stringLiteral } of meta.imports ) {
    const m = module.moduleIdByRequest.get( source );
    const newSource = m ? m.hashId : source;
    if ( newSource !== stringLiteral.value ) {
      stringLiteral.value = newSource;
    }
  }

  const optimization = ctx.builderOptions.optimization;

  const opts = {
    filename: module.relativePath,
    sourceFileName: module.path,
    sourceMaps: !!optimization.sourceMaps, // sourceMaps can be "inline", just make sure we pass a boolean to babel
    comments: !optimization.minify,
    minified: optimization.minify
  };

  const generateResult = generate.default( ast, opts, ctx.dataToString( data ) );

  return {
    code: generateResult.code,
    map: optimization.sourceMaps && ctx.joinSourceMaps( [ map, generateResult.map ] ),
    varsUsed: meta.varsUsed
  };
}

export const packager: Packager = {

  async pack( _options, asset: FinalAsset, _, ctx: BuilderUtil ) {

    const { module: entryModule, relativeDest } = asset;

    if ( entryModule.asset.type !== "js" ) {
      return null;
    }

    const build = new StringBuilder( {
      sourceMap: ctx.builderOptions.optimization.sourceMaps,
      cwd: ctx.builderOptions.cwd,
      file: path.basename( relativeDest )
    } );

    build.append( `${chunkInit}.p({` );

    let first = true;

    for ( const module of asset.srcs.values() ) {

      if ( module.asset.type !== "js" ) {
        throw new Error( `Module ${module.id} is not of type 'js'` );
      }

      const { code, map, varsUsed } = await render( module, ctx );

      const args = moduleArgs.slice();
      while ( args.length > 0 && !varsUsed[ args[ args.length - 1 ] ] ) {
        args.pop();
      }

      build.append( `${first ? "" : ","}\n${ctx.wrapInJsPropKey( module.hashId )}:function(${args.join( "," )}){` );
      build.append( code, ctx.isFakePath( module.path ) ? null : map );
      build.append( "\n}" );

      first = false;
    }

    build.append( "}" );

    // Runtime info
    if ( asset.runtime.manifest ) {
      build.append( `,${JSON.stringify( asset.runtime.manifest )}` );
    }

    build.append( ");" );

    const runtimeCode = asset.runtime.code;
    if ( runtimeCode ) {
      build.append(
        runtimeCode.replace( /;?$/, `(${ctx.wrapInJsString( entryModule.hashId )});` )
      );
    }

    return {
      data: build.toString(),
      map: build.sourceMap()
    };
  }

};

export default packager;
