import EventEmitter from "../src";

describe( "events", () => {

  it( "events", () => {

    expect.assertions( 1 );

    class MyEmitter extends EventEmitter {}

    const myEmitter = new MyEmitter();

    myEmitter.on( "event", () => {
      expect( true ).toBe( true );
    } );

    myEmitter.emit( "event" );

  } );

} );
