import { printLoc } from "./utils";
import { Node, OptionalOrRepetition, Empty } from "./grammar-parser";
import Grammar from "./grammar";

type Look = number | null;

export default class ChoicesHandler {

  grammar: Grammar;
  parentNode: Node;
  lookToNodes: Map<Look, Node[]>;
  nodeToLooks: Map<Node, Look[]>;
  conflicts: Set<Look>;

  constructor( grammar: Grammar, parentNode: Node ) {
    this.grammar = grammar;
    this.parentNode = parentNode;
    this.lookToNodes = new Map();
    this.nodeToLooks = new Map();
    this.conflicts = new Set();
  }

  set( look: Look, node: Node ) {
    this.setLookToNode( look, node );
    this.setNodeToLook( node, look );
  }

  setLookToNode( look: Look, node: Node ) {
    let arr = this.lookToNodes.get( look );
    if ( arr ) {
      arr.push( node );
      this.conflicts.add( look );
    } else {
      arr = [ node ];
      this.lookToNodes.set( look, arr );
    }
  }

  setNodeToLook( node: Node, look: Look ) {
    let arr = this.nodeToLooks.get( node );
    if ( arr ) {
      arr.push( look );
    } else {
      arr = [ look ];
      this.nodeToLooks.set( node, arr );
    }
  }

  analyseSingleOption( node: Node ) {
    for ( const look of this.grammar.lookahead( node ) ) {
      this.set( look, node );
    }
    if ( this.grammar.first( node ).canBeEmpty ) {
      this.set( null, node );
    }
  }

  analyseOptionOrEmpty( node: OptionalOrRepetition ) {
    const emptyNode: Empty = {
      type: "Empty",
      loc: node.loc
    };
    this.analyseSingleOption( node.item );
    for ( const look of this.grammar.follow( node ) ) {
      this.set( look, emptyNode );
    }
  }

  printNode( node: Node ) {
    const type = node.type === "Id" ? `${node.name} ` :
      ( node.type === "String" || node.type === "Regexp" ) ? `${node.raw} ` : node.type;
    return `${type}(${printLoc( node )})`;
  }

  report() {
    const reports = [];
    for ( const look of this.conflicts ) {
      const arr = this.lookToNodes.get( look );
      const conflicts = ( arr as Node[] ).map( n => this.printNode( n ) ).join( " | " );
      const node = look == null ? null : this.grammar.idToNode.get( look );
      const name = node == null ? "nothing" : node.type === "LexerRule" ? node.name : node.raw;
      reports.push(
        `In ${this.printNode( this.parentNode )}, when finding ${name}, choice conflicts: ${conflicts}`
      );
    }
    return reports.join( "\n" );
  }

}
