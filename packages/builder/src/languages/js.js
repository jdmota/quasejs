// @flow
import arrayConcat from "../utils/array-concat";
import type {
  Data, NotResolvedDep, ImportedName, ExportedName, FinalAsset, FinalAssets
} from "../types";
import type Module from "../module";
import Builder from "../builder";
import Language from "../language";
import StringBuilder from "../string-builder";
import babelPluginModules from "./babel-plugin-transform-modules";
import extractNames from "./ast-extract-names";

const path = require( "path" );
const nodeResolve = require( "resolve" );
const { parse } = require( "babylon" );
const babel = require( "@babel/core" );
const types = require( "@babel/types" );
const { joinSourceMaps } = require( "@quase/source-map" );
const MagicString = require( "magic-string" );

function traverseTopLevel( { body }, enter ) {
  for ( let i = 0; i < body.length; i++ ) {
    enter( body[ i ] );
  }
}

function traverse( node, enter ) {
  if ( !node ) return;

  const keys = types.VISITOR_KEYS[ node.type ];
  if ( !keys ) return;

  const go = enter( node );

  if ( !go ) return;

  for ( let i = 0; i < keys.length; i++ ) {
    const subNode = node[ keys[ i ] ];

    if ( Array.isArray( subNode ) ) {
      for ( let i = 0; i < subNode.length; i++ ) {
        traverse( subNode[ i ], enter );
      }
    } else {
      traverse( subNode, enter );
    }
  }
}

const defaultParserOpts = {
  sourceType: "module",
  plugins: [
    "asyncGenerators",
    "bigInt",
    "classPrivateMethods",
    "classPrivateProperties",
    "classProperties",
    "decorators2",
    "doExpressions",
    "dynamicImport",
    "exportExtensions",
    "exportDefaultFrom",
    "exportNamespaceFrom",
    "flow",
    "functionBind",
    "functionSent",
    "importMeta",
    "jsx",
    "nullishCoalescingOperator",
    "numericSeparator",
    "objectRestSpread",
    "optionalCatchBinding",
    "optionalChaining",
    "pipelineOperator",
    "throwExpressions"
  ]
};

const moduleArgs = "$e,$r,$i,$b,$g,$a".split( "," );

const chunkInit = babel.transform(
  `"use strict";( {
    g: typeof self !== "undefined" ? self : Function( "return this" )(),
    p: function( m ) {
      ( this.g.__quase_builder__ = this.g.__quase_builder__ || { q: [] } ).q.push( m );
    }
  } )`,
  {
    babelrc: false,
    minified: true
  }
).code.replace( /;$/, "" );

// Adapted from https://github.com/babel/babel/blob/master/packages/babel-plugin-external-helpers/src/index.js
function helpersPlugin( ref, options ) {
  return {
    pre( file ) {
      file.set( "helpersNamespace", ref.types.identifier( "$b" ) );

      const addHelper = file.addHelper;
      file.addHelper = function( name ) {
        options.helpers[ name ] = true;
        return addHelper.call( file, name );
      };
    }
  };
}

export default class JsLanguage extends Language {

  static TYPE = "js";

  +babelOpts: Object;
  +parserOpts: Object;
  +dataToString: string;
  +ast: Object;
  +deps: NotResolvedDep[];
  lastRender: ?Object;
  +_dynamicImports: Object[];
  +_importNames: ImportedName[];
  +_exportNames: ExportedName[];

  constructor( id: string, data: Data, options: Object, module: Module, builder: Builder ) {
    super( id, data, options );

    const babelOpts = this.options.babelOpts || {};

    this.parserOpts = Object.assign( {}, babelOpts.parserOpts );
    this.parserOpts.plugins = this.parserOpts.plugins || defaultParserOpts.plugins;
    this.parserOpts.sourceType = this.parserOpts.sourceType || defaultParserOpts.sourceType;

    this.babelOpts = Object.assign(
      { parserOpts: this.parserOpts },
      this.options.babelOpts || {}
    );

    this.dataToString = data.toString();
    this.ast = parse( this.dataToString, this.parserOpts );
    this.deps = [];

    this.lastRender = null;
    this._dynamicImports = [];
    this._importNames = [];
    this._exportNames = [];

    this.extractDep = this.extractDep.bind( this );

    this.processDeps();
    this.render( module, builder );
  }

  addDep( source, async ) {
    this.deps.push( {
      request: source.value,
      loc: source.loc.start,
      splitPoint: async,
      async
    } );
  }

  extractDep( node, opts = {} ) {

    if ( opts.require ) {
      this.addDep( node.arguments[ 0 ] );
      return;
    }

    if ( opts.commonjs ) {
      this._exportNames.push( { name: "default", loc: node.loc.start } );
      return;
    }

    const { type } = node;

    if ( type === "ImportDeclaration" ) {

      const request = node.source.value;
      this.addDep( node.source );

      node.specifiers.forEach( s => {
        const loc = s.loc.start;
        if ( s.type === "ImportDefaultSpecifier" ) {
          this._importNames.push( {
            imported: "default",
            name: s.local.name,
            request,
            loc
          } );
        } else if ( s.type === "ImportNamespaceSpecifier" ) {
          this._importNames.push( {
            imported: "*",
            name: s.local.name,
            request,
            loc
          } );
        } else {
          this._importNames.push( {
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
          this._exportNames,
          extractNames( node.declaration ).map(
            name => ( { name, loc: node.declaration.loc.start } )
          )
        );
      } else {
        const request = node.source && node.source.value;
        if ( node.source ) {
          this.addDep( node.source );
        }
        node.specifiers.forEach( s => {
          const loc = s.loc.start;
          if ( s.type === "ExportDefaultSpecifier" ) { // https://github.com/leebyron/ecmascript-export-default-from
            this._exportNames.push( {
              name: s.exported.name,
              imported: "default",
              request,
              loc
            } );
          } else if ( s.type === "ExportNamespaceSpecifier" ) { // https://github.com/leebyron/ecmascript-export-ns-from
            this._exportNames.push( {
              name: s.exported.name,
              imported: "*",
              request,
              loc
            } );
          } else {
            this._exportNames.push( {
              name: s.exported.name,
              imported: s.local.name,
              request,
              loc
            } );
          }
        } );
      }

    } else if ( type === "ExportDefaultDeclaration" ) {

      this._exportNames.push( { name: "default", loc: node.loc.start } );

    } else if ( type === "ExportAllDeclaration" ) {

      this.addDep( node.source );

      this._exportNames.push( {
        name: "*",
        imported: "*",
        request: node.source.value,
        loc: node.loc.start
      } );

    } else if ( type === "CallExpression" ) {

      if ( node.callee.type === "Import" ) {
        const arg = node.arguments[ 0 ];
        if ( arg.type === "StringLiteral" ) {
          this.addDep( arg, true );
          this._dynamicImports.push( {
            isGlob: false,
            name: arg.value,
            loc: arg.loc.start
          } );
        } else if ( arg.type === "TemplateLiteral" ) {
          let glob = "";
          for ( const quasi of arg.quasis ) {
            glob += quasi.value.cooked + "*";
          }
          glob = glob.slice( 0, -1 ).replace( /\/\*\//g, "/?*/" );
          this._dynamicImports.push( {
            isGlob: arg.quasis.length > 1,
            name: glob,
            loc: arg.loc.start
          } );
          // TODO test this
        } else {
          // TODO warn that we cannot detect what you are trying to import on Module
          // TODO if it's an identifier, try to get it if it is constant?
          this._dynamicImports.push( {
            warn: true,
            loc: arg.loc.start
          } );
        }
      }

      return true;

    } else {

      return true;

    }

  }

  processDeps() {
    const t = this.parserOpts.allowImportExportEverywhere || this.parserOpts.plugins.indexOf( "dynamicImport" ) > -1 ? traverse : traverseTopLevel;
    t( this.ast.program, this.extractDep );
  }

  resolve( importee: string, importer: string, builder: Builder ): Promise<?string | boolean> {
    const resolveOpts = this.options.resolve || {};
    const { fileSystem } = builder;
    const { extensions, pathFilter, paths, moduleDirectory } = resolveOpts;
    const opts = {
      basedir: path.dirname( importer ),
      package: resolveOpts.package,
      extensions,
      async readFile( file, cb ) {
        try {
          cb( null, await fileSystem.readFile( file, importer ) );
        } catch ( err ) {
          cb( err );
        }
      },
      async isFile( file, cb ) {
        try {
          cb( null, await fileSystem.isFile( file, importer ) );
        } catch ( err ) {
          cb( err );
        }
      },
      packageFilter( pkg, path, relativePath ) {
        if ( pkg.module ) {
          pkg.main = pkg.module;
        }
        return resolveOpts.pathFilter ? resolveOpts.pathFilter( pkg, path, relativePath ) : pkg;
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

  async moreLanguages() {
    return [];
  }

  async importedNames() {
    return this._importNames;
  }

  async exportedNames() {
    return this._exportNames;
  }

  async dependencies() {
    return this.deps;
  }

  render( module: Module, builder: Builder ) {
    if ( this.lastRender ) {
      return this.lastRender;
    }

    const opts = Object.assign( {}, this.options.babelOpts, {
      filename: module.normalized,
      filenameRelative: module.path,
      sourceMaps: !!builder.sourceMaps // sourceMaps can be "inline", just make sure we pass a boolean to babel
    } );

    const helpers = {};
    const varsUsed = {};
    const imports = [];

    opts.plugins = ( opts.plugins || [] ).concat( [
      [ helpersPlugin, { helpers } ],
      [ babelPluginModules, {
        varsUsed,
        extractor: this.extractDep,
        resolveModuleSource( source ) {
          const key = `__quase_builder_import_${source}__`;
          imports.push( { source, key } );
          return key;
        }
      } ]
    ] );

    this.lastRender = babel.transformFromAst( this.ast, this.dataToString, opts );
    this.lastRender.helpers = helpers;
    this.lastRender.varsUsed = varsUsed;
    this.lastRender.imports = imports;
    return this.lastRender;
  }

  async renderAsset( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets, otherUsedHelpers: Set<string> ) {
    const { id, srcs, dest } = asset;
    const entryModule = builder.getModuleForSure( id );
    const usedHelpers = new Set( otherUsedHelpers );

    const build = new StringBuilder( {
      sourceMap: builder.sourceMaps,
      cwd: builder.cwd,
      file: path.basename( dest )
    } );

    build.append( `${chunkInit}.p({` );

    let first = true;

    for ( const src of srcs ) {

      const module = builder.getModuleForSure( src );
      const lang = module.lang;

      if ( !lang || !( lang instanceof JsLanguage ) ) {
        throw new Error( `Module ${module.id} is not of type 'js'` );
      }

      const { code, map, helpers, varsUsed, imports } = lang.render( module, builder );

      for ( const name in helpers ) {
        usedHelpers.add( name );
      }

      let finds = [];
      for ( const { source, key } of imports ) {
        let index;
        while ( ( index = code.indexOf( key, index + 1 ) ) > -1 ) {
          finds.push( {
            source,
            key,
            index
          } );
        }
      }
      finds = finds.sort( ( a, b ) => a.index - b.index );

      const sourceObj = new MagicString( code );
      let i = finds.length;

      while ( i-- ) {
        const { source, key, index } = finds[ i ];
        const m = module.getModuleByRequest( builder, source );
        const replacement = m ? m.hashId : source;
        sourceObj.overwrite( index, index + key.length, replacement, { storeName: false } );
      }

      let finalMap;

      if ( map ) {
        const map2 = sourceObj.generateMap( {
          hires: true
        } );
        map2.sources[ 0 ] = module.path;

        finalMap = joinSourceMaps( module.maps.concat( [
          map,
          map2
        ] ) );
      }

      const args = moduleArgs.slice();
      while ( args.length > 0 && !varsUsed[ args[ args.length - 1 ] ] ) {
        args.pop();
      }

      const key = /^\d/.test( module.hashId ) ? `"${module.hashId}"` : module.hashId;

      build.append( `${first ? "" : ","}\n${key}:function(${args.join( "," )}){` );
      build.append( sourceObj.toString(), finalMap );
      build.append( "\n}" );

      first = false;
    }

    build.append( "});" );

    if ( asset.isEntry ) {
      build.append( await builder.createRuntime( {
        context: builder.context,
        fullPath: asset.path,
        publicPath: builder.publicPath,
        finalAssets,
        usedHelpers
      } ) );
      build.append( `__quase_builder__.r("${entryModule.hashId}");` );
    }

    return {
      data: build.toString(),
      map: build.sourceMap(),
      usedHelpers
    };
  }

}
