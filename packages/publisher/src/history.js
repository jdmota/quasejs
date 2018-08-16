/* eslint-disable no-console */

const arrowUp = "↑";
const arrowDown = "↓";
const arrowRight = "→";

export default class History {

  constructor() {
    this.history = [];
  }

  start( op ) {
    this.history.push( {
      start: true,
      end: false,
      op
    } );
  }

  end( op ) {
    this.history.push( {
      start: false,
      end: true,
      op
    } );
  }

  show() {
    for ( let i = 0; i < this.history.length; i++ ) {
      const { start, op } = this.history[ i ];
      const next = this.history[ i + 1 ];

      if ( start && next && next.end && next.op === op ) {
        console.error( `${arrowRight} Started and finished: ${op}` );
      } else if ( start ) {
        console.error( `${arrowUp} Started: ${op}` );
      } else {
        console.error( `${arrowDown} Finished: ${op}` );
      }
    }
  }

}
