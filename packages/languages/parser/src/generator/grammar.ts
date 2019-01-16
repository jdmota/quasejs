import generateParser from "./parser/generate-parser";
import { LexerTokens } from "./tokenizer/create-automaton";
import { printLoc } from "./utils";
import GrammarParser, { StringNode, RegexpNode, Id, Rule, LexerRule, ParserRule, Node } from "./grammar-parser";
import ChoicesHandler from "./choices-handler";

type Options = {
  typescript?: boolean;
};

export default class Grammar {

  options: Options;
  choiceHandlers: ChoicesHandler[];
  lexerRules: Map<string, LexerRule>;
  parserRules: Map<string, ParserRule>;
  rules: Map<string, Rule>;
  firstRule: Rule;
  ids: Map<string, Id[]>;
  terminals: ( StringNode | RegexpNode )[];
  nodeToId: Map<LexerTokens, number>;
  idToNode: Map<number, LexerTokens>;
  transitionToNode: Map<number, LexerTokens>;
  terminalRawToId: Map<string, number>;
  types: string[];
  nodeToTypeId: Map<ParserRule | LexerRule | StringNode | RegexpNode, string>;

  constructor( grammarText: string, options: Options = {} ) {
    this.options = options;
    this.choiceHandlers = [];

    const grammarParser = new GrammarParser( grammarText );
    const grammarAst = grammarParser.parse();

    this.ids = grammarParser.ids;
    this.terminals = grammarParser.terminals;

    this.lexerRules = grammarAst.lexerRules;
    this.parserRules = grammarAst.parserRules;
    this.rules = grammarAst.rules;
    this.firstRule = grammarAst.firstRule;

    this.nodeToId = new Map();
    this.idToNode = new Map();
    this.transitionToNode = new Map();
    this.terminalRawToId = new Map();

    this.types = [];
    this.nodeToTypeId = new Map();

    this.analyseLexer();
  }

  getRule( name: string, node?: Node ) {
    const rule = this.rules.get( name );
    if ( rule == null ) {
      throw new Error( `Rule ${name} is not defined${node ? ` (${printLoc( node )})` : ""}` );
    }
    if ( rule.modifiers.fragment ) {
      throw new Error( `Rule ${name} is a lexer fragment${node ? ` (${printLoc( node )})` : ""}` );
    }
    return rule;
  }

  // Returns an array of "id nodes" with name "name"
  nameUsedIn( name: string ) {
    this.getRule( name );
    return this.ids.get( name ) || [];
  }

  createChoicesHandler( parentNode: Node ) {
    const c = new ChoicesHandler( this, parentNode );
    this.choiceHandlers.push( c );
    return c;
  }

  reportConflicts() {
    const reports = [];
    for ( const handler of this.choiceHandlers ) {
      const report = handler.report();
      if ( report ) {
        reports.push( report );
      }
    }
    return reports;
  }

  first( node: Node, set = new Set(), stack = new Set() ) {
    const f = ( node: Node ): boolean => {
      switch ( node.type ) {
        case "ParserRule":
          return f( node.rule );
        case "Options":
          return node.options.map( f ).some( x => x );
        case "Concat":
          return node.body.every( f );
        case "Optional":
        case "ZeroOrMore":
          f( node.item );
          return true;
        case "OneOrMore":
          return f( node.item );
        case "Empty":
          return true;
        case "LexerRule":
        case "String":
        case "Regexp":
          set.add( this.nodeToId.get( node ) as number );
          return false;
        case "Id": {
          if ( stack.has( node.name ) ) {
            throw new Error( `Left recursion on ${node.name}` );
          }
          stack.add( node.name );
          const result = f( this.getRule( node.name, node ) );
          stack.delete( node.name );
          return result;
        }
        case "Named":
          return f( node.item );
        default:
          throw new Error( `Unexpected node: ${node.type}` );
      }
    };
    return {
      set,
      canBeEmpty: f( node )
    };
  }

  findRoot( node: Node ) {
    while ( node.parent ) {
      node = node.parent;
    }
    return node;
  }

  follow( node: Node, set = new Set() ) {
    if ( node.parent ) {

      let canBeEmpty = true;
      let sibling = node.nextSibling;

      while ( sibling && canBeEmpty ) {
        canBeEmpty = this.first( sibling, set ).canBeEmpty;
        sibling = sibling.nextSibling;
      }

      if ( canBeEmpty ) {
        this.follow( this.findRoot( node ), set );
      }
    } else {
      // "node" is a rule
      for ( const n of this.nameUsedIn( ( node as Rule ).name ) ) {
        this.follow( n, set );
      }
    }
    return set;
  }

  lookahead( node: Node, set = new Set() ) {
    if ( this.first( node, set ).canBeEmpty ) {
      this.follow( node, set );
    }
    return set;
  }

  analyseLexer() {
    let terminalUUID = 1;

    for ( const node of this.terminals ) {
      const currId = this.terminalRawToId.get( node.raw );
      if ( currId != null ) {
        this.nodeToId.set( node, currId );
        continue;
      }
      const id = terminalUUID++;
      const finalTransition = -id;

      this.nodeToId.set( node, id );
      this.idToNode.set( id, node );
      this.transitionToNode.set( finalTransition, node );
      this.terminalRawToId.set( node.raw, id );
    }

    for ( const node of this.lexerRules.values() ) {
      if ( node.modifiers.fragment ) {
        continue;
      }
      const id = terminalUUID++;
      const finalTransition = -id;

      this.nodeToId.set( node, id );
      this.idToNode.set( id, node );
      this.transitionToNode.set( finalTransition, node );
    }
  }

  typecheck( node: Id | StringNode | RegexpNode ) {
    if ( node.type === "Id" ) {
      return this.typecheckDefinition( this.getRule( node.name ) );
    }
    return this.typecheckDefinition( node );
  }

  typecheckDefinition( node: ParserRule | LexerRule | StringNode | RegexpNode ) {
    let id = this.nodeToTypeId.get( node );
    if ( id == null ) {
      if ( node.type === "ParserRule" ) {
        id = node.name;
      } else {
        id = `$${this.nodeToId.get( node )}`;
      }
      this.nodeToTypeId.set( node, id );

      let code;
      if ( node.type === "ParserRule" ) {
        code = `export interface ${id} extends $Base<'${id}'> {${Array.from( node.names.names.entries() ).map(
          ( [ name, names ] ) => {
            const isArray = node.names.arrays.has( name );
            const isOptional = node.names.optionals.has( name ) && !isArray;

            return `${name}:${isArray ? "(" : ""}${
              Array.from( new Set( names.map( n => this.typecheck( n.item ) ) ) ).join( "|" )
            }${isOptional ? "|null" : ""}${isArray ? ")[]" : ""};`;
          }
        ).join( "" )}};`;
      } else {
        const label = node.type === "LexerRule" ? node.name : node.raw;
        code = `export type ${id} = {id:${this.nodeToId.get( node )};label:${JSON.stringify( label )};image:string;};`;
      }
      this.types.push( code );
    }
    return id;
  }

  generate() {
    return generateParser( this );
  }

}
