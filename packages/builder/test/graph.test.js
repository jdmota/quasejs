import { hashName } from "../src/utils/hash";
import { getType } from "../src/id";
import createRuntime from "../src/runtime/create-runtime";
import processGraph from "../src/graph";

async function createGraphAndRuntime( builder ) {
  builder.moduleEntries = new Set( builder.entries.map( e => builder.getModule( e ) ) );

  for ( const module of builder.modules.values() ) {
    const map = new Map();
    for ( const dep of module.deps ) {
      const required = builder.getModule( dep.path );
      map.set(
        dep.path,
        Object.assign( {}, dep, {
          request: dep.path,
          splitPoint: builder.isSplitPoint( required, module ),
          required
        } )
      );
    }
    module.moduleDeps = map;
  }

  const finalAssets = await processGraph( builder );
  finalAssets.runtime = await createRuntime( {
    context: "context",
    fullPath: builder.entries[ 0 ],
    publicPath: "/",
    finalAssets,
    usedHelpers: new Set(),
    minify: false
  } );
  return finalAssets;
}

function createDummyModule( builder, id, deps ) {
  const relative = id.replace( "context/", "" );
  const m = {
    builder,
    id,
    path: id,
    relative,
    normalized: relative,
    type: getType( id ),
    isEntry: builder.entries.includes( id ),
    dest: id.replace( "context/", "dest/" ),
    hashId: hashName( relative, builder.usedIds, 5 ),
    deps: deps || [],
    moduleDeps: null,
    getModuleDeps() {
      return this.moduleDeps;
    }
  };
  builder.modules.set( id, m );
  return m;
}

function createDummyBuilder( entries, isSplitPoint ) {
  return {
    entries,
    modules: new Map(),
    moduleEntries: null,
    usedIds: new Set(),
    isSplitPoint: isSplitPoint || ( () => false ),
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

    const builder = createDummyBuilder( [ "context/entry.js" ], ( a, b ) => {
      return (
        a.path === "context/A.js" && b.path === "context/B.js"
      ) || (
        a.path === "context/B.js" && b.path === "context/A.js"
      );
    } );

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

  it( "split points", async() => {

    const builder = createDummyBuilder( [ "context/entry.html" ], ( a, b ) => {
      return (
        a.path === "context/entry.js" && b.path === "context/entry.html"
      ) || (
        a.path === "context/B.js" && b.path === "context/A.js"
      );
    } );

    builder.createModule( "context/entry.html", [
      {
        path: "context/entry.js"
      }
    ] );

    builder.createModule( "context/entry.js", [
      {
        path: "context/A.js"
      }
    ] );

    builder.createModule( "context/A.js", [
      {
        path: "context/B.js"
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
