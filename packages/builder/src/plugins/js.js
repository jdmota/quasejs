import arrayConcat from "../../../_helper/arrayConcat";
import { joinSourceMaps } from "../../../source-map/src";
import blank from "../utils/blank";
import error from "../utils/error";
import isEmpty from "../utils/is-empty";
import StringBuilder from "../string-builder";
import babelBuildHelpers from "./babel-helpers";
import babelPluginModules from "./babel-plugin-transform-modules";
import extractNames from "./ast-extract-names";

const { parse } = require( "babylon" );
const babel = require( "babel-core" );
const types = require( "babel-types" );
const path = require( "path" );
const nodeResolve = require( "resolve" );

function push( array, obj ) {
  if ( !array.find( ( { name } ) => name === obj.name ) ) {
    array.push( obj );
  }
}

function add( map, source, array ) {
  if ( source ) {
    const currentArray = map.get( source ) || [];
    array.forEach( v => push( currentArray, v ) );
    map.set( source, currentArray );
  }
}

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

function resolveId( importee, importer, resolveOpts, fileSystem ) {
  const { extensions, pathFilter, paths, moduleDirectory } = resolveOpts;
  const opts = {
    basedir: path.dirname( importer ),
    package: resolveOpts.package,
    extensions,
    async readFile( file, cb ) {
      try {
        cb( null, await fileSystem.getFileBuffer( file ) );
      } catch ( err ) {
        cb( err );
      }
    },
    async isFile( file, cb ) {
      try {
        cb( null, await fileSystem.isFile( file ) );
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

const INTERNAL = "__builderJsLoader";

class JsModule {

  constructor( id, ast, parserOpts ) {
    this.id = id;
    this.ast = ast;
    this.builder = null; // Fill!
    this.lastRender = null;

    this.sources = [];
    this.dynamicImports = [];
    // type Name = { name: string, loc: { line: number, column: number } }
    this.exportAllSources = []; // Name[]
    this.importSources = new Map(); // source: string -> Name[] (to check if a source exports these names)
    this.exportSources = new Map(); // source: string -> Name[] (to check if a source exports these names)
    this.importNames = []; // Name[] (imported names)
    this.exportNames = []; // Name[] (exported names, except the ones from exportAllSources)

    this._imports = null;
    this._exports = null;

    this.getDeps( parserOpts );
  }

  getMaps() {
    const m = this.builder.getModule( this.id );
    return m.outputs.map( o => o.map ).filter( Boolean );
  }

  getCode() {
    return this.builder.getModule( this.id ).code;
  }

  error( message, loc ) {
    error( message, {
      id: this.builder.idToString( this.id ),
      code: this.getCode(),
      map: joinSourceMaps( this.getMaps() )
    }, loc );
  }

  getDeps( parserOpts ) {

    const program = this.ast.program;

    const addSource = source => {
      push( this.sources, { src: source.value, name: source.value, loc: source.loc.start } );
      return source.value;
    };

    const mapper1 = s => {
      const loc = s.loc.start;
      this.importNames.push( { name: s.local.name, loc } );
      if ( s.type === "ImportDefaultSpecifier" ) {
        return { name: "default", loc };
      }
      if ( s.type === "ImportNamespaceSpecifier" ) {
        return { name: "*", loc };
      }
      return { name: s.imported.name, loc };
    };

    const mapper2 = s => {
      const loc = s.loc.start;
      this.exportNames.push( { name: s.exported.name, loc } );
      if ( s.type === "ExportDefaultSpecifier" ) { // https://github.com/leebyron/ecmascript-export-default-from
        return { name: "default", loc };
      }
      if ( s.type === "ExportNamespaceSpecifier" ) { // https://github.com/leebyron/ecmascript-export-ns-from
        return { name: "*", loc };
      }
      return { name: s.local.name, loc };
    };

    const t = parserOpts.allowImportExportEverywhere || parserOpts.plugins.indexOf( "dynamicImport" ) > -1 ? traverse : traverseTopLevel;

    t( program, node => {

      const type = node.type;

      if ( type === "ImportDeclaration" ) {

        add(
          this.importSources,
          addSource( node.source ),
          node.specifiers.map( mapper1 )
        );

      } else if ( type === "ExportNamedDeclaration" ) {

        if ( node.declaration ) {
          arrayConcat( this.exportNames, extractNames( node.declaration ).map( name => ( { name, loc: node.declaration.loc.start } ) ) );
        } else {
          add(
            this.exportSources,
            node.source && addSource( node.source ),
            node.specifiers.map( mapper2 )
          );
        }

      } else if ( type === "ExportDefaultDeclaration" ) {

        this.exportNames.push( { name: "default", loc: node.loc.start } );

      } else if ( type === "ExportAllDeclaration" ) {

        addSource( node.source );
        push( this.exportAllSources, { name: node.source.value, loc: node.loc.start } );

      } else if ( type === "CallExpression" ) {

        if ( node.callee.type === "Import" ) {
          const arg = node.arguments[ 0 ];
          if ( arg.type === "StringLiteral" ) {
            push( this.dynamicImports, { isGlob: false, name: arg.value, loc: arg.loc.start } );
          } else if ( arg.type === "TemplateLiteral" ) {
            let glob = "";
            for ( const quasi of arg.quasis ) {
              glob += quasi.value.cooked + "*";
            }
            glob = glob.slice( 0, -1 ).replace( /\/\*\//g, "/?*/" );
            push( this.dynamicImports, { isGlob: arg.quasis.length > 1, name: glob, loc: arg.loc.start } );
            // TODO test this
          } else {
            // TODO warn that we cannot detect what you are trying to import on Module
            // TODO if it's an identifier, try to get it if it is constant?
            push( this.dynamicImports, { warn: true, loc: arg.loc.start } );
          }
        }

      } else {

        return true;

      }

    } );
  }

  getModuleBySource( source ) {
    const dep = this.builder.getModule( this.id ).sourceToResolved.get( source );
    const module = dep && this.builder.getModule( dep.resolved );
    const internal = module && module.getLastOutput()[ INTERNAL ];
    if ( internal ) {
      return internal;
    }
    this.error(
      `No information about the imports/exports of '${source}' were found. It might not be a JavaScript file.`,
      dep && dep.loc
    );
  }

  getImports() {
    if ( !this._imports ) {
      const imports = blank();
      this.importNames.forEach( ( { name, loc } ) => {
        if ( imports[ name ] ) {
          this.error( `Duplicate import ${name}`, loc );
        }
        imports[ name ] = true;
      } );
      this._imports = imports;
    }
    return this._imports;
  }

  getExports( stack = new Map() ) {
    if ( this._exports ) {
      return this._exports;
    }

    const exports = blank();
    const exportsAllFrom = blank();
    let namespaceConflict = false;

    const checkExport = ( { name, loc } ) => {
      if ( exports[ name ] ) {
        this.error( `Duplicate export ${name}`, loc );
      }
      exports[ name ] = true;
    };

    const checkExportFrom = ( name, fromId ) => {
      const text = `${fromId.name} (${fromId.loc.line}:${fromId.loc.column})`;
      if ( exportsAllFrom[ name ] ) {
        exportsAllFrom[ name ].push( text );
      } else {
        exportsAllFrom[ name ] = [ text ];
      }
      if ( exports[ name ] ) {
        namespaceConflict = true;
      }
      exports[ name ] = true;
    };

    this.exportNames.forEach( checkExport );

    stack.set( this, true );

    this.exportAllSources.forEach( source => {

      const module = this.getModuleBySource( source.name );

      if ( stack.has( module ) ) {
        const trace = Array.from( stack ).map( entry => entry[ 0 ].id );
        while ( trace[ 0 ] !== module.id ) {
          trace.shift();
        }
        const traceStr = trace.map( id => this.builder.idToString( id ) ).join( "->" ) + "->" + this.builder.idToString( module.id );
        error( `Circular 'export * from "";' declarations. ${traceStr}` );
      }

      const e = module.getExports( stack );

      for ( const name in e ) {
        if ( name !== "default" ) {
          checkExportFrom( name, source );
        }
      }

    } );

    stack.delete( this );

    if ( namespaceConflict ) {
      for ( const name in exportsAllFrom ) {
        this.builder.warn( `Re-exports '${name}' from ${exportsAllFrom[ name ].join( " and " )}. See ${this.builder.idToString( this.id )}` );
      }
    }

    this._exports = exports;
    return exports;
  }

  checkImportsExports() {
    this.getImports();
    this.getExports();
    const check = ( names, source ) => {
      const exports = this.getModuleBySource( source ).getExports();
      if ( names.length > 0 && isEmpty( exports ) ) {
        this.error( `${source} exports nothing`, names[ 0 ].loc );
      }
      names.forEach( ( { name, loc } ) => {
        if ( name !== "*" && !exports[ name ] ) {
          this.error( `${source} doesn't export ${name}`, loc );
        }
      } );
    };
    this.importSources.forEach( check );
    this.exportSources.forEach( check );
    this.exportAllSources.forEach( ( { name, loc } ) => {
      const exports = this.getModuleBySource( name ).getExports();
      if ( isEmpty( exports ) ) {
        this.error( `${name} exports nothing`, loc );
      }
    } );
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

export function plugin( parserOpts ) {
  return async( { code, ast }, id ) => {
    const opts = Object.assign( {}, parserOpts );
    opts.plugins = opts.plugins || defaultParserOpts.plugins;
    opts.sourceType = opts.sourceType || defaultParserOpts.sourceType;

    const js = new JsModule( id, ast || parse( code, opts ), opts );

    return {
      code,
      deps: js.sources,
      [ INTERNAL ]: js
    };
  };
}

export function resolver( opts ) {
  return ( { src }, id, builder ) => {
    return resolveId( src, id, opts || {}, builder.fileSystem );
  };
}

export function checker() {
  return builder => {
    for ( const [ , module ] of builder.modules ) {
      const js = module.getLastOutput()[ INTERNAL ];
      if ( js ) {
        js.builder = builder;
      }
    }
    for ( const [ , module ] of builder.modules ) {
      const js = module.getLastOutput()[ INTERNAL ];
      if ( js ) {
        js.checkImportsExports();
      }
    }
  };
}

const runtimeCode = `
"use strict";(function(a,b){function c(){return Object.create(s)}function f(I,J){var K=y?J:a[H[I]];return D[I]=K&&K.__esModule?K:{default:K}}function g(I,J,K){Object.defineProperty(I,J,{enumerable:!0,get:K})}function h(I,J){Object.keys(J).forEach(function(K){"default"===K||"__esModule"===K||Object.defineProperty(I,K,{configurable:!0,enumerable:!0,get:function get(){return J[K]}})})}function i(I){if(B[I])return B[I];var J=C[I];if(C[I]=s,J){var K={};return Object.defineProperty(K,"__esModule",{value:!0}),B[I]=K,J(K,l,p,x,g,h),K}throw new Error(\`Module \${I} not found\`)}function l(I){return C[I]===r&&m(G[I]),i(I)}function m(I){return E[I]===r&&(y?E[I]=b(I):u!==r&&(u(I),E[I]=s)),E[I]}function p(I){return C[I]===r?q(G[I]).then(function(){return i(I)}):w.then(function(){return i(I)})}function q(I){function J(P){clearTimeout(O),N.onerror=N.onload=r,L[P?1:0](P)}function K(){J(new Error(\`Fetching \${I} failed\`))}if(E[I]!==r)return t.resolve(E[I]);if(F[I])return F[I];var L=[r,r],M=new t(function(P,Q){L[0]=function(R){F[I]=r,P(E[I]=y?R:s)},L[1]=function(R){F[I]=r,Q(R)}});if(F[I]=M,!A)return w.then(function(){return y?b(I):u(I)}).then(L[0],L[1]),M;var N=v.createElement("script");N.type="text/javascript",N.charset="utf-8",N.async=!0,N.timeout=1.2e5,N.src=I;var O=setTimeout(K,1.2e5);return N.onload=J,N.onerror=K,v.head.appendChild(N),M}var r,s=null,t=a.Promise,u=a.importScripts,v=a.document,w=t.resolve(),x={__BABEL_HELPERS__:1},y=b!==r,A=a.window===a,B=c(),C=c(),D=c(),E=c(),F=c(),G={__ID_TO_FILE_HERE__:1},H={__ID_TO_GLOBAL_HERE__:1};l.e=function(I){return D[I]?D[I]:f(I,m(I))},l.i=function(I){return D[I]?t.resolve(D[I]):q(I).then(function(J){return f(I,J)})},a.__quase_builder__={r:l,a:function(I){for(var J in I)C[J]===r&&(C[J]=I[J])}}})("undefined"==typeof self?Function("return this")():self,"undefined"!=typeof require&&require);
`.trim();

const runtimeReplace = {
  babel: "{__BABEL_HELPERS__:1}",
  idToFile: "{__ID_TO_FILE_HERE__:1}",
  idToGlobal: "{__ID_TO_GLOBAL_HERE__:1}"
};

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

function renderModule( jsModule, builder, babelOpts ) {

  if ( jsModule.lastRender ) {
    return jsModule.lastRender;
  }

  const opts = Object.assign( {}, babelOpts, {
    filename: jsModule.id,
    sourceRoot: path.dirname( jsModule.id ),
    sourceMaps: !!builder.sourceMaps // sourceMaps can be "inline", just make sure we pass a boolean to babel
  } );

  const helpers = {};
  const varsUsed = {};

  opts.plugins = ( opts.plugins || [] ).concat( [
    [ helpersPlugin, { helpers } ],
    [ babelPluginModules, {
      varsUsed,
      resolveModuleSource( source ) {
        const m = jsModule.getModuleBySource( source );
        return m ? m._uuid : source;
      }
    } ]
  ] );

  jsModule.lastRender = babel.transformFromAst( jsModule.ast, jsModule.getCode(), opts );
  jsModule.lastRender.helpers = helpers;
  jsModule.lastRender.varsUsed = varsUsed;
  return jsModule.lastRender;
}

const moduleArgs = "$e,$r,$i,$b,$g,$a".split( "," );

export function renderer( babelOpts ) {
  return ( builder, finalModules ) => {

    const out = [];

    for ( const finalModule of finalModules ) {
      if ( finalModule.built ) {
        continue;
      }
      finalModule.built = true;

      const { id, srcs, dest } = finalModule;
      const jsModules = [];
      const usedHelpers = {};
      let entryUUID = "";

      const build = new StringBuilder( {
        sourceMap: builder.sourceMaps,
        cwd: builder.cwd,
        file: path.basename( dest )
      } );

      let moduleIdx = 0;
      for ( const src of srcs ) {

        const jsModule = builder.getModule( src ).getLastOutput()[ INTERNAL ];
        jsModule._uuid = "_" + moduleIdx.toString( 16 );

        if ( id === src ) {
          entryUUID = jsModule._uuid;
        }

        jsModules.push( jsModule );
        moduleIdx++;
      }

      for ( const jsModule of jsModules ) {
        const helpers = renderModule( jsModule, builder, babelOpts ).helpers;
        for ( const name in helpers ) {
          usedHelpers[ name ] = true;
        }
      }

      build.append(
        runtimeCode.replace( runtimeReplace.babel, babelBuildHelpers( usedHelpers ) )
          .replace( runtimeReplace.idToFile, "{}" )
          .replace( runtimeReplace.idToGlobal, "{}" )
      );

      build.append( "__quase_builder__.a({" );

      moduleIdx = 0;
      for ( const jsModule of jsModules ) {

        let { code, map } = jsModule.lastRender;

        if ( map ) {
          map = joinSourceMaps( jsModule.getMaps().concat( map ) );
        }

        const args = moduleArgs.slice();
        while ( args.length > 0 && !jsModule.lastRender.varsUsed[ args[ args.length - 1 ] ] ) {
          args.pop();
        }

        build.append( `\n${jsModule._uuid}:function(${args}){` );
        build.append( code, map );
        build.append( moduleIdx === jsModules.length - 1 ? "\n}" : "\n}," );

        moduleIdx++;
      }

      build.append( `});__quase_builder__.r('${entryUUID}');` );

      out.push( {
        dest,
        code: build.toString(),
        map: build.sourceMap()
      } );

    }

    return out;
  };
}
