import JsLanguage from "./languages/js";
import HtmlLanguage from "./languages/html";
import Reporter from "./reporter";
import { check } from "./checker";
import { resolvePath } from "./id";

const { ValidationError } = require( "@quase/config-validate" );
const { getPlugins, getOnePlugin } = require( "@quase/get-plugins" );
const fs = require( "fs-extra" );
const path = require( "path" );

export default function( _opts ) {

  const options = Object.assign( {}, _opts );

  if ( !Array.isArray( options.entries ) || options.entries.length === 0 ) {
    throw new ValidationError( "Missing entries." );
  }

  if ( typeof options.context !== "string" ) {
    throw new ValidationError( "Missing context option." );
  }

  if ( typeof options.dest !== "string" ) {
    throw new ValidationError( "Missing dest option." );
  }

  options.cwd = typeof options.cwd === "string" ? path.resolve( options.cwd ) : process.cwd();
  options.context = resolvePath( options.context, options.cwd );
  options.dest = resolvePath( options.dest, options.cwd );

  options.publicPath = ( options.publicPath || "/" ).replace( /\/+$/, "" ) + "/";

  options.isExternal = options.isExternal || ( () => {} );
  options.isSplitPoint = options.isSplitPoint || ( () => {} );

  options.loaderAlias = options.loaderAlias || {};
  options.buildDefaultQuery = options.buildDefaultQuery || ( () => {} );

  options.fs = options.fs || fs;

  options.sourceMaps = options.sourceMaps === "inline" ? options.sourceMaps : !!options.sourceMaps;
  options.hashing = !!options.hashing;
  options.warn = options.warn || ( () => {} );

  options.cli = options.cli || {};

  options.watch = !!options.watch;
  options.watchOptions = Object.assign( {}, options.watchOptions );

  options.reporter = options.reporter ? getOnePlugin( options.reporter ) : Reporter;

  options.languages = getPlugins( options.languages || [] );
  options.languages.unshift( { plugin: JsLanguage, options: {} } );
  options.languages.unshift( { plugin: HtmlLanguage, options: {} } );
  options.languages.forEach( ( { plugin, name } ) => {
    if ( typeof plugin !== "function" ) {
      throw new ValidationError( `Expected language ${name ? name + " " : ""}to be a function` );
    }
  } );

  options.checkers = getPlugins( options.checkers || [] );
  options.checkers.unshift( { plugin: check, options: {} } );
  options.checkers.forEach( ( { plugin, name } ) => {
    if ( typeof plugin !== "function" ) {
      throw new ValidationError( `Expected checker ${name ? name + " " : ""}to be a function` );
    }
  } );

  options.graphTransformers = getPlugins( options.graphTransformers || [] );
  options.graphTransformers.forEach( ( { plugin, name } ) => {
    if ( typeof plugin !== "function" ) {
      throw new ValidationError( `Expected graph transformer ${name ? name + " " : ""}to be a function` );
    }
  } );

  options.afterBuild = getPlugins( options.afterBuild || [] );
  options.afterBuild.forEach( ( { plugin, name } ) => {
    if ( typeof plugin !== "function" ) {
      throw new ValidationError( `Expected after build plugin ${name ? name + " " : ""}to be a function` );
    }
  } );

  options.performance = Object.assign( {
    hints: "warning",
    maxEntrypointSize: 250000,
    maxAssetSize: 250000,
    assetFilter( f ) {
      return !( /\.map$/.test( f ) );
    }
  }, options.performance );

  if ( options.performance.hints === true ) {
    options.performance.hints = "warning";
  }

  options.serviceWorker = Object.assign( {
    staticFileGlobs: [],
    stripPrefixMulti: {}
  }, options.serviceWorker );

  options.cleanBeforeBuild = !!options.cleanBeforeBuild;

  return options;
}
