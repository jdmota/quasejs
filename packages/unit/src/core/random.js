const Random = require( "random-js" );

function toHex( int ) {
  return "0x" + int.toString( 16 ).toUpperCase();
}

const MIN_INTEGER = -2147483648;
const MAX_INTEGER = 2147483647;

function is32bitInteger( x ) {
  return MIN_INTEGER <= x && x <= MAX_INTEGER;
}

export default function randomizer( input ) {
  if ( !input ) {
    return null;
  }

  let engine, seed;

  if ( input === true ) {

    engine = Random.engines.mt19937().autoSeed();

    seed = Random.integer( MIN_INTEGER, MAX_INTEGER )( engine );

  } else {

    seed = Number( input );

    if ( !is32bitInteger( seed ) ) {
      throw new Error( "Invalid random seed. Expected 32-bit integer." );
    }

    engine = Random.engines.mt19937().seed( seed );

  }

  return {
    engine,
    seed,
    hex: toHex( seed ),
    shuffle( array ) {
      Random.shuffle( this.engine, array );
      return array;
    }
  };
}
