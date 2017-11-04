import encoding from "./encoding";

const { SourceMapConsumer, SourceMapGenerator } = require( "source-map" );

function getConsumer( map ) {
  if ( typeof map.generatedPositionFor === "function" ) {
    return map;
  }
  return new SourceMapConsumer( map );
}

export function joinSourceMaps( maps ) {

  maps = maps.filter( Boolean );

  if ( maps.length === 0 ) {
    return null;
  }

  if ( maps.length === 1 ) {
    return Object.assign( {}, maps[ 0 ] );
  }

  const inputMapConsumer = getConsumer( maps[ 0 ] );

  const mergedGenerator = new SourceMapGenerator( {
    file: inputMapConsumer.file,
    sources: inputMapConsumer.sources,
    sourceRoot: inputMapConsumer.sourceRoot,
    sourcesContent: inputMapConsumer.sourcesContent
  } );

  inputMapConsumer.eachMapping( m => {

    let pos = {
      line: m.generatedLine,
      column: m.generatedColumn
    };

    for ( let i = 1; i < maps.length; i++ ) {

      pos = getConsumer( maps[ i ] ).generatedPositionFor( {
        source: inputMapConsumer.file,
        line: pos.line,
        column: pos.column
      } );

      if ( pos.column == null ) {
        return;
      }

    }

    const newMapping = {
      source: null,
      original: null,
      name: m.name,
      generated: pos
    };

    if ( m.source && typeof m.originalLine === "number" && typeof m.originalColumn === "number" ) {
      newMapping.source = m.source;
      newMapping.original = { line: m.originalLine, column: m.originalColumn };
    }

    mergedGenerator.addMapping( newMapping );

  } );

  const map = Object.assign( {}, maps[ 0 ] );
  map.mappings = mergedGenerator.toJSON().mappings;
  return map;
}

export function sourceMapToUrl( map ) {
  if ( !encoding.encode ) {
    throw new Error( "Unsupported environment: `window.btoa` or `Buffer` should be supported." );
  }
  return "data:application/json;charset=utf-8;base64," + encoding.encode( map.toString() );
}

export function sourceMapToString( map ) {
  return JSON.stringify( map );
}

export function getOriginalLocation( map, generated ) { // map, generated: { line, column, bias? }
  return getConsumer( map ).originalPositionFor( generated ); // { source, line, column, name }
}

