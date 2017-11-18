import _processGraph from "../src/graph";

const path = require( "path" );

function processGraph( builder ) {
  builder.dest = path.resolve( "dest" );
  builder.context = path.resolve( "context" );
  const obj = _processGraph( builder );
  for ( const m of obj.modules ) {
    m.dest = path.relative( process.cwd(), m.dest ).replace( /\\+/g, "/" );
  }
  return obj;
}

describe( "graph", () => {

  it( "empty", () => {

    const builder = {
      idEntries: [],
      modules: new Map()
    };

    expect( processGraph( builder ) ).toMatchSnapshot();

  } );

  it( "cycle", () => {

    const modules = new Map();

    const builder = {
      idEntries: [ "context/entry.js" ],
      modules
    };

    modules.set( "context/entry.js", {
      deps: [
        {
          resolved: "context/A.js"
        },
        {
          resolved: "context/B.js"
        }
      ]
    } );

    modules.set( "context/A.js", {
      deps: [
        {
          resolved: "context/B.js"
        }
      ]
    } );

    modules.set( "context/B.js", {
      deps: [
        {
          resolved: "context/A.js"
        }
      ]
    } );

    expect( processGraph( builder ) ).toMatchSnapshot();

  } );

  it( "cycle split", () => {

    const modules = new Map();

    const builder = {
      idEntries: [ "context/entry.js" ],
      modules
    };

    modules.set( "context/entry.js", {
      deps: [
        {
          resolved: "context/A.js"
        },
        {
          resolved: "context/B.js"
        }
      ]
    } );

    modules.set( "context/A.js", {
      deps: [
        {
          resolved: "context/B.js",
          splitPoint: true
        }
      ]
    } );

    modules.set( "context/B.js", {
      deps: [
        {
          resolved: "context/A.js",
          splitPoint: true
        }
      ]
    } );

    expect( processGraph( builder ) ).toMatchSnapshot();

  } );

  it( "split points", () => {

    const modules = new Map();

    const builder = {
      idEntries: [ "context/entry.js" ],
      modules
    };

    modules.set( "context/entry.js", {
      deps: [
        {
          resolved: "context/A.js"
        }
      ]
    } );

    modules.set( "context/A.js", {
      deps: [
        {
          resolved: "context/B.js",
          splitPoint: true
        }
      ]
    } );

    modules.set( "context/B.js", {
      deps: [
        {
          resolved: "context/A.js",
        }
      ]
    } );

    expect( processGraph( builder ) ).toMatchSnapshot();

  } );

} );
