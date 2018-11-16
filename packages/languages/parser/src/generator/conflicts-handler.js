import { printLoc } from "./utils";

export default class ConflictsHandler {

  constructor( parentNode ) {
    this.parentNode = parentNode;
    this.table = new Map();
    this.found = new Set();
  }

  set( look, node ) {
    let arr = this.table.get( look );
    if ( arr ) {
      arr.push( node );
      this.found.add( look );
    } else {
      arr = [ node ];
      this.table.set( look, arr );
    }
  }

  printNode( node ) {
    if ( node.type === "Concat" && node.body.length === 1 ) {
      return this.printNode( node.body[ 0 ] );
    }
    if ( node.type === "Options" && node.options.length === 1 ) {
      return this.printNode( node.options[ 0 ] );
    }
    return `${node.type}(${printLoc( node )})${node.type === "Id" ? `[${node.name}]` : ""}`;
  }

  report() {
    const reports = [];
    for ( const look of this.found ) {
      const arr = this.table.get( look );
      const conflicts = arr.map( n => this.printNode( n ) ).join( " | " );
      reports.push(
        `In ${this.printNode( this.parentNode )}, when finding ${look}, choice conflicts: ${conflicts}`
      );
    }
    return reports.join( "\n" );
  }

}
