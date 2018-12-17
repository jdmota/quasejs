import { printLoc } from "./utils";

export default class ChoicesHandler {

  constructor( grammar, parentNode ) {
    this.grammar = grammar;
    this.parentNode = parentNode;
    this.lookToNodes = new Map();
    this.nodeToLooks = new Map();
    this.conflicts = new Set();
  }

  set( look, node ) {
    this.setLookToNode( look, node );
    this.setNodeToLook( node, look );
  }

  setLookToNode( look, node ) {
    let arr = this.lookToNodes.get( look );
    if ( arr ) {
      arr.push( node );
      this.conflicts.add( look );
    } else {
      arr = [ node ];
      this.lookToNodes.set( look, arr );
    }
  }

  setNodeToLook( node, look ) {
    let arr = this.nodeToLooks.get( node );
    if ( arr ) {
      arr.push( look );
    } else {
      arr = [ look ];
      this.nodeToLooks.set( node, arr );
    }
  }

  analyseSingleOption( node ) {
    for ( const look of this.grammar.lookahead( node ) ) {
      this.set( look, node );
    }
    if ( this.grammar.first( node ).canBeEmpty ) {
      this.set( null, node );
    }
  }

  analyseOptionOrEmpty( node ) {
    const emptyNode = {
      type: "Empty",
      loc: node.loc
    };
    this.analyseSingleOption( node.item );
    for ( const look of this.grammar.follow( node ) ) {
      this.set( look, emptyNode );
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
    for ( const look of this.conflicts ) {
      const arr = this.lookToNodes.get( look );
      const conflicts = arr.map( n => this.printNode( n ) ).join( " | " );
      reports.push(
        `In ${this.printNode( this.parentNode )}, when finding ${look}, choice conflicts: ${conflicts}`
      );
    }
    return reports.join( "\n" );
  }

}
