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

  genOptionsCode( choices ) {
    let fun = `switch(this.token.label){`;

    for ( const [ look, options ] of choices.lookToNodes ) {
      if ( look != null ) {
        fun += `case ${JSON.stringify( look )}:${this.genCall( options[ 0 ] )}break;`;
      }
    }

    const emptyOptions = choices.lookToNodes.get( null );
    if ( emptyOptions ) {
      fun += `default:${this.genCall( emptyOptions[ 0 ] )}`;
    } else {
      fun += `default:this.unexpected();`;
    }

    fun += "}";
    return fun;
  }

  genDecisionCode( choices, node, inLoop ) {
    let code = `switch(this.token.label){`;

    for ( const look of choices.nodeToLooks.get( node ) ) {
      if ( look != null ) {
        code += `case ${JSON.stringify( look )}:`;
      }
    }

    const canBeEmpty = choices.nodeToLooks.get( node ).includes( null );
    if ( canBeEmpty ) {
      code += `default:${this.genCall( node )}`;
    } else {
      code += `${this.genCall( node )}break;`;
      if ( inLoop ) {
        code += `default:break loop;`;
      }
    }

    code += "}";
    return code;
  }

  genCode( node ) {
    switch ( node.type ) {
      case "Rule":
        return `${this.genCode( node.rule )}${
          node === this.grammar.firstRule ? `this.expect("eof");` : ""
        }`;
      case "Concat":
        return node.body.map( n => this.genCall( n ) ).join( "" );
      case "Options": {
        const choices = this.grammar.createChoicesHandler( node );
        for ( const option of node.options ) {
          choices.analyseSingleOption( option );
        }
        return this.genOptionsCode( choices );
      }
      case "Optional": {
        const choices = this.grammar.createChoicesHandler( node );
        choices.analyseOptionOrEmpty( node );
        return this.genDecisionCode( choices, node.item, false );
      }
      case "ZeroOrMore": {
        const choices = this.grammar.createChoicesHandler( node );
        choices.analyseOptionOrEmpty( node );
        return `loop:while(true){${
          this.genDecisionCode( choices, node.item, true )
        }}`;
      }
      case "OneOrMore": {
        const choices = this.grammar.createChoicesHandler( node );
        choices.analyseOptionOrEmpty( node );
        return `${this.genCall( node.item )}loop:while(true){${
          this.genDecisionCode( choices, node.item, true )
        }}`;
      }
      default:
        throw new Error( `Assertion error: ${node.type}` );
    }
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
