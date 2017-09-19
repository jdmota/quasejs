import arrayConcat from "../../_helper/arrayConcat";
import { joinSourceMaps } from "../../source-map/src";
import astExtractNames from "./utils/ast-extract-names";
import cloneAst from "./utils/clone-ast";
import babelBuildHelpers from "./babel-helpers";
import babelPluginModules from "./babel-plugin-transform-modules";
import StringBuilder from "./string-builder";

// Ref https://github.com/babel/babylon/blob/master/ast/spec.md#imports

const path = require( "path" );
const { parse } = require( "babylon" );
const babel = require( "babel-core" );
const types = require( "babel-types" );

const runtimeCode = `
"use strict";(function(a,b){function c(){return Object.create(s)}function f(I,J){var K=y?J:a[H[I]];return D[I]=K&&K.__esModule?K:{default:K}}function g(I,J,K){Object.defineProperty(I,J,{enumerable:!0,get:K})}function h(I,J){Object.keys(J).forEach(function(K){"default"===K||"__esModule"===K||Object.defineProperty(I,K,{configurable:!0,enumerable:!0,get:function get(){return J[K]}})})}function i(I){if(B[I])return B[I];var J=C[I];if(C[I]=s,J){var K={};return Object.defineProperty(K,"__esModule",{value:!0}),B[I]=K,J(K,l,p,x,g,h),K}throw new Error(\`Module \${I} not found\`)}function l(I){return C[I]===r&&m(G[I]),i(I)}function m(I){return E[I]===r&&(y?E[I]=b(I):u!==r&&(u(I),E[I]=s)),E[I]}function p(I){return C[I]===r?q(G[I]).then(function(){return i(I)}):w.then(function(){return i(I)})}function q(I){function J(P){clearTimeout(O),N.onerror=N.onload=r,L[P?1:0](P)}function K(){J(new Error(\`Fetching \${I} failed\`))}if(E[I]!==r)return t.resolve(E[I]);if(F[I])return F[I];var L=[r,r],M=new t(function(P,Q){L[0]=function(R){F[I]=r,P(E[I]=y?R:s)},L[1]=function(R){F[I]=r,Q(R)}});if(F[I]=M,!A)return w.then(function(){return y?b(I):u(I)}).then(L[0],L[1]),M;var N=v.createElement("script");N.type="text/javascript",N.charset="utf-8",N.async=!0,N.timeout=1.2e5,N.src=I;var O=setTimeout(K,1.2e5);return N.onload=J,N.onerror=K,v.head.appendChild(N),M}var r,s=null,t=a.Promise,u=a.importScripts,v=a.document,w=t.resolve(),x={__BABEL_HELPERS__:1},y=b!==r,A=a.window===a,B=c(),C=c(),D=c(),E=c(),F=c(),G={__ID_TO_FILE_HERE__:1},H={__ID_TO_GLOBAL_HERE__:1};l.e=function(I){return D[I]?D[I]:f(I,m(I))},l.i=function(I){return D[I]?t.resolve(D[I]):q(I).then(function(J){return f(I,J)})},a.__quase_builder__={r:l,a:function(I){for(var J in I)C[J]===r&&(C[J]=I[J])}}})("undefined"==typeof self?Function("return this")():self,"undefined"!=typeof require&&require);
`.trim();

const runtimeReplace = {
  babel: "{__BABEL_HELPERS__:1}",
  idToFile: "{__ID_TO_FILE_HERE__:1}",
  idToGlobal: "{__ID_TO_GLOBAL_HERE__:1}"
};

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

function getDependencies( bundle, entry ) {

  const ordered = [];
  const seen = {};

  const visit = module => {
    if ( seen[ module.id ] ) {
      return;
    }

    seen[ module.id ] = true;

    module.forEachDependency( visit );
    ordered.push( module );
  };

  visit( bundle.modules.get( entry ) );

  return ordered;
}

// From https://github.com/babel/babel/blob/master/packages/babel-plugin-external-helpers/src/index.js
function helpersPlugin( ref ) {
  return {
    pre( file ) {
      file.set( "helpersNamespace", ref.types.identifier( "$b" ) );
    }
  };
}

const internalPlugins = [ helpersPlugin, babelPluginModules ];

const defaultParserOpts = {
  sourceType: "module",
  plugins: [
    "asyncGenerators",
    "classProperties",
    "doExpressions",
    "dynamicImport",
    "exportExtensions",
    "flow",
    "functionBind",
    "functionSent",
    "jsx",
    "objectRestSpread"
  ]
};

export default function() {

  let sourceMaps = true;
  let babelOpts = null;
  let parserOpts = null;

  function renderModule( module ) {

    const opts = Object.assign( {}, babelOpts, {
      filename: module.id,
      sourceRoot: path.dirname( module.id ),
      sourceMaps: !!sourceMaps, // sourceMaps can be "inline", just make sure we pass a boolean to babel
      resolveModuleSource( source ) {
        const m = module.getModuleBySource( source );
        return m ? m.uuid : source;
      }
    } );

    opts.plugins = ( opts.plugins || [] ).concat( internalPlugins );

    return babel.transformFromAst( cloneAst( module.ast ), module.code, opts );
  }

  return {
    options( opts ) {
      sourceMaps = opts.sourceMaps;
      babelOpts = Object.assign( { parserOpts: defaultParserOpts }, opts.babelOpts );
      parserOpts = Object.assign( {}, babelOpts.parserOpts );
      parserOpts.plugins = parserOpts.plugins || [];
      parserOpts.sourceType = parserOpts.sourceType || "module";
    },
    parse( code ) {
      return parse( code, parserOpts );
    },
    getDeps( { ast } ) {

      const program = ast.program;
      const sources = [];
      const exportAllSources = [];
      const importSources = new Map();
      const exportSources = new Map();
      const importNames = [];
      const exportNames = [];
      const dynamicImports = [];

      function addSource( source ) {
        push( sources, { name: source.value, loc: source.loc.start } );
        return source.value;
      }

      function mapper1( s ) {
        const loc = s.loc.start;
        importNames.push( { name: s.local.name, loc } );
        if ( s.type === "ImportDefaultSpecifier" ) {
          return { name: "default", loc };
        }
        if ( s.type === "ImportNamespaceSpecifier" ) {
          return { name: "*", loc };
        }
        return { name: s.imported.name, loc };
      }

      function mapper2( s ) {
        const loc = s.loc.start;
        exportNames.push( { name: s.exported.name, loc } );
        if ( s.type === "ExportDefaultSpecifier" ) { // https://github.com/leebyron/ecmascript-export-default-from
          return { name: "default", loc };
        }
        if ( s.type === "ExportNamespaceSpecifier" ) { // https://github.com/leebyron/ecmascript-export-ns-from
          return { name: "*", loc };
        }
        return { name: s.local.name, loc };
      }

      const t = parserOpts.allowImportExportEverywhere || parserOpts.plugins.indexOf( "dynamicImport" ) > -1 ? traverse : traverseTopLevel;

      t( program, node => {

        const type = node.type;

        if ( type === "ImportDeclaration" ) {

          add(
            importSources,
            addSource( node.source ),
            node.specifiers.map( mapper1 )
          );

        } else if ( type === "ExportNamedDeclaration" ) {

          if ( node.declaration ) {
            arrayConcat( exportNames, astExtractNames( node.declaration ).map( name => ( { name, loc: node.declaration.loc.start } ) ) );
          } else {
            add(
              exportSources,
              node.source && addSource( node.source ),
              node.specifiers.map( mapper2 )
            );
          }

        } else if ( type === "ExportDefaultDeclaration" ) {

          exportNames.push( { name: "default", loc: node.loc.start } );

        } else if ( type === "ExportAllDeclaration" ) {

          addSource( node.source );
          push( exportAllSources, { name: node.source.value, loc: node.loc.start } );

        } else if ( type === "CallExpression" ) {

          if ( node.callee.type === "Import" ) {
            const arg = node.arguments[ 0 ];
            if ( arg.type === "StringLiteral" ) {
              push( dynamicImports, { isGlob: false, name: arg.value, loc: arg.loc.start } );
            } else if ( arg.type === "TemplateLiteral" ) {
              let glob = "";
              for ( const quasi of arg.quasis ) {
                glob += quasi.value.cooked + "*";
              }
              glob = glob.slice( 0, -1 ).replace( /\/\*\//g, "/?*/" );
              push( dynamicImports, { isGlob: arg.quasis.length > 1, name: glob, loc: arg.loc.start } );
              // TODO test this
            } else {
              // TODO warn that we cannot detect what you are trying to import on Module
              // TODO if it's an identifier, try to get it if it is constant?
              push( dynamicImports, { warn: true, loc: arg.loc.start } );
            }
          }

        } else {

          return true;

        }

      } );

      return {
        dynamicImports,
        sources,
        exportAllSources,
        importSources,
        exportSources,
        importNames,
        exportNames
      };
    },
    render( bundle ) {

      // TODO handle common dependencies

      const entries = bundle.entries;
      const out = [];

      for ( let i = 0; i < entries.length; i++ ) {

        const usedHelpers = {};
        const [ entry, dest ] = entries[ i ];

        const build = new StringBuilder( {
          sourceMap: sourceMaps,
          cwd: bundle.cwd,
          file: path.basename( dest )
        } );

        const modules = getDependencies( bundle, entry );

        modules.forEach( ( m, i ) => {
          m.uuid = "_" + i.toString( 16 );
        } );

        modules.forEach( m => {
          m._render = renderModule( m );
          m._render.metadata.usedHelpers.forEach( h => { usedHelpers[ h ] = true; } );
        } );

        build.append(
          runtimeCode.replace( runtimeReplace.babel, babelBuildHelpers( Object.keys( usedHelpers ) ) )
            .replace( runtimeReplace.idToFile, "{}" )
            .replace( runtimeReplace.idToGlobal, "{}" )
        );
        build.append( "__quase_builder__.a({" );

        for ( let i = 0; i < modules.length; i++ ) {

          const module = modules[ i ];

          // TODO if treeshake is off, we can reuse module._render

          let { code, map } = module._render;
          module._render = null;

          if ( sourceMaps ) {
            map = joinSourceMaps( [ module.finalMap, map ] );
          }

          build.append( `\n${module.uuid}:function($e,$r,$i,$b,$g,$a){` );
          build.append( code, map );
          build.append( i === modules.length - 1 ? "\n}" : "\n}," );

        }

        build.append( `});__quase_builder__.r('${bundle.modules.get( entry ).uuid}');` );

        out.push( {
          dest,
          code: build.toString(),
          map: build.sourceMap()
        } );

      }

      return out;

    }
  };
}
