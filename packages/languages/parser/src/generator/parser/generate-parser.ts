import generateTokenizer from "../tokenizer/generate-tokenizer";
import { Node, ParserRule } from "../grammar-parser";
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

  gen( node: Node ): string {
    switch ( node.type ) {
      case "ParserRule":
        return `this.f${this.genParserRule( node )}();`;
      case "Options":
      case "Concat":
      case "Optional":
      case "ZeroOrMore":
      case "OneOrMore":
        return this.genCode( node );
      case "Empty":
        return "";
      case "LexerRule":
      case "String":
      case "Regexp":
        return `this.expect(${this.grammar.nodeToId.get( node )});`;
      case "Id":
        return this.gen( this.grammar.getRule( node.name, node ) );
      case "Named": {
        return node.multiple ?
          `$n_${node.name}.push(${this.gen( node.item ).slice( 0, -1 )});` :
          `$n_${node.name}=${this.gen( node.item )}`;
      }
      default:
        throw new Error( `Unexpected node: ${node.type}` );
    }
  }

  genOptionsCode( choices: ChoicesHandler ) {
    let fun = `switch(this.token.id){`;

    for ( const [ look, options ] of choices.lookToNodes ) {
      if ( look != null ) {
        fun += `case ${JSON.stringify( look )}:${this.gen( options[ 0 ] )}break;`;
      }
    }

    const emptyOptions = choices.lookToNodes.get( null );
    if ( emptyOptions ) {
      fun += `default:${this.gen( emptyOptions[ 0 ] )}`;
    } else {
      fun += `default:this.unexpected();`;
    }

    fun += "}";
    return fun;
  }

  genDecisionCode( choices: ChoicesHandler, node: Node, inLoop: boolean ) {
    let code = `switch(this.token.id){`;
    const looks = choices.nodeToLooks.get( node ) || [];

    for ( const look of looks ) {
      if ( look != null ) {
        code += `case ${JSON.stringify( look )}:`;
      }
    }

    const canBeEmpty = looks.includes( null );
    if ( canBeEmpty ) {
      code += `default:${this.gen( node )}`;
    } else {
      code += `${this.gen( node )}break;`;
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
        return node.body.map( n => this.gen( n ) ).join( "" );
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
        return `${this.gen( node.item )}loop:while(true){${
          this.genDecisionCode( choices, node.item, true )
        }}`;
      }
      default:
        return this.gen( node );
    }
  }

  genParserRule( node: ParserRule ) {
    if ( this.nodeToFuncId.has( node ) ) {
      return this.nodeToFuncId.get( node );
    }

    const id = this.uuid++;
    this.nodeToFuncId.set( node, id );

    const fun = this.genCode( node );
    const returnType = this.grammar.options.typescript ? `:${this.grammar.typecheckDefinition( node )}` : "";

    const names = [];
    const keys = [ `type:${JSON.stringify( node.name )}` ];

    for ( const k of node.names.names.keys() ) {
      keys.push( `${k}:$n_${k}` );
      names.push( node.names.arrays.has( k ) ? `$n_${k}=[]` : node.names.optionals.has( k ) ? `$n_${k}=null` : `$n_${k}` );
    }

    keys.push( `loc:this.locNode($l)` );

    const declarations = names.length ? `let ${names.join( "," )};` : "";

    this.funcs.push(
      `/*${node.name}*/f${id}()${returnType}{let $l=this.startNode();${declarations}${fun}return {${keys.join( "," )}};}`
    );
    return id;
  }

  do() {
    const tokenizer = generateTokenizer( this.grammar );

    const parserArgType = this.grammar.options.typescript ? `:string` : "";
    const expectArgType = this.grammar.options.typescript ? `:number|string` : "";

    this.funcs.push( `constructor(text${parserArgType}){super(new Tokenizer(text));}` );
    this.funcs.push( `
    expect(id${expectArgType}) {
      const token = this.token;
      if ( token.id !== id ) {
        const labels = this.tokenizer.labels;
        throw this.error(
          \`Unexpected token \${labels[token.id]||token.id}, expected \${labels[id]||id}\`
        );
      }
      this.next();
      return token;
    }
    ` );

    if ( this.grammar.options.typescript ) {
      this.grammar.types.push( `export type $Position = {pos:number;line:number;column:number;};` );
      this.grammar.types.push( `export type $Location = {start:$Position;end:$Position;};` );
      this.grammar.types.push( `export interface $Base<T> {type:T;loc:$Location;}` );

      this.grammar.typecheckDefinition( this.grammar.firstRule );
    }

    const call = this.gen( this.grammar.firstRule );

    const types = this.grammar.types.join( "\n" );
    const imports = this.grammar.options.typescript ? `import Q from "@quase/parser";` : `const Q=require("@quase/parser");`;
    const parser = `class Parser extends Q.Parser{\n${this.funcs.join( "\n" )}\nparse(){return ${call}}}`;
    const exporting = this.grammar.options.typescript ? `export default Parser;` : `module.exports=Parser;`;

    return `/* eslint-disable */\n${imports}\n${types}\n${tokenizer}\n${parser}\n${exporting}\n`;
  }

}

export default function generate( grammar: Grammar ) {
  return new Generator( grammar ).do();
}
