// @flow
import arrayConcat from "../utils/array-concat";
import type Builder from "../builder";
import type ModuleUtils from "../module-utils";
import type {
  Plugin, NotResolvedDep, ImportedName, ExportedName,
  FinalAsset, FinalAssets
} from "../types";
import StringBuilder from "../string-builder";
import { chunkInit, moduleArgs } from "../runtime/create-runtime";
import babelPluginModules from "./babel-plugin-transform-modules";
import extractNames from "./ast-extract-names";

type MutableDepsInfo = {|
  +dependencies: Array<NotResolvedDep>,
  +importedNames: Array<ImportedName>,
  +exportedNames: Array<ExportedName>
|};

const path = require( "path" );
const nodeResolve = require( "resolve" );
const babel = require( "@babel/core" );
const generate = require( "@babel/generator" ).default;
const { joinSourceMaps } = require( "@quase/source-map" );

function getLoc( node ) {
  return node.loc && node.loc.start;
}

function addDep( deps, source, async ) {
  deps.dependencies.push( {
    request: source.value,
    loc: getLoc( source ),
    async
  } );
}

function extractor( deps: MutableDepsInfo, node: Object, opts: Object = {} ) {

  if ( opts.require ) {
    addDep( deps, node.arguments[ 0 ] );
    return;
  }

  if ( opts.commonjs ) {
    deps.exportedNames.push( { name: "default", loc: getLoc( node ) } );
    return;
  }

  const { type } = node;

  if ( type === "ImportDeclaration" ) {

    const request = node.source.value;
    addDep( deps, node.source );

    node.specifiers.forEach( s => {
      const loc = getLoc( s );
      if ( s.type === "ImportDefaultSpecifier" ) {
        deps.importedNames.push( {
          imported: "default",
          name: s.local.name,
          request,
          loc
        } );
      } else if ( s.type === "ImportNamespaceSpecifier" ) {
        deps.importedNames.push( {
          imported: "*",
          name: s.local.name,
          request,
          loc
        } );
      } else {
        deps.importedNames.push( {
          imported: s.imported.name,
          name: s.local.name,
          request,
          loc
        } );
      }
    } );

  } else if ( type === "ExportNamedDeclaration" ) {

    if ( node.declaration ) {
      arrayConcat(
        deps.exportedNames,
        extractNames( node.declaration ).map(
          name => ( { name, loc: getLoc( node.declaration ) } )
        )
      );
    } else {
      const request = node.source && node.source.value;
      if ( node.source ) {
        addDep( deps, node.source );
      }
      node.specifiers.forEach( s => {
        const loc = getLoc( s );
        if ( s.type === "ExportDefaultSpecifier" ) { // https://github.com/leebyron/ecmascript-export-default-from
          deps.exportedNames.push( {
            name: s.exported.name,
            imported: "default",
            request,
            loc
          } );
        } else if ( s.type === "ExportNamespaceSpecifier" ) { // https://github.com/leebyron/ecmascript-export-ns-from
          deps.exportedNames.push( {
            name: s.exported.name,
            imported: "*",
            request,
            loc
          } );
        } else {
          deps.exportedNames.push( {
            name: s.exported.name,
            imported: s.local.name,
            request,
            loc
          } );
        }
      } );
    }

  } else if ( type === "ExportDefaultDeclaration" ) {

    deps.exportedNames.push( { name: "default", loc: getLoc( node ) } );

  } else if ( type === "ExportAllDeclaration" ) {

    addDep( deps, node.source );

    deps.exportedNames.push( {
      name: "*",
      imported: "*",
      request: node.source.value,
      loc: getLoc( node )
    } );

  } else if ( type === "CallExpression" ) {

    if ( node.callee.type === "Import" ) {
      const arg = node.arguments[ 0 ];
      if ( arg.type === "StringLiteral" ) {
        addDep( deps, arg, true );
      }
    }

    // TODO support globs

  }

}

const CACHE_KEY = Symbol();

async function render( module: ModuleUtils ) {
  const { data, map, ast } = await module.getResult();
  let regenerate = false;

  const cache = module.cacheGet( CACHE_KEY ) || {};

  for ( const { source, stringLiteral } of cache.imports ) {
    const m = module.getModuleByRequest( source );
    const newSource = m ? m.hashId : source;
    if ( newSource !== stringLiteral.value ) {
      regenerate = true;
      stringLiteral.value = newSource;
    }
  }

  if ( cache.render && !regenerate ) {
    return cache.render;
  }

  const builderOpts = module.builderOptions();

  const opts = {
    filename: module.normalized,
    sourceFileName: module.path,
    sourceMaps: !!builderOpts.optimization.sourceMaps, // sourceMaps can be "inline", just make sure we pass a boolean to babel
    comments: !builderOpts.optimization.minify,
    minified: builderOpts.optimization.minify
  };

  const generateResult = generate( ast, opts, data.toString() );

  cache.render = {
    code: generateResult.code,
    map: builderOpts.optimization.sourceMaps && joinSourceMaps( [ map, generateResult.map ] ),
    varsUsed: cache.varsUsed
  };

  module.cacheSet( CACHE_KEY, cache );

  return cache.render;
}

const PLUGIN_NAME = "quase_builder_js_plugin";

export default function jsPlugin( options: Object ): Plugin {
  return {
    name: PLUGIN_NAME,
    resolve: {
      async js( importee: string, importerUtils: ModuleUtils ): Promise<?string | false> {
        const resolveOpts = options.resolve || {};
        const { extensions, pathFilter, paths, moduleDirectory } = resolveOpts;
        const opts = {
          basedir: path.dirname( importerUtils.path ),
          package: resolveOpts.package,
          extensions,
          async readFile( file, cb ) {
            try {
              cb( null, await importerUtils.readFile( file ) );
            } catch ( err ) {
              cb( err );
            }
          },
          async isFile( file, cb ) {
            try {
              cb( null, await importerUtils.isFile( file ) );
            } catch ( err ) {
              cb( err );
            }
          },
          packageFilter( pkg, path ) {
            if ( pkg.module ) {
              pkg.main = pkg.module;
            }
            return resolveOpts.pathFilter ? resolveOpts.pathFilter( pkg, path ) : pkg;
          },
          pathFilter,
          paths,
          moduleDirectory,
          preserveSymlinks: false
        };
        return new Promise( ( resolve, reject ) => nodeResolve( importee, opts, ( err, res ) => {
          if ( err ) {
            if ( err.code === "MODULE_NOT_FOUND" ) {
              resolve( false );
            } else {
              reject( err );
            }
          } else {
            resolve( res );
          }
        } ) );
      }
    },
    transform: {
      async js( { data, map, ast: prevAst }, module: ModuleUtils ) {

        const dataToString = data.toString();

        const varsUsed = {};
        const imports = [];
        const deps = {
          dependencies: [],
          importedNames: [],
          exportedNames: []
        };

        const opts = {
          babelrc: false,
          configFile: false,
          sourceType: "module",
          parserOpts: {
            sourceType: "module",
            plugins: [
              "dynamicImport"
            ]
          },
          filename: module.normalized,
          filenameRelative: module.path,
          code: false,
          ast: true,
          sourceMaps: false,
          plugins: [
            [ babelPluginModules, {
              varsUsed,
              extractor: extractor.bind( null, deps ),
              extractModuleSource( stringLiteral ) {
                imports.push( {
                  source: stringLiteral.value,
                  stringLiteral
                } );
              }
            } ]
          ]
        };

        const { ast: newAst } = prevAst ? babel.transformFromAstSync( prevAst, dataToString, opts ) : babel.transformSync( dataToString, opts );

        module.cacheSet( CACHE_KEY, {
          varsUsed,
          imports,
          deps
        } );

        return {
          data: dataToString,
          ast: newAst,
          map
        };
      }
    },
    dependencies: {
      js( result, module ) {
        const cache = module.cacheGet( CACHE_KEY );
        return cache && cache.deps;
      }
    },
    renderAsset: {
      async js( asset: FinalAsset, finalAssets: FinalAssets, builder: Builder ) {

        const { id, srcs, dest } = asset;
        const entryModule = builder.getModuleForSure( id );

        const build = new StringBuilder( {
          sourceMap: builder.sourceMaps,
          cwd: builder.cwd,
          file: path.basename( dest )
        } );

        build.append( `${chunkInit}.p({` );

        let first = true;

        for ( const src of srcs ) {

          const module = builder.getModuleForSure( src );

          if ( module.type !== "js" ) {
            throw new Error( `Module ${module.normalized} is not of type 'js'` );
          }

          const { code, map, varsUsed } = await render( module.utils );

          const args = moduleArgs.slice();
          while ( args.length > 0 && !varsUsed[ args[ args.length - 1 ] ] ) {
            args.pop();
          }

          const key = /(^\d|\.|"|')/.test( module.hashId ) ? JSON.stringify( module.hashId ) : module.hashId;

          build.append( `${first ? "" : ","}\n${key}:function(${args.join( "," )}){` );
          build.append( code, builder.isFakePath( module.path ) ? null : map );
          build.append( "\n}" );

          first = false;
        }

        build.append( "});" );

        if ( asset.isEntry ) {
          const runtime = await builder.createRuntime( {
            context: builder.context,
            fullPath: asset.path,
            publicPath: builder.publicPath,
            finalAssets
          } );
          build.append( runtime.replace( /;?$/, `("${entryModule.hashId}");` ) );
        }

        return {
          data: build.toString(),
          map: build.sourceMap()
        };
      }
    }
  };
}
