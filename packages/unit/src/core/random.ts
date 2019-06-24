import { MersenneTwister19937, shuffle, integer } from "random-js";

function toHex( int: number ) {
  return int < 0 ? "-0x" + ( -int ).toString( 16 ).toUpperCase() : "0x" + int.toString( 16 ).toUpperCase();
}

const MIN_INTEGER = -2147483648;
const MAX_INTEGER = 2147483647;

function is32bitInteger( x: number ) {
  return MIN_INTEGER <= x && x <= MAX_INTEGER;
}

const seedProducer = MersenneTwister19937.autoSeed();

function newSeed() {
  return integer( MIN_INTEGER, MAX_INTEGER )( seedProducer );
}

export default function randomizer( input: string | boolean | undefined ) {
  if ( !input ) {
    return null;
  }

  let seed;

  if ( input === true ) {
    seed = newSeed();
  } else {
    seed = Number( input );

    if ( !is32bitInteger( seed ) ) {
      throw new Error( "Invalid random seed. Expected 32-bit integer." );
    }
  }

  const engine = MersenneTwister19937.seed( seed );

  return {
    engine,
    seed,
    hex: toHex( seed ),
    shuffle<T>( array: T[] ) {
      shuffle( this.engine, array );
      return array;
    }
  };
}
