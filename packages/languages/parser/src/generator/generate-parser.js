import { printLoc } from "./utils";
import generateTokenizer from "./generate-tokenizer";

class Generator {

  constructor( grammar ) {
    this.grammar = grammar;
    this.funcs = [];
    this.nodeToFuncId = new Map();
    this.uuid = 1;
  }

  genCall( node ) {
    switch ( node.type ) {
      case "Rule":
        return `this.f${this.gen( node )}();`;
      case "Options":
        if ( node.options.length === 1 ) {
          return this.genCall( node.options[ 0 ] );
        }
        return `this.f${this.gen( node )}(s);`;
      case "Concat":
        if ( node.body.length === 1 ) {
          return this.genCall( node.body[ 0 ] );
        }
        return `this.f${this.gen( node )}(s);`;
      case "Optional":
      case "ZeroOrMore":
      case "OneOrMore":
        return `this.f${this.gen( node )}(s);`;
      case "Id":
        if ( this.grammar.isVariable( node.name ) ) {
          return this.genCall( this.grammar.getRule( node.name ) );
        }
        if ( this.grammar.isTerminal( node.name ) ) {
          return `this.expect(${JSON.stringify( node.name )});`;
        }
        throw new Error( `Rule or Terminal ${node.name} does not exist (${printLoc( node )})` );
      case "Named":
        if ( node.name === "type" ) {
          throw new Error( `Cannot have named parameter called 'type' (${printLoc( node )})` );
        }
        return node.scope.names[ node.name ] === "array" ?
          `s.${node.name}.push(${this.genCall( node.item ).slice( 0, -1 )});` :
          `s.${node.name}=${this.genCall( node.item )}`;
      default:
        throw new Error( `Unexpected node: ${node.type}` );
    }
  }

  genCode( node ) {
    let fun = "";
    switch ( node.type ) {
      case "Rule":
        fun += this.genCode( node.rule );
        if ( node === this.grammar.firstRule ) {
          fun += `this.expect("eof");`;
        }
        break;
      case "Options": {
        const conflict = this.grammar.createConflictHandler( node );
        const empties = [];

        fun += `switch(this.token.label){`;
        for ( const option of node.options ) {
          for ( const look of this.grammar.lookahead( option ) ) {
            fun += `case ${JSON.stringify( look )}:`;
            conflict.set( look, option );
          }
          fun += `${this.genCall( option )}break;`;

          if ( this.grammar.first( option ).canBeEmpty ) {
            empties.push( option );
          }
        }
        if ( empties.length === 0 ) {
          fun += `default:throw new Error("");`;
        } else {
          fun += `default:${this.genCall( empties[ 0 ] )}`;
          for ( const option of empties ) {
            conflict.set( null, option );
          }
        }
        fun += "}";
        break;
      }
      case "Concat": {
        for ( const n of node.body ) {
          fun += this.genCall( n );
        }
        break;
      }
      case "Optional": {
        const conflict = this.grammar.createConflictHandler( node );

        fun += "switch(this.token.label){";
        for ( const look of this.grammar.lookahead( node.item ) ) {
          fun += `case ${JSON.stringify( look )}:`;
          conflict.set( look, node.item );
        }
        fun += `${this.genCall( node.item )}break;}`;
        break;
      }
      case "ZeroOrMore": {
        const conflict = this.grammar.createConflictHandler( node );

        let choice = "switch(this.token.label){";
        for ( const look of this.grammar.lookahead( node.item ) ) {
          choice += `case ${JSON.stringify( look )}:`;
          conflict.set( look, node.item );
        }
        choice += `break;`;
        choice += `default:break loop;}`;

        fun += `loop:while(true){${choice}${this.genCall( node.item )}}`;
        break;
      }
      case "OneOrMore": {
        const conflict = this.grammar.createConflictHandler( node );

        let choice = "switch(this.token.label){";
        for ( const look of this.grammar.lookahead( node.item ) ) {
          choice += `case ${JSON.stringify( look )}:`;
          conflict.set( look, node.item );
        }
        choice += `break;`;
        choice += `default:break loop;}`;

        fun += `while(true){${this.genCall( node.item )}${choice}}`;
        break;
      }
      case "Id":
      case "Named":
        throw new Error( `Assertion error: ${node.type}` );
      default:
        throw new Error( `Unexpected node: ${node.type}` );
    }
    return fun;
  }

  gen( node ) {
    if ( this.nodeToFuncId.has( node ) ) {
      return this.nodeToFuncId.get( node );
    }

    const id = this.uuid++;
    this.nodeToFuncId.set( node, id );

    const fun = this.genCode( node );

    if ( node.names ) {
      const entries = Object.entries( node.names );
      const scopeObj = entries.map(
        ( [ key, value ] ) => `${key}:${value === "array" ? "[]" : "null"}`
      ).join( "," );
      const type = node.type === "Rule" ? `type:${JSON.stringify( node.name )},` : "";
      this.funcs.push( `f${id}(){let s={${type}${scopeObj}};${fun}return s;}` );
    } else {
      this.funcs.push( `f${id}(s){${fun}}` );
    }
    return id;
  }

  do() {
    this.funcs.push( `constructor(text){super(new Tokenizer(text));}` );

    const call = this.genCall( this.grammar.firstRule );
    const imports = `const Q=require("@quase/parser");`;
    const tokenizer = generateTokenizer( this.grammar.terminals );
    const parser = `class Parser extends Q.Parser{\n${this.funcs.join( "\n" )}\nparse(){return ${call}}}`;
    return `${imports}\n${tokenizer}\n${parser}`;
  }

}

export default function generate( grammar ) {
  return new Generator( grammar ).do();
}
