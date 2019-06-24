export default {
  strictEqual( a, b ) {
    expect( a ).toBe( b );
  },
  deepEqual( a, b ) {
    expect( a ).toEqual( b );
  },
  throws( a, b ) {
    expect( a ).toThrow( b );
  }
};
