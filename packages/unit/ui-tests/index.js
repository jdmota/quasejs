const test = require( "../dist" );

test( "Test 1", t => {
  t.plan( 1 );
} );

test.skip( "Test 2", () => {

} );

test( "Test 3", t => {
  t.timeout( 1 );
  return new Promise( resolve => {
    setTimeout( resolve, 1000 );
  } );
} );

test( "Test 4", () => {
  throw new Error( "abc" );
} );

test( "Test 5", t => {
  t.skip( "my reason for skipping" );
} );

test( "Test 6", () => {
  const e = new Error( "abc" );
  e.expected = {};
  e.actual = { a: 10 };
  throw e;
} );

test( "Test 7", t => {
  t.slow( 1 );
  t.incCount();
  return new Promise( resolve => {
    setTimeout( resolve, 1000 );
  } );
} );

test( "Test 8", () => {
  const e = new Error( "abc" );
  e.expected = "abcadsadedascasdac";
  e.actual = "bcedabhdytewvdhagvda";
  throw e;
} );

const group = test.group( "Group 1" );

group.timeout( 1 );

group.test( "Test in group", () => {
  return new Promise( resolve => {
    setTimeout( resolve, 1000 );
  } );
} );

test( "post error", t => {
  t.incCount();
  setTimeout( () => {
    t.timeout( 30 );
  }, 1 );
} );
