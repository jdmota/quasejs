// @flow
import arrayConcat from "../../utils/array-concat";
import type Module from "../../module";
import type {
  Plugin, NotResolvedDep, ImportedName, ExportedName,
  FinalAsset, FinalAssets
} from "../../types";
import StringBuilder from "../../string-builder";
import { chunkInit, moduleArgs } from "../../runtime/create-runtime";
import type { BuilderContext } from "../context";
import babelPluginModules from "./babel-plugin-transform-modules";
import extractNames from "./ast-extract-names";

type MutableDepsInfo = {|
  +dependencies: Map<string, ?NotResolvedDep>,
  +importedNames: Array<ImportedName>,
  +exportedNames: Array<ExportedName>
|};

const path = require( "path" );
const nodeResolve = require( "resolve" );
const babel = require( "@babel/core" );
const generate = require( "@babel/generator" ).default;

function getLoc( node ) {
  return node.loc && node.loc.start;
}

function addDep( deps, source, async ) {
  const curr = deps.dependencies.get( source.value );
  if ( curr ) {
    if ( !async && curr.async ) {
      deps.dependencies.set( source.value, {
        loc: getLoc( source ),
        async
      } );
    }
  } else {
    deps.dependencies.set( source.value, {
      loc: getLoc( source ),
      async
    } );
  }
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

const PLUGIN_NAME = "quase_builder_js_plugin";
const METADATA_KEY = "quase_builder_js_plugin_metadata";

async function render( module: Module, ctx: BuilderContext ) {
  const { data, map } = module.getLoadResult();
  const { ast } = module.getTransformResult();
  let regenerate = false;

  if ( !ast ) {
    throw new Error( `${PLUGIN_NAME}: No AST?` );
  }

  const cache = ast[ METADATA_KEY ];

  if ( !cache ) {
    throw new Error( `${PLUGIN_NAME}: No metadata in AST?` );
  }

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

  const optimization = ctx.builderOptions.optimization;

  const opts = {
    filename: module.normalized,
    sourceFileName: module.path,
    sourceMaps: !!optimization.sourceMaps, // sourceMaps can be "inline", just make sure we pass a boolean to babel
    comments: !optimization.minify,
    minified: optimization.minify
  };

  const generateResult = generate( ast, opts, ctx.dataToString( data ) );

  cache.render = {
    code: generateResult.code,
    map: optimization.sourceMaps && ctx.joinSourceMaps( [ map, generateResult.map ] ),
    varsUsed: cache.varsUsed
  };

  ast[ METADATA_KEY ] = cache;

  return cache.render;
}

export default function jsPlugin( options: Object ): Plugin {
  return {
    name: PLUGIN_NAME,
    resolve: {
      async js( importee: string, importerUtils ): Promise<?string | false> {
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
    parse: {
      js( data, module ) {
        return babel.parseAsync( data, {
          babelrc: false,
          configFile: false,
          sourceType: "module",
          parserOpts: {
            sourceType: "module",
            plugins: [
              "dynamicImport",
              "importMeta"
            ]
          },
          filename: module.normalized,
          filenameRelative: module.path
        } );
      }
    },
    transformAst: {
      async js( ast, module ) {

        const varsUsed = {};
        const imports = [];
        const deps = {
          dependencies: new Map(),
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
              "dynamicImport",
              "importMeta"
            ]
          },
          filename: module.normalized,
          filenameRelative: module.path,
          code: false,
          ast: true,
          sourceMaps: false,
          plugins: [
            [ babelPluginModules, {
              hmr: module.builderOptions.hmr,
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

        const { ast: newAst } = await babel.transformFromAstAsync( ast, "", opts );

        newAst[ METADATA_KEY ] = {
          varsUsed,
          imports,
          deps
        };

        return newAst;
      }
    },
    dependencies: {
      js( ast ) {
        if ( !ast[ METADATA_KEY ] ) {
          throw new Error( `${PLUGIN_NAME}: Could not find metadata. Did another plugin change the AST?` );
        }

        const cache = ast[ METADATA_KEY ];
        return cache && cache.deps;
      }
    },
    renderAsset: {
      async js( asset: FinalAsset, finalAssets: FinalAssets, _, ctx: BuilderContext ) {

        const { module: entryModule, relativeDest } = asset;

        const build = new StringBuilder( {
          sourceMap: ctx.builderOptions.optimization.sourceMaps,
          cwd: ctx.builderOptions.cwd,
          file: path.basename( relativeDest )
        } );

        build.append( `${chunkInit}.p({` );

        let first = true;

        for ( const module of asset.srcs ) {

          if ( module.type !== "js" ) {
            throw new Error( `Module ${module.normalized} is not of type 'js'` );
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

        build.append( "});" );

        const runtime = asset.runtime;
        if ( runtime ) {
          build.append( runtime.code.replace( /;?$/, `(${ctx.wrapInJsString( entryModule.hashId )});` ) );
        }

        return {
          data: build.toString(),
          map: build.sourceMap()
        };
      }
    }
  };
}
