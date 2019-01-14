import generateTokenizer from "../tokenizer/generate-tokenizer";
import { Node } from "../grammar-parser";
import Grammar from "../grammar";
import ChoicesHandler from "../choices-handler";

class Generator {

  grammar: Grammar;
  funcs: string[];
  nodeToFuncId: Map<Node, number>;
  uuid: number;

  constructor( grammar: Grammar ) {
    this.grammar = grammar;
    this.funcs = [];
    this.nodeToFuncId = new Map();
    this.uuid = 1;
  }

  genCall( node: Node ): string {
    switch ( node.type ) {
      case "ParserRule":
        return `this.f${this.gen( node )}();`;
      case "Options":
        return `this.f${this.gen( node )}(s);`;
      case "Concat":
        return `this.f${this.gen( node )}(s);`;
      case "Optional":
      case "ZeroOrMore":
      case "OneOrMore":
        return `this.f${this.gen( node )}(s);`;
      case "Empty":
        return "";
      case "LexerRule":
      case "String":
      case "Regexp":
        return `this.expect(${this.grammar.nodeToId.get( node )});`;
      case "Id":
        return this.genCall( this.grammar.getRule( node.name, node ) );
      case "Named":
        if ( node.scope == null ) {
          throw new Error( "Assertion error" );
        }
        return node.scope.names[ node.name ] === "array" ?
          `s.${node.name}.push(${this.genCall( node.item ).slice( 0, -1 )});` :
          `s.${node.name}=${this.genCall( node.item )}`;
      default:
        throw new Error( `Unexpected node: ${node.type}` );
    }
  }

  genOptionsCode( choices: ChoicesHandler ) {
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

  genDecisionCode( choices: ChoicesHandler, node: Node, inLoop: boolean ) {
    let code = `switch(this.token.label){`;
    const looks = choices.nodeToLooks.get( node ) || [];

    for ( const look of looks ) {
      if ( look != null ) {
        code += `case ${JSON.stringify( look )}:`;
      }
    }

    const canBeEmpty = looks.includes( null );
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

  genCode( node: Node ): string {
    switch ( node.type ) {
      case "ParserRule":
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
        return this.genCall( node );
    }
  }

  gen( node: Node ) {
    if ( this.nodeToFuncId.has( node ) ) {
      return this.nodeToFuncId.get( node );
    }

    const id = this.uuid++;
    this.nodeToFuncId.set( node, id );

    const fun = this.genCode( node );

    if ( node.type === "ParserRule" ) {
      const entries = Object.entries( node.names );
      const scopeObj = entries.map(
        ( [ key, value ] ) => `${key}:${value === "array" ? "[]" : "null"}`
      ).join( "," );
      const type = `type:${JSON.stringify( node.name )},`;
      this.funcs.push( `f${id}(){let l=this.startNode();let s={${type}${scopeObj}};${fun}s.loc=this.locNode(l);return s;}` );
    } else {
      this.funcs.push( `f${id}(s){${fun}}` );
    }
    return id;
  }

  do() {
    const tokenizer = generateTokenizer( this.grammar );

    this.funcs.push( `constructor(text){super(new Tokenizer(text));}` );
    this.funcs.push( `
    expect( t ) {
      const token = this.eat( t );
      if ( token == null ) {
        const labels = this.tokenizer.labels;
        throw this.error(
          \`Unexpected token \${labels[this.token.label]||this.token.label}, expected \${labels[t]||t}\`
        );
      }
      return token;
    }
    ` );

    const call = this.genCall( this.grammar.firstRule );
    const imports = `const Q=require("@quase/parser");`;
    const parser = `class Parser extends Q.Parser{\n${this.funcs.join( "\n" )}\nparse(){return ${call}}}`;
    return `/* eslint-disable */\n${imports}\n${tokenizer}\n${parser}\nmodule.exports=Parser;`;
  }

}

export default function generate( grammar: Grammar ) {
  return new Generator( grammar ).do();
}
