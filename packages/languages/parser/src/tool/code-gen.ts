import {
  Transition, RuleTransition, PredicateTransition,
  ActionTransition, PrecedenceTransition, RangeTransition, TokenFinalTransition, EOFTransition, NamedTransition
} from "./transitions";
import { DState } from "./state";
import { DFA } from "./abstract-optimizer";
import { Analyser, GoTo } from "./analysis";
import Grammar, { LexerTokens } from "./grammar";
import { ParserRule, LexerRule } from "./parser/grammar-parser";

export class CodeGenerator {

  grammar: Grammar;
  analyser: Analyser;
  inLexer: boolean;

  constructor( grammar: Grammar, analyser: Analyser ) {
    this.grammar = grammar;
    this.analyser = analyser;
    this.inLexer = false;
  }

  lexerTokenToString( node: LexerTokens ) {
    return node.type === "LexerRule" ? node.name : node.raw;
  }

  numToComment( num: number ) {
    let comment;
    if ( this.inLexer ) {
      comment = `/*'${String.fromCodePoint( num )}'*/`;
    } else {
      if ( num === 0 ) {
        comment = `/*EOF*/`;
      } else {
        comment = `/*${this.lexerTokenToString( this.grammar.idToNode.get( num ) as LexerTokens )}*/`;
      }
    }
    return comment;
  }

  genTransition( transition: Transition ): string {
    if ( transition instanceof RuleTransition ) {
      return `this.rule${transition.rule.name}();`;
    }
    if ( transition instanceof PredicateTransition ) {
      return ""; // TODO
    }
    if ( transition instanceof ActionTransition ) {
      return transition.code + ";";
    }
    if ( transition instanceof PrecedenceTransition ) {
      return ""; // TODO
    }
    if ( transition instanceof RangeTransition ) {
      if ( transition.from === transition.to ) {
        return `this.consume1(${transition.from}${this.numToComment( transition.from )});`;
      }
      return `this.consume2(${transition.from}${this.numToComment( transition.from )},` +
        `${transition.to}${this.numToComment( transition.to )});`;
    }
    if ( transition instanceof TokenFinalTransition ) {
      return `id=${transition.id};`;
    }
    if ( transition instanceof NamedTransition ) {
      if ( transition.multiple ) {
        return `$${transition.name}.push(${this.genTransition( transition.subTransition ).slice( 0, -1 )});`;
      }
      return `$${transition.name}=${this.genTransition( transition.subTransition )}`;
    }
    throw new Error( "Assertion error" );
  }

  getFirst<T>( thing: Iterable<T> ): T {
    for ( const stuff of thing ) {
      return stuff;
    }
    throw new Error( "Assertion error" );
  }

  genMoveToState( state: DState ): string {
    return `$$state=${state.id};\n`;
  }

  genGoto( goto: GoTo | false ) {
    if ( goto ) {
      const [ transition, dest ] = goto;
      return this.genTransition( transition ) + this.genMoveToState( dest );
    }
    if ( goto === false ) {
      return `throw this.unexpected();\n`;
    }
    return `$$loop=false;\n`;
  }

  genBoolExp( looks: RangeTransition[] ) {
    return looks.reduce( ( array, look ) => {
      const last = array[ array.length - 1 ];
      if ( last && last.to === look.from ) {
        last.to = look.to;
      } else {
        array.push( {
          from: look.from,
          to: look.to
        } );
      }
      return array;
    }, [] as { from: number; to: number }[] ).map( look => {
      if ( look.from === look.to ) {
        return `this.current===${look.from}${this.numToComment( look.from )}`;
      }
      return `${this.numToComment( look.from )}${look.from}<=this.current&&` +
        `this.current<=${look.to}${this.numToComment( look.to )}`;
    } ).join( "||" );
  }

  equalsGoto( a: GoTo | false, b: GoTo | false ): boolean {
    if ( a === b ) {
      return true;
    }
    if ( !a || !b ) {
      return false;
    }
    return a[ 1 ] === b[ 1 ] && a[ 0 ].equals( b[ 0 ] );
  }

  // look === null for else cases
  // goto === null for loop=false
  // goto === false to throw error
  addIf( ifs: { looks: RangeTransition[]; goto: GoTo | false }[], look: RangeTransition | null, goto: GoTo | false ) {
    const last = ifs[ ifs.length - 1 ];

    if ( last && this.equalsGoto( last.goto, goto ) ) {
      if ( look === null ) {
        last.looks.length = 0;
      } else {
        last.looks.push( look );
      }
    } else {
      if ( look === null ) {
        ifs.push( {
          looks: [],
          goto
        } );
      } else {
        ifs.push( {
          looks: [ look ],
          goto
        } );
      }
    }
  }

  genStateManyTransitions( state: DState, rule: ParserRule | LexerRule | null ) {
    const data = this.analyser.analyse( state, null );
    const ifs: {
      looks: RangeTransition[];
      goto: GoTo | false;
    }[] = [];
    let code = ``;
    let eofData;

    for ( const [ look, set ] of data ) {
      const goto = this.analyser.testConflict( rule, state, look, set );
      if ( look instanceof EOFTransition ) {
        eofData = goto;
      } else if ( look instanceof RangeTransition ) {
        this.addIf( ifs, look, goto );
      } else {
        // TODO
      }
    }

    if ( eofData === undefined ) {
      if ( this.inLexer ) {
        this.addIf( ifs, null, null );
      } else {
        this.addIf( ifs, null, false );
      }
    } else {
      if ( this.inLexer ) {
        this.addIf( ifs, null, eofData );
      } else {
        this.addIf( ifs, new RangeTransition( 0, 0 ), eofData );
        this.addIf( ifs, null, false );
      }
    }

    for ( const { looks, goto } of ifs ) {
      if ( looks.length > 0 ) {
        code += `if(${this.genBoolExp( looks )}){\n`;
        code += this.genGoto( goto );
        code += `}else `;
      } else {
        code += `{\n`;
        code += this.genGoto( goto );
        code += `}\n`;
      }
    }

    return code;
  }

  genAutomaton( { states, acceptingSet }: DFA<DState>, rule: ParserRule | LexerRule | null ): string {

    let code = "";

    // Optimize the initial states that are always reached
    let initialState = states[ 1 ];
    const ignore = new Set();
    ignore.add( states[ 0 ] );

    while (
      (
        ( initialState.id === 1 && initialState.inTransitions === 0 ) ||
        ( initialState.id > 1 && initialState.inTransitions === 1 )
      ) &&
      initialState.transitionAmount() === 1 &&
      !acceptingSet.has( initialState )
    ) {
      ignore.add( initialState );

      const [ transition, dest ] = this.getFirst( initialState );
      code += this.genTransition( transition );
      initialState = dest;
    }

    // Generate each state
    const cases = [];
    for ( const state of states ) {
      if ( ignore.has( state ) ) {
        continue;
      }
      cases.push( {
        state,
        body: this.genStateManyTransitions( state, rule )
      } );
    }

    if ( cases.length === 1 ) {
      const { body } = cases[ 0 ];

      if ( body.replace( /\n|\s/g, "" ) !== "{$$loop=false;}" ) {
        code += `let $$state=${initialState.id},$$loop=true;`;
        code += `while($$loop){\n`;
        code += body;
        code += `}`;
      }
    } else {
      code += `let $$state=${initialState.id},$$loop=true;`;
      code += `while($$loop){switch($$state){\n`;

      for ( const { state, body } of cases ) {
        code += `case ${state.id}:\n`;
        code += body;
        code += `break;\n`;
      }

      code += `}`;
      code += `}`;
    }

    return code;
  }

  genTokenizer( lexerRuleToAutomaton: Map<LexerRule, DFA<DState>>, lexerAutomaton: DFA<DState> ): string {

    const tokArgType = this.grammar.options.typescript ? `:string` : "";
    const propTypes = this.grammar.options.typescript ? `labels:string[];` : "";
    const tokenTypes = [];

    const labels = [ "" ];
    for ( const [ node, id ] of this.grammar.nodeToId ) {
      if ( labels[ id ] ) {
        continue;
      }

      labels[ id ] = this.lexerTokenToString( node );

      if ( this.grammar.options.typescript ) {
        tokenTypes.push( this.grammar.typecheckDefinition( node ) );
      }
    }

    if ( this.grammar.options.typescript ) {
      this.grammar.types.push( `export type $EOF = {id:0;label:"EOF";image:string };` );
      this.grammar.types.push( `export type $Tokens = ${tokenTypes.join( "|" )};` );
      this.grammar.types.push( `export type $TokensWithEOF = $EOF|$Tokens;` );
    }

    for ( const [ transition ] of lexerAutomaton.states[ 1 ] ) {
      if ( transition instanceof TokenFinalTransition ) {
        throw new Error( `Token ${labels[ transition.id ]} is accepting the empty word` );
      }
    }

    const funcs = [];
    for ( const [ rule, automaton ] of lexerRuleToAutomaton ) {
      funcs.push( `rule${rule.name}(){
        ${this.genAutomaton( automaton, rule )}
      }` );
    }

    return `
    class Tokenizer extends Q.Tokenizer{
      ${propTypes}
      constructor(input${tokArgType}){
        super(input);
        this.labels=${JSON.stringify( labels )};
      }
      readToken() {
        const prevPos = this.pos;
        let id = -1;

        ${this.genAutomaton( lexerAutomaton, null )}

        if (id===-1) {
          throw this.unexpected();
        }

        const image=this.input.slice(prevPos,this.pos);
        const splitted=image.split(${/\r\n?|\n/g.toString()});
        const newLines=splitted.length-1;
        if (newLines>0) {
          this._lineStart=this.pos-splitted[newLines].length;
          this._curLine+=newLines;
        }
        return {
          id,
          label: this.labels[id],
          image
        };
      }
      ${funcs.join( "\n" )}
    }`;
  }

  genParser( parserRuleToAutomaton: Map<ParserRule, DFA<DState>> ): string {
    const funcs = [];
    const parserArgType = this.grammar.options.typescript ? `:string` : "";
    const expectArgType = this.grammar.options.typescript ? `:number|string` : "";

    funcs.push( `
    constructor(text${parserArgType}){super(new Tokenizer(text));}
    unexpected(id${expectArgType}) {
      const labels = this.tokenizer.labels;
      super.unexpected(labels[id]||id);
    }
    ` );

    if ( this.grammar.options.typescript ) {
      this.grammar.types.push( `export type $Position = {pos:number;line:number;column:number;};` );
      this.grammar.types.push( `export type $Location = {start:$Position;end:$Position;};` );
      this.grammar.types.push( `export interface $Base<T> {type:T;loc:$Location;}` );
    }

    for ( const [ rule, automaton ] of parserRuleToAutomaton ) {
      const returnType = this.grammar.options.typescript ? this.grammar.typecheckDefinition( rule ) : "";

      const names = [];
      const keys = [ `type:${JSON.stringify( rule.name )}` ];

      for ( const k of rule.names.names.keys() ) {
        keys.push( `${k}:$${k}` );
        names.push( rule.names.arrays.has( k ) ? `$${k}=[]` : rule.names.optionals.has( k ) ? `$${k}=null` : `$${k}` );
      }

      keys.push( `loc:this.locNode($$loc)` );

      const declarations = names.length ? `let ${names.join( "," )};` : "";

      funcs.push( `rule${rule.name}(){
        let $$loc=this.startNode();${declarations}
        ${this.genAutomaton( automaton, rule )}
        return {${keys.join( "," )}}${returnType ? ` as ${returnType}` : ""};
      }` );
    }

    return `class Parser extends Q.Parser{\n${funcs.join( "\n" )}\nparse(){
      const r=this.rule${this.grammar.firstRule.name}();this.consume1(0);return r;
    }}`;
  }

  gen(
    parserRuleToAutomaton: Map<ParserRule, DFA<DState>>,
    lexerRuleToAutomaton: Map<LexerRule, DFA<DState>>,
    lexerAutomaton: DFA<DState>
  ) {
    this.inLexer = true;
    const tokenizer = this.genTokenizer( lexerRuleToAutomaton, lexerAutomaton );
    this.inLexer = false;
    const parser = this.genParser( parserRuleToAutomaton );
    const types = this.grammar.types.join( "\n" );
    const imports = this.grammar.options.typescript ? `import Q from "@quase/parser";` : `const Q=require("@quase/parser");`;
    const exporting = this.grammar.options.typescript ? `export default Parser;` : `module.exports=Parser;`;
    return `/* eslint-disable */\n${imports}\n${types}\n${tokenizer}\n${parser}\n${exporting}\n`;
  }

}
