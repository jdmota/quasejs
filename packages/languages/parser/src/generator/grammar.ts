import generateParser from "./parser/generate-parser";
import { LexerTokens } from "./tokenizer/create-automaton";
import { printLoc } from "./utils";
import GrammarParser, { StringNode, RegexpNode, Id, Rule, LexerRule, ParserRule, Node } from "./grammar-parser";
import ChoicesHandler from "./choices-handler";

export default class Grammar {

  choiceHandlers: ChoicesHandler[];
  lexerRules: Map<string, LexerRule>;
  parserRules: Map<string, ParserRule>;
  rules: Map<string, Rule>;
  firstRule: Rule;
  ids: Map<string, Id[]>;
  terminals: ( StringNode | RegexpNode )[];
  nodeToId: Map<LexerTokens, number>;
  idToNode: Map<number, LexerTokens>;

  constructor( grammarText: string ) {
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

  generate() {
    return generateParser( this );
  }

}
