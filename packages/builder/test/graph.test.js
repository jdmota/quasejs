import { hashName } from "../src/utils/hash";
import createRuntime from "../src/runtime/create-runtime";
import processGraph from "../src/graph";

async function createGraphAndRuntime( builder ) {
  builder.moduleEntries = new Set( builder.entries.map( e => builder.getModule( e ) ) );
  const finalAssets = processGraph( builder );
  finalAssets.runtime = await createRuntime( { finalAssets, usedHelpers: new Set(), minify: false } );
  return finalAssets;
}

function createDummyModule( builder, id, deps ) {
  const normalized = id.replace( "context/", "" );
  const m = {
    builder,
    id,
    normalized,
    isEntry: builder.entries.includes( id ),
    dest: id.replace( "context/", "dest/" ),
    hashId: hashName( normalized, builder.usedIds, 5 ),
    deps,
    moduleDeps: ( deps || [] ).map( ( { path, splitPoint, async } ) => ( {
      path,
      splitPoint,
      async,
      requiredId: path
    } ) )
  };
  builder.modules.set( id, m );
  return m;
}

function createDummyBuilder( entries ) {
  return {
    entries,
    modules: new Map(),
    moduleEntries: null,
    usedIds: new Set(),
    getModuleForSure( id ) {
      return this.modules.get( id );
    },
    getModule( id ) {
      return this.modules.get( id );
    },
    createModule( id, deps ) {
      return createDummyModule( this, id, deps );
    }
  };
}

describe( "graph", () => {

  it( "empty", async() => {

    const builder = createDummyBuilder( [] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "cycle", async() => {

    const builder = createDummyBuilder( [ "context/entry.js" ] );

    builder.createModule( "context/entry.js", [
      {
        path: "context/A.js"
      },
      {
        path: "context/B.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        path: "context/B.js"
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        path: "context/A.js"
      }
    ] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "cycle split", async() => {

    const builder = createDummyBuilder( [ "context/entry.js" ] );

    builder.createModule( "context/entry.js", [
      {
        path: "context/A.js"
      },
      {
        path: "context/B.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        path: "context/B.js",
        splitPoint: true
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        path: "context/A.js",
        splitPoint: true
      }
    ] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "split points", async() => {

    const builder = createDummyBuilder( [ "context/entry.html" ] );

    builder.createModule( "context/entry.html", [
      {
        path: "context/entry.js",
        splitPoint: true
      }
    ] );

    builder.createModule( "context/entry.js", [
      {
        path: "context/A.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        path: "context/B.js",
        splitPoint: true
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        path: "context/A.js",
      }
    ] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "bundle", async() => {

    const builder = createDummyBuilder( [ "context/entry.js" ] );

    builder.createModule( "context/entry.js", [
      {
        path: "context/A.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        path: "context/B.js"
      },
      {
        path: "context/C.js"
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        path: "context/A.js"
      }
    ] );

    builder.createModule( "context/C.js", [] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

} );
