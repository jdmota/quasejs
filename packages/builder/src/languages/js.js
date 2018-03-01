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
const { joinSourceMaps } = require( "@quase/source-map" );
const MagicString = require( "magic-string" );

const moduleArgs = "$e,$r,$i,$g,$a".split( "," );

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

function getLoc( node ) {
  return node.loc && node.loc.start;
}

export default class JsLanguage extends Language {

  static TYPE = "js";

  +dataToString: string;
  +ast: ?Object;
  +deps: NotResolvedDep[];
  lastRender: ?Object;
  +_dynamicImports: Object[];
  +_importNames: ImportedName[];
  +_exportNames: ExportedName[];

  constructor( options: Object, module: Module, builder: Builder ) {
    super( options, module, builder );

    this.dataToString = module.data.toString();
    this.ast = module.ast;
    this.deps = [];

    this.lastRender = null;
    this._dynamicImports = [];
    this._importNames = [];
    this._exportNames = [];

    const self: any = this;
    self.extractDep = self.extractDep.bind( this );

    this.render( module, builder );
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

  async moreLanguages() {
    return [];
  }

  async dependencies() {
    return {
      dependencies: this.deps,
      importedNames: this._importNames,
      exportedNames: this._exportNames
    };
  }

  render( module: Module, builder: Builder ) {
    if ( this.lastRender ) {
      return this.lastRender;
    }

    const varsUsed = {};
    const imports = [];

    const opts = {
      babelrc: false,
      parserOpts: {
        sourceType: "module"
      },
      filename: module.normalized,
      filenameRelative: module.path,
      sourceMaps: !!builder.sourceMaps, // sourceMaps can be "inline", just make sure we pass a boolean to babel
      plugins: [
        [ babelPluginModules, {
          varsUsed,
          extractor: this.extractDep,
          resolveModuleSource( source ) {
            const key = `__quase_builder_import_${source}__`;
            imports.push( { source, key } );
            return key;
          }
        } ]
      ]
    };

    this.lastRender = this.ast ? babel.transformFromAst( this.ast, this.dataToString, opts ) : babel.transform( this.dataToString, opts );
    this.lastRender.varsUsed = varsUsed;
    this.lastRender.imports = imports;
    return this.lastRender;
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

      const { code, map, varsUsed, imports } = lang.render( module, builder );
      let finalCode, finalMap;

      if ( imports.length ) {

        // FIXME this might take too long for some code (all babel helpers, for example)

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

        if ( map ) {
          const map2 = sourceObj.generateMap( {
            hires: true
          } );
          map2.sources[ 0 ] = module.path;

          finalMap = joinSourceMaps( module.maps.concat( map, map2 ) );
        }

        finalCode = sourceObj.toString();

      } else {
        if ( map && module.path !== builder.createFakePath( "babel_helpers" ) ) {
          finalMap = joinSourceMaps( module.maps.concat( map ) );
        }
        finalCode = code;
      }

      const args = moduleArgs.slice();
      while ( args.length > 0 && !varsUsed[ args[ args.length - 1 ] ] ) {
        args.pop();
      }

      const key = /^\d/.test( module.hashId ) ? `"${module.hashId}"` : module.hashId;

      build.append( `${first ? "" : ","}\n${key}:function(${args.join( "," )}){` );
      build.append( finalCode, finalMap );
      build.append( "\n}" );

      first = false;
    }

    build.append( "});" );

    if ( asset.isEntry ) {
      build.append( await builder.createRuntime( {
        context: builder.context,
        fullPath: asset.path,
        publicPath: builder.publicPath,
        finalAssets
      } ) );
      build.append( `__quase_builder__.r("${entryModule.hashId}");` );
    }

    return {
      data: build.toString(),
      map: build.sourceMap()
    };
  }

}
