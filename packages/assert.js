export default {
  ok( a ) {
    expect( a ).toBeTruthy();
  },
  strictEqual( a, b ) {
    expect( a ).toBe( b );
  },
  notStrictEqual( a, b ) {
    expect( a ).not.toBe( b );
  },
  deepEqual( a, b ) {
    expect( a ).toEqual( b );
  },
  notDeepEqual( a, b ) {
    expect( a ).not.toEqual( b );
  },
  throws( a, b ) {
    expect( a ).toThrow( b );
  },
  expect( n ) {
    expect.assertions( n );
  }
};
