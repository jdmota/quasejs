export default function SmartQueue() {
  this.first = null;
  this.last = null;
}

SmartQueue.prototype = {

  constructor: SmartQueue,

  push: function( elem ) {
    if ( this.last ) {
      this.last.__next = elem;
    } else {
      this.first = elem;
    }
    this.last = elem;
  },

  isEmpty: function() {
    return this.first == null;
  },

  shift: function() {
    let elem = this.first;
    this.first = ( elem && elem.__next ) || null;
    if ( this.first ) {
      elem.__next = undefined; // Prevent memory leak
    }
    if ( this.last === elem ) {
      this.last = null;
    }
    return elem;
  }

};
