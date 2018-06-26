// @flow
import arrayConcat from "../utils/array-concat";
import type {
  Loc, NotResolvedDep, ImportedName, ExportedName, FinalAsset, FinalAssets
} from "../types";
import type Module from "../module";
import Builder from "../builder";
import Language from "../language";
import StringBuilder from "../string-builder";
import babelPluginModules from "./babel-plugin-transform-modules";
import extractNames from "./ast-extract-names";

const path = require( "path" );
const nodeResolve = require( "resolve" );
const babel = require( "@babel/core" );
const generate = require( "@babel/generator" ).default;
const { joinSourceMaps } = require( "@quase/source-map" );

const moduleArgs = "$e,$r,$i,$g,$a".split( "," );

const chunkInit = babel.transformSync(
  `"use strict";( {
    g: typeof self !== "undefined" ? self : Function( "return this" )(),
    p( m ) {
      ( this.g.__quase_builder__ = this.g.__quase_builder__ || { q: [] } ).q.push( m )
    }
  } )`,
  {
    babelrc: false,
    configFile: false,
    minified: true
  }
).code.replace( /;$/, "" );

function getLoc( node ) {
  return node.loc && node.loc.start;
}

export default class JsLanguage extends Language {

  +dataToString: string;
  +ast: ?Object;
  +deps: NotResolvedDep[];
  +_dynamicImports: Object[];
  +_importNames: ImportedName[];
  +_exportNames: ExportedName[];
  _transformCache: ?Object;
  _renderCache: ?Object;

  constructor( options: Object, module: Module, builder: Builder ) {
    super( options, module, builder );

    this.dataToString = this.output.data.toString();
    this.ast = this.output.ast;
    this.deps = [];

    this._dynamicImports = [];
    this._importNames = [];
    this._exportNames = [];

    this._transformCache = null;
    this._renderCache = null;

    const self: any = this;
    self.extractDep = self.extractDep.bind( this );

    this.transform( module );
  }

  addDep( source: { value: string, loc: ?{ start: Loc } }, async: ?boolean ) {
    this.deps.push( {
      request: source.value,
      loc: getLoc( source ),
      async
    } );
  }

  extractDep( node: Object, opts: Object = {} ) {

    if ( opts.require ) {
      this.addDep( node.arguments[ 0 ] );
      return;
    }

    if ( opts.commonjs ) {
      this._exportNames.push( { name: "default", loc: getLoc( node ) } );
      return;
    }

    const { type } = node;

    if ( type === "ImportDeclaration" ) {

      const request = node.source.value;
      this.addDep( node.source );

      node.specifiers.forEach( s => {
        const loc = getLoc( s );
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
            name => ( { name, loc: getLoc( node.declaration ) } )
          )
        );
      } else {
        const request = node.source && node.source.value;
        if ( node.source ) {
          this.addDep( node.source );
        }
        node.specifiers.forEach( s => {
          const loc = getLoc( s );
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

      this._exportNames.push( { name: "default", loc: getLoc( node ) } );

    } else if ( type === "ExportAllDeclaration" ) {

      this.addDep( node.source );

      this._exportNames.push( {
        name: "*",
        imported: "*",
        request: node.source.value,
        loc: getLoc( node )
      } );

    } else if ( type === "CallExpression" ) {

      if ( node.callee.type === "Import" ) {
        const arg = node.arguments[ 0 ];
        if ( arg.type === "StringLiteral" ) {
          this.addDep( arg, true );
          this._dynamicImports.push( {
            isGlob: false,
            name: arg.value,
            loc: getLoc( arg )
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
            loc: getLoc( arg )
          } );
          // TODO test this
        } else {
          // TODO warn that we cannot detect what you are trying to import on Module
          // TODO if it's an identifier, try to get it if it is constant?
          this._dynamicImports.push( {
            warn: true,
            loc: getLoc( arg )
          } );
        }
      }

    }

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

  async dependencies() {
    return {
      dependencies: this.deps,
      importedNames: this._importNames,
      exportedNames: this._exportNames
    };
  }

  transform( module: Module ) {
    if ( this._transformCache ) {
      return this._transformCache;
    }

    const varsUsed = {};
    const imports = [];

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
          extractor: this.extractDep,
          extractModuleSource( stringLiteral ) {
            imports.push( {
              source: stringLiteral.value,
              stringLiteral
            } );
          }
        } ]
      ]
    };

    this._transformCache = this.ast ? babel.transformFromAstSync( this.ast, this.dataToString, opts ) : babel.transformSync( this.dataToString, opts );
    this._transformCache.varsUsed = varsUsed;
    this._transformCache.imports = imports;
    return this._transformCache;
  }

  render( module: Module, builder: Builder ) {
    const { ast, varsUsed, imports } = this.transform( module );
    let regenerate = false;

    for ( const { source, stringLiteral } of imports ) {
      const m = module.getModuleByRequest( builder, source );
      const newSource = m ? m.hashId : source;
      if ( newSource !== stringLiteral.value ) {
        regenerate = true;
        stringLiteral.value = newSource;
      }
    }

    if ( this._renderCache && !regenerate ) {
      return this._renderCache;
    }

    const opts = {
      filename: module.normalized,
      sourceFileName: module.path,
      sourceMaps: !!builder.sourceMaps, // sourceMaps can be "inline", just make sure we pass a boolean to babel
      comments: !builder.optimization.minify,
      minified: builder.optimization.minify
    };

    this._renderCache = generate( ast, opts, this.dataToString );
    this._renderCache.varsUsed = varsUsed;
    return this._renderCache;
  }

  async renderAsset( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets ) {
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
      const lang = module.lang;

      if ( !lang || !( lang instanceof JsLanguage ) ) {
        throw new Error( `Module ${module.id} is not of type 'js'` );
      }

      const { code, map, varsUsed } = lang.render( module, builder );
      const finalMap = module.path === builder.createFakePath( "babel_helpers" ) ? undefined : joinSourceMaps( module.maps.concat( map ) );

      const args = moduleArgs.slice();
      while ( args.length > 0 && !varsUsed[ args[ args.length - 1 ] ] ) {
        args.pop();
      }

      const key = /(^\d|\.|"|')/.test( module.hashId ) ? JSON.stringify( module.hashId ) : module.hashId;

      build.append( `${first ? "" : ","}\n${key}:function(${args.join( "," )}){` );
      build.append( code, finalMap );
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
