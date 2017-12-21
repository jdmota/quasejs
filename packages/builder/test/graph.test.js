import { hashName } from "../src/utils/hash";
import createRuntime from "../src/runtime/create-runtime";
import processGraph from "../src/graph";

async function createGraphAndRuntime( builder ) {
  const finalAssets = processGraph( builder );
  finalAssets.runtime = await createRuntime( { finalAssets, usedHelpers: new Set(), minify: false } );
  return finalAssets;
}

function createDummyModule( builder, id, deps ) {
  const normalizedId = id.replace( "context/", "" );
  const m = {
    builder,
    id,
    normalizedId,
    isEntry: builder.idEntries.includes( id ),
    dest: id.replace( "context/", "dest/" ),
    hashId: hashName( normalizedId, builder.idHashes ),
    deps,
    getDeps() {
      return ( this.deps || [] ).map( ( { resolved, src, splitPoint, async } ) => ( {
        src,
        splitPoint,
        async,
        required: this.builder.getModule( resolved )
      } ) );
    }
  };
  builder.modules.set( id, m );
  return m;
}

function createDummyBuilder( idEntries ) {
  return {
    idEntries,
    modules: new Map(),
    idHashes: new Set(),
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
        resolved: "context/A.js"
      },
      {
        resolved: "context/B.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        resolved: "context/B.js"
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        resolved: "context/A.js"
      }
    ] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "cycle split", async() => {

    const builder = createDummyBuilder( [ "context/entry.js" ] );

    builder.createModule( "context/entry.js", [
      {
        resolved: "context/A.js"
      },
      {
        resolved: "context/B.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        resolved: "context/B.js",
        splitPoint: true
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        resolved: "context/A.js",
        splitPoint: true
      }
    ] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "split points", async() => {

    const builder = createDummyBuilder( [ "context/entry.html" ] );

    builder.createModule( "context/entry.html", [
      {
        resolved: "context/entry.js",
        splitPoint: true
      }
    ] );

    builder.createModule( "context/entry.js", [
      {
        resolved: "context/A.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        resolved: "context/B.js",
        splitPoint: true
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        resolved: "context/A.js",
      }
    ] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

  it( "bundle", async() => {

    const builder = createDummyBuilder( [ "context/entry.js" ] );

    builder.createModule( "context/entry.js", [
      {
        resolved: "context/A.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        resolved: "context/B.js"
      },
      {
        resolved: "context/C.js"
      }
    ] );

    builder.createModule( "context/B.js", [
      {
        resolved: "context/A.js"
      }
    ] );

    builder.createModule( "context/C.js", [] );

    expect( await createGraphAndRuntime( builder ) ).toMatchSnapshot();

  } );

} );
