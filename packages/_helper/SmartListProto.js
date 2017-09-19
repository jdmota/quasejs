export default {

  length: function() {
    return this.arr.length;
  },

  add: function( obj ) {
    obj._index = this.arr.push( obj ) - 1;
  },

  remove: function( obj ) {
    let list = this.arr;
    for ( let i = obj._index, k = i + 1, n = list.length; k < n; i += 1, k += 1 ) {
      list[ i ] = list[ k ];
      list[ i ]._index = i;
    }
    list.pop();
  },

  forEach: function( callback ) {
    let list = this.arr;
    for ( let i = 0, len = list.length; i < len; i++ ) {
      if ( callback( list[ i ] ) === false ) {
        break;
      }
    }
  },

  safeForEach: function( callback ) {
    let list = this.arr;
    let i = 0;
    let len = list.length;
    let newList = [];
    for ( ; i < len; i++ ) {
      newList.push( list[ i ] );
    }
    for ( i = 0; i < len; i++ ) {
      callback( newList[ i ] );
    }
  }

};
