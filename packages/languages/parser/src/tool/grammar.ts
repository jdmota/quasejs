import GrammarParser, { StringNode, RegexpNode, Id, Rule, LexerRule, ParserRule, Node } from "./parser/grammar-parser";
import { printLoc } from "./utils";

export type Options = {
  typescript?: boolean;
};

export type LexerTokens = StringNode | RegexpNode | LexerRule;

export default class Grammar {

  options: Options;
  lexerRules: Map<string, LexerRule>;
  parserRules: Map<string, ParserRule>;
  rules: Map<string, Rule>;
  firstRule: Rule;
  ids: Map<string, Id[]>;
  terminals: ( StringNode | RegexpNode )[];
  nodeToId: Map<LexerTokens, number>;
  idToNode: Map<number, LexerTokens>;
  terminalRawToId: Map<string, number>;
  types: string[];
  nodeToTypeId: Map<ParserRule | LexerRule | StringNode | RegexpNode, string>;

  constructor( grammarText: string, options: Options = {} ) {
    this.options = options;

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

  analyseLexer() {
    let terminalUUID = 1;

    for ( const node of this.terminals ) {
      const currId = this.terminalRawToId.get( node.raw );
      if ( currId != null ) {
        this.nodeToId.set( node, currId );
        continue;
      }
      const id = terminalUUID++;

      this.nodeToId.set( node, id );
      this.idToNode.set( id, node );
      this.terminalRawToId.set( node.raw, id );
    }

    for ( const node of this.lexerRules.values() ) {
      const id = terminalUUID++;

      this.nodeToId.set( node, id );
      this.idToNode.set( id, node );
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

}