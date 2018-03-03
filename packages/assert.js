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

// assert\.strictEqual\(([^,]+),([^)]+)\)
// expect($1 ).toBe($2)

// assert\.deepEqual\(([^,]+),([^)]+)\)
// expect($1 ).toEqual($2)
