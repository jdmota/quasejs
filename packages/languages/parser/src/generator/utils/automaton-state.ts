type Range = { from: number; to: number };

type Node<T> = {
  range: Range;
  value: T;
  prev: Node<T> | null;
  next: Node<T> | null;
};

type StateIteratorResult<T> = [ Range, T ];

class StateIterator<T> implements Iterator<StateIteratorResult<T>> {

  state: AbstractState<T>;
  current: Node<T> | null;

  constructor( state: AbstractState<T> ) {
    this.state = state;
    this.current = this.state.head;
  }

  next(): IteratorResult<StateIteratorResult<T>> {
    const node = this.current;
    if ( node ) {
      this.current = node.next;
      return { value: [ node.range, node.value ], done: false };
    }
    // @ts-ignore
    return { value: undefined, done: true };
  }

  [Symbol.iterator]() {
    return this;
  }

}

abstract class AbstractState<T> {

  head: Node<T> | null;

  constructor() {
    this.head = null;
  }

  [Symbol.iterator](): StateIterator<T> {
    return new StateIterator( this );
  }

  addNumber( number: number, value: number ) {
    this.addRange( {
      from: number,
      to: number
    }, value );
  }

  addRange( range: Range, value: number ) {

    if ( this.head == null ) {
      this.head = this._newNode( range.from, range.to, value );
      return;
    }

    let curr = this.head;
    while ( curr.next && curr.range.to < range.from ) {
      curr = curr.next;
    }

    let node = this._newNode( range.from, range.to, value );

    while ( true ) {
      if ( range.to < curr.range.from ) {
        this._insertBefore( node, curr );
        break;
      }

      if ( curr.range.to < range.from ) {
        this._insertAfter( node, curr );
        break;
      }

      // console.log( "curr", curr.range, "new", node.range );
      const { left, middle, right } = this._intersection( curr, node );
      // console.log( "inter.range", left && left.range, middle.range, right && right.range );
      // console.log( "inter.value", left && left.value, middle.value, right && right.value );

      if ( left ) {
        this._connect( curr.prev, left );
        this._connect( left, middle );
      } else {
        this._connect( curr.prev, middle );
      }

      if ( right ) {
        if ( curr.next ) {
          if ( right.range.to < curr.next.range.from ) {
            this._connect( middle, right );
            this._connect( right, curr.next );
          } else {
            this._connect( middle, curr.next );
            curr = curr.next;
            node = right;
            continue;
          }
        } else {
          this._connect( middle, right );
        }
      } else {
        if ( curr.next ) {
          this._connect( middle, curr.next );
        }
      }
      break;
    }

  }

  _insertBefore( node: Node<T>, before: Node<T> ) {
    node.prev = before.prev;
    before.prev = node;
    node.next = before;
    if ( node.prev ) {
      node.prev.next = node;
    } else {
      this.head = node;
    }
  }

  _insertAfter( node: Node<T>, after: Node<T> ) {
    node.next = after.next;
    after.next = node;
    node.prev = after;
    if ( node.next ) {
      node.next.prev = node;
    }
  }

  _connect( a: Node<T> | null, b: Node<T> ) {
    if ( a ) {
      a.next = b;
      b.prev = a;
      if ( !a.prev ) {
        this.head = a;
      }
    } else {
      this.head = b;
    }
  }

  _node( from: number, to: number, value: T ): Node<T> {
    return {
      range: { from, to },
      value,
      prev: null,
      next: null
    };
  }

  _intersection( current: Node<T>, newNode: Node<T> ) {

    const a = current.range;
    const b = newNode.range;

    let left = null;
    let right = null;

    // Left
    if ( a.from !== b.from ) {
      left = this._node(
        Math.min( a.from, b.from ),
        Math.max( a.from, b.from ) - 1,
        this._clone( a.from < b.from ? current.value : newNode.value )
      );
    }

    // Middle (intersection)

    const middle = this._node(
      Math.max( a.from, b.from ),
      Math.min( a.to, b.to ),
      this._clone( current.value, newNode.value )
    );

    // Right
    if ( a.to !== b.to ) {
      right = this._node(
        Math.min( a.to, b.to ) + 1,
        Math.max( a.to, b.to ),
        this._clone( a.to < b.to ? newNode.value : current.value )
      );
    }

    return {
      left,
      middle,
      right
    };
  }

  _clone( _value: T, _newValue?: T ): T {
    throw new Error( "Abstract" );
  }

  _newNode( _from: number, _to: number, _value: number ): Node<T> {
    throw new Error( "Abstract" );
  }

}

export class NFAState extends AbstractState<Set<number>> {

  epsilonStates: Set<number>;

  constructor() {
    super();
    this.epsilonStates = new Set();
  }

  importFrom( state: NFAState ) {
    let current = state.head;
    while ( current ) {
      for ( const value of current.value ) {
        this.addRange( current.range, value );
      }
      current = current.next;
    }
  }

  addEpsilon( value: number ) {
    this.epsilonStates.add( value );
  }

  _clone( value: Set<number>, newValue?: Set<number> ): Set<number> {
    const clone = new Set( value );
    if ( newValue ) {
      for ( const v of newValue ) {
        clone.add( v );
      }
    }
    return clone;
  }

  _newNode( from: number, to: number, value: number ): Node<Set<number>> {
    return {
      range: { from, to },
      value: new Set( [ value ] ),
      prev: null,
      next: null
    };
  }

}

export class DFAState extends AbstractState<number> {

  _clone( value: number, newValue?: number ): number {
    if ( newValue != null ) {
      if ( value != null ) {
        throw new Error( "Assertion error" );
      }
      return newValue;
    }
    return value;
  }

  _newNode( from: number, to: number, value: number ): Node<number> {
    return {
      range: { from, to },
      value,
      prev: null,
      next: null
    };
  }

}
