// @flow
import { Parser as BaseParser } from "@quase/parser";
import { type Position } from "../../../parser/src/tokenizer";
import { type Token, tokens as tt, keywords, modifiers } from "./tokens";
import type {
  Node, Modifiers, Program, Decorator, VariableDeclaration, Declaration,
  ExportDeclaration, ImportDeclaration, TemplateLiteral,
  Expression, SpreadElement, CallExpression, Block,
  For, While, DoWhile, Binding, BindingAtom, AssignmentPattern, RestElement,
  IdentifierReference, IdentifierPropKey, IdentifierDefinition, IdentifierReserved,
  IdentifierLabelReference, IdentifierLabelDefinition,
  MetaProperty, TemplateElement, FunctionExpression, ClassExpression,
  ArrayPattern, ObjectPattern, ObjectExpression
} from "./nodes";
import { Tokenizer } from "./tokenizer";

export class Parser extends BaseParser<Token> {

  constructor( { input }: { input: string } ) {
    super( new Tokenizer( input ) );
  }

  parse(): Program {
    const start = this.startNode();
    const body = [];

    while ( !this.match( tt.eof ) ) {
      body.push( this.parseStatement( false ) );
    }

    return {
      type: "Program",
      body,
      loc: this.locNode( start )
    };
  }

  parseStatement( inClass: boolean ) {
    const decorators = this.parseMaybeDecorators();
    const stmt = this.parseStatementContent( inClass );
    if ( stmt.type === "ClassExpression" || inClass ) {
      stmt.decorators = decorators;
    } else if ( decorators ) {
      throw this.error( "You can only use decorators with classes" );
    }
    return stmt;
  }

  parseDecorators(): Decorator[] {
    const decorators = [];
    while ( this.match( tt.at ) ) {
      decorators.push( this.parseDecorator() );
    }
    return decorators;
  }

  parseDecorator(): Decorator {
    const start = this.startNode();
    this.expect( tt.at );

    let expr = this.parseIdentifierReference();
    const start2 = expr.loc.start;

    while ( this.eat( tt.dot ) ) {
      expr = {
        type: "MemberExpression",
        object: expr,
        property: this.parseIdentifierPropKey(),
        computed: false,
        optional: false,
        loc: this.locNode( start2 )
      };
    }

    if ( this.eat( tt.parenL ) ) {
      expr = {
        type: "CallExpression",
        callee: expr,
        arguments: this.parseExprList( tt.parenR ),
        optional: false,
        loc: this.locNode( start2 )
      };
    }

    return {
      type: "Decorator",
      expression: expr,
      loc: this.locNode( start )
    };
  }

  parseMaybeDecorators() {
    return this.match( tt.at ) ? this.parseDecorators() : null;
  }

  parseIdentifierReference(): IdentifierReference {
    const start = this.startNode();
    const { token } = this;
    let name;

    if ( token.label === "identifier" ) {
      if ( token.keyword ) {
        throw this.error( `${token.value} is a reserved keyword` );
      }
      name = token.value;
    } else {
      throw this.unexpected();
    }

    this.next();

    return {
      type: "Identifier",
      name,
      idType: "reference",
      loc: this.locNode( start )
    };
  }

  parseIdentifierLabelReference(): IdentifierLabelReference {
    const start = this.startNode();
    const { token } = this;
    let name;

    if ( token.label === "identifier" ) {
      if ( token.keyword ) {
        throw this.error( `${token.value} is a reserved keyword` );
      }
      name = token.value;
    } else {
      throw this.unexpected();
    }

    this.next();

    return {
      type: "Identifier",
      name,
      idType: "labelReference",
      loc: this.locNode( start )
    };
  }

  parseIdentifierPropKey(): IdentifierPropKey {
    const start = this.startNode();
    const { token } = this;
    let name;

    if ( token.label === "identifier" ) {
      name = token.value;
    } else if ( token.label === "number" && token.integer && !token.bigint && !token.float ) {
      name = token.raw;
    } else {
      throw this.unexpected();
    }

    this.next();

    return {
      type: "Identifier",
      name,
      idType: "propKey",
      loc: this.locNode( start )
    };
  }

  parseIdentifierDefinition( { getAnnotation, mutable }: { getAnnotation?: ?boolean, mutable?: ?boolean } ): IdentifierDefinition {
    const start = this.startNode();
    const { token } = this;
    let name;

    if ( token.label === "identifier" ) {
      if ( token.keyword ) {
        throw this.error( `${token.value} is a reserved keyword` );
      }
      name = token.value;
    } else {
      throw this.unexpected();
    }

    this.next();

    return {
      type: "Identifier",
      name,
      idType: "definition",
      mutable,
      typeAnnotation: this.parseAnnotation( getAnnotation ),
      loc: this.locNode( start )
    };
  }

  parseIdentifierLabelDefinition(): IdentifierLabelDefinition {
    const start = this.startNode();
    const { token } = this;
    let name;

    if ( token.label === "identifier" ) {
      if ( token.keyword ) {
        throw this.error( `${token.value} is a reserved keyword` );
      }
      name = token.value;
    } else {
      throw this.unexpected();
    }

    this.next();

    return {
      type: "Identifier",
      name,
      idType: "labelDefinition",
      loc: this.locNode( start )
    };
  }

  parseIdentifierReserved(): IdentifierReserved {
    const start = this.startNode();
    const { token } = this;
    let name;

    if ( token.label === "identifier" ) {
      name = token.value;
    } else {
      throw this.unexpected();
    }

    this.next();

    return {
      type: "Identifier",
      name,
      idType: "reserved",
      loc: this.locNode( start )
    };
  }

  parseExprList( close: Token ): Array<Expression> {
    return this.parseList(
      tt.comma,
      close,
      () => this.parseExprListItem()
    );
  }

  parseExprListWithEmpty( close: Token ): Array<Expression | null> {
    return this.parseListWithEmptyItems(
      tt.comma,
      close,
      () => this.parseExprListItem()
    );
  }

  parseExprListItem(): SpreadElement | Expression {
    return this.match( tt.ellipsis ) ? this.parseSpread() : this.parseExpression();
  }

  parseSpread(): SpreadElement {
    const start = this.startNode();
    this.next();
    return {
      type: "SpreadElement",
      argument: this.parseExpression(),
      loc: this.locNode( start )
    };
  }

  parseRest( { getAnnotation, mutable }: { getAnnotation?: ?boolean, mutable?: ?boolean } ): RestElement {
    const start = this.startNode();
    this.next();
    return {
      type: "RestElement",
      argument: this.parseIdentifierDefinition( {} ),
      typeAnnotation: this.parseAnnotation( getAnnotation ),
      mutable,
      loc: this.locNode( start )
    };
  }

  parseExpression( inTypeAnnotation: ?boolean ): Expression {
    const start = this.startNode();
    const left = this.parseMaybeConditional();
    const { token } = this;

    if ( !inTypeAnnotation && token.isAssign ) {
      this.checkLVal( left, "assignment expression" );
      this.next();
      return {
        type: "AssignmentExpression",
        operator: token.op,
        left,
        right: this.parseExpression(),
        loc: this.locNode( start )
      };
    }

    return left;
  }

  parseMaybeConditional(): Expression {
    const start = this.startNode();
    const expr = this.parseExprOps();

    if ( this.eat( tt.question ) ) {
      const consequent = this.parseExpression();
      this.expect( tt.colon );
      const alternate = this.parseExpression();
      return {
        type: "ConditionalExpression",
        test: expr,
        consequent,
        alternate,
        loc: this.locNode( start )
      };
    }

    return expr;
  }

  parseExprOps(): Expression {
    const start = this.startNode();
    const expr = this.parseMaybeUnary();
    return this.parseExprOp( expr, start, -1 );
  }

  parseExprOp( left: Expression, leftStart: Position, minPrec: number ): Expression {
    const token = this.token;
    if ( token.binop ) {

      const binop = token.binop;
      const operator = token.value;

      if ( binop > minPrec ) {
        /*
        -5 ** 6 // Invalid
        (-5) ** 6
        -(5 ** 6)
        */
        if (
          operator === "**" &&
          left.type === "UnaryExpression"
        ) {
          throw this.error(
            "An unary expression is not allowed in the left-hand side of an exponentiation expression. Consider enclosing the expression in parentheses.",
            left.argument.loc.start
          );
        }

        this.next();

        const rightStart = this.startNode();
        const right = this.parseExprOp(
          this.parseMaybeUnary(),
          rightStart,
          token.rightAssociative ? binop - 1 : binop
        );

        const node = {
          type: "BinaryExpression",
          left,
          right,
          operator,
          loc: this.locNode( leftStart )
        };

        return this.parseExprOp( node, leftStart, minPrec );
      }
    }
    return left;
  }

  parseMaybeUnary(): Expression {
    let { token } = this;

    if ( token.prefix ) {
      const start = this.startNode();
      const operator = token.value;
      this.next();

      if ( operator === "--" || operator === "++" ) {
        const argument = this.parseMaybeUnary();
        this.checkLVal( argument, "prefix operation" );
        return {
          type: "UpdateExpression",
          prefix: true,
          operator,
          argument,
          loc: this.locNode( start )
        };
      }

      const argument = this.parseMaybeUnary();
      return {
        type: "UnaryExpression",
        prefix: true,
        operator,
        argument,
        loc: this.locNode( start )
      };
    }

    const start = this.startNode();
    let expr = this.parseExprSubscripts();

    token = this.token;

    while ( token.postfix ) {

      const operator = token.value;
      this.next();

      if ( operator === "--" || operator === "++" ) {
        this.checkLVal( expr, "postfix operation" );
        expr = {
          type: "UpdateExpression",
          prefix: false,
          argument: expr,
          operator,
          loc: this.locNode( start )
        };
      } else {
        expr = {
          type: "UnaryExpression",
          prefix: false,
          argument: expr,
          operator,
          loc: this.locNode( start )
        };
      }

      token = this.token;
    }
    return expr;
  }

  parseExprSubscripts() {
    const start = this.startNode();
    const expr = this.parseExprAtom();
    return this.parseSubscripts( expr, start );
  }

  parseSubscripts( base: Expression, start: Position, noCalls: ?boolean ) {
    const state = { stop: false };
    do {
      base = this.parseSubscript( base, start, state, noCalls );
    } while ( !state.stop );
    return base;
  }

  parseNoCallExpr() {
    const start = this.startNode();
    return this.parseSubscripts( this.parseExprAtom(), start, true );
  }

  /** @param state Set 'state.stop = true' to indicate that we should stop parsing subscripts. */
  parseSubscript( base: Expression, start: Position, state: { stop: boolean }, noCalls?: ?boolean ) {
    if ( this.eat( tt.bang ) ) {
      return {
        type: "NonNullExpression",
        expression: base,
        loc: this.locNode( start )
      };
    } else if ( !noCalls && this.eat( tt.doubleColon ) ) {
      state.stop = true;
      const node = {
        type: "BindExpression",
        object: base,
        callee: this.parseNoCallExpr(),
        loc: this.locNode( start )
      };
      return this.parseSubscripts( node, start );
    } else if ( this.match( tt.questionParenL ) ) {

      if ( noCalls ) {
        state.stop = true;
        return base;
      }
      this.next();

      return {
        type: "CallExpression",
        callee: base,
        optional: true,
        arguments: this.parseExprList( tt.parenR ),
        loc: this.locNode( start )
      };
    } else if ( this.eat( tt.questionBracketL ) ) {

      const property = this.parseExpression();
      this.expect( tt.bracketR );
      return {
        type: "MemberExpression",
        object: base,
        property,
        computed: true,
        optional: true,
        loc: this.locNode( start )
      };
    } else if ( this.match( tt.questionDot ) ) {

      if ( noCalls && this.lookahead() === tt.parenL ) {
        state.stop = true;
        return base;
      }
      this.next();

      if ( this.eat( tt.bracketL ) ) {
        const property = this.parseExpression();
        this.expect( tt.bracketR );
        return {
          type: "MemberExpression",
          object: base,
          property,
          computed: true,
          optional: true,
          loc: this.locNode( start )
        };
      } else if ( this.eat( tt.parenL ) ) {
        return {
          type: "CallExpression",
          callee: base,
          arguments: this.parseExprList( tt.parenR ),
          optional: true,
          loc: this.locNode( start )
        };
      }
      return {
        type: "MemberExpression",
        object: base,
        property: this.parseIdentifierPropKey(),
        computed: false,
        optional: true,
        loc: this.locNode( start )
      };
    } else if ( this.eat( tt.dot ) ) {
      return {
        type: "MemberExpression",
        object: base,
        property: this.parseIdentifierPropKey(),
        computed: false,
        optional: false,
        loc: this.locNode( start )
      };
    } else if ( this.eat( tt.bracketL ) ) {
      const property = this.parseExpression();
      this.expect( tt.bracketR );
      return {
        type: "MemberExpression",
        object: base,
        property,
        computed: true,
        optional: false,
        loc: this.locNode( start )
      };
    } else if ( !noCalls && this.match( tt.parenL ) ) {
      this.next();
      return this.checkCallExpression( {
        type: "CallExpression",
        callee: base,
        arguments: this.parseExprList( tt.parenR ),
        optional: false,
        loc: this.locNode( start )
      } );
    } else if ( this.match( tt.backQuote ) || this.match( tt.quote ) ) {
      return {
        type: "TaggedTemplateExpression",
        tag: base,
        quasi: this.parseTemplate( this.token ),
        loc: this.locNode( start )
      };
    }
    state.stop = true;
    return base;
  }

  parseExprAtom(): Expression {
    const { token } = this;

    switch ( token ) {

      case keywords.null: {
        const start = this.startNode();
        this.next();
        return {
          type: "NullLiteral",
          loc: this.locNode( start )
        };
      }

      case keywords.true:
      case keywords.false: {
        const start = this.startNode();
        this.next();
        return {
          type: "BooleanLiteral",
          value: token === keywords.true,
          loc: this.locNode( start )
        };
      }

      case tt.backQuote:
      case tt.quote:
        return this.parseTemplate( this.token );

      case tt.parenL:
        return this.parseParenExpression();

      case keywords.new: {
        const start = this.startNode();
        this.next();
        if ( this.eat( tt.bracketL ) ) {
          return {
            type: "ArrayExpression",
            elements: this.parseExprList( tt.bracketR ),
            loc: this.locNode( start )
          };
        }
        if ( this.match( tt.braceL ) ) {
          const node = this.parseObjectExpression();
          node.loc.start = start;
          return node;
        }
        throw this.unexpected();
      }

      case tt.braceL:
        return this.parseBlock();

      case keywords.debugger: {
        const start = this.startNode();
        this.next();
        return {
          type: "Debugger",
          loc: this.locNode( start )
        };
      }

      case keywords.if: {
        const start = this.startNode();
        this.next();
        const test = this.parseExpression();
        return {
          type: "If",
          test,
          consequent: this.parseConsequent( test.type === "SequenceExpression" ),
          alternate: this.eat( keywords.else ) ? this.parseConsequent( true ) : null,
          loc: this.locNode( start )
        };
      }

      case keywords.try: {
        const start = this.startNode();
        this.next();
        const body = this.parseConsequent( true );
        let handler, finalizer;
        if ( this.match( keywords.catch ) ) {
          const startHandler = this.startNode();
          let param;
          this.next();
          if ( this.eat( tt.parenL ) ) {
            param = this.parseBindingAtom( { getAnnotation: true } );
            this.expect( tt.parenR );
          }
          handler = {
            type: "CatchClause",
            param,
            body: this.parseConsequent( true ),
            loc: this.locNode( startHandler )
          };
        }
        if ( this.eat( keywords.finally ) ) {
          finalizer = this.parseConsequent( true );
        }
        return {
          type: "Try",
          body,
          handler,
          finalizer,
          loc: this.locNode( start )
        };
      }

      case keywords.this: {
        const start = this.startNode();
        this.next();
        return {
          type: "ThisExpression",
          label: this.eat( tt.at ) ? this.parseIdentifierReference() : null,
          loc: this.locNode( start )
        };
      }

      case tt.question: {
        const start = this.startNode();
        this.next();
        return {
          type: "OptionalExpression",
          argument: this.parseMaybeUnary(),
          loc: this.locNode( start )
        };
      }

      case keywords.return: {
        // TODO make sure we are in a function
        const start = this.startNode();
        this.next();
        return {
          type: "ReturnExpression",
          argument: this.parseExpression(),
          loc: this.locNode( start )
        };
      }

      case keywords.throw: {
        const start = this.startNode();
        this.next();
        return {
          type: "ThrowExpression",
          argument: this.parseExpression(),
          loc: this.locNode( start )
        };
      }

      case keywords.yield: {
        // TODO make sure we are in a generator function
        const start = this.startNode();
        this.next();
        return {
          type: "YieldExpression",
          delegate: !!this.eat( tt.star ),
          argument: this.parseExpression(),
          loc: this.locNode( start )
        };
      }

      case keywords.await: {
        // TODO make sure we are in a async function
        const start = this.startNode();
        this.next();
        return {
          type: "AwaitExpression",
          delegate: !!this.eat( tt.star ),
          argument: this.parseExpression(),
          loc: this.locNode( start )
        };
      }

      case keywords.super: {
        // TODO make sure we are in a class constructor
        const start = this.startNode();
        this.next();
        return {
          type: "Super",
          loc: this.locNode( start )
        };
      }

      case keywords.import: {
        if ( this.lookahead() === tt.dot ) {
          return this.parseMetaProperty();
        }

        const start = this.startNode();
        this.next();
        if ( !this.match( tt.parenL ) ) {
          this.unexpected( tt.parenL );
        }
        return {
          type: "Import",
          loc: this.locNode( start )
        };
      }

      case keywords.break: {
        const start = this.startNode();
        this.next();
        return {
          type: "Break",
          label: this.eat( tt.at ) ? this.parseIdentifierLabelReference() : null,
          loc: this.locNode( start )
        };
      }

      case keywords.continue: {
        const start = this.startNode();
        this.next();
        return {
          type: "Continue",
          label: this.eat( tt.at ) ? this.parseIdentifierLabelReference() : null,
          loc: this.locNode( start )
        };
      }

      default: {

        if ( token.isLoop ) {
          return this.parseLoop();
        }

        if ( token.label === "regexp" ) {
          const start = this.startNode();
          this.next();
          return {
            type: "RegExpLiteral",
            value: token,
            loc: this.locNode( start )
          };
        }

        if ( token.label === "number" ) {
          const start = this.startNode();
          this.next();
          return {
            type: "NumericLiteral",
            value: token,
            loc: this.locNode( start )
          };
        }

        if ( token.label === "char" ) {
          const start = this.startNode();
          this.next();
          return {
            type: "CharLiteral",
            value: token,
            loc: this.locNode( start )
          };
        }

        if ( token === keywords.fun && this.lookahead() === tt.dot ) {
          return this.parseMetaProperty();
        }

        if ( token.label === "identifier" && !token.keyword ) {
          if ( this.lookahead() === tt.at ) {
            const start = this.startNode();
            const id = this.parseIdentifierLabelDefinition();
            this.next();
            return {
              type: "Labeled",
              label: id,
              loop: this.parseLoop(),
              loc: this.locNode( start )
            };
          }
          return this.parseIdentifierReference();
        }

        return this.parseMaybeFunClass();
      }
    }
  }

  parseLoop(): For | While | DoWhile {

    switch ( this.token ) {

      case keywords.while: {
        const start = this.startNode();
        this.next();
        const test = this.parseExpression();
        return {
          type: "While",
          test,
          block: this.parseConsequent( test.type === "SequenceExpression" ),
          loc: this.locNode( start )
        };
      }

      case keywords.for: {
        const start = this.startNode();
        this.next();
        const _await = !!this.eat( keywords.await );
        const usedParen = !!this.eat( tt.parenL );
        const init = this.match( tt.semi ) ? null : this.parseStatementContent( false, true );
        if (
          init &&
          init.type === "VariableDeclaration" &&
          init.declarations.length === 1 &&
          !init.declarations[ 0 ].init &&
          this.eat( keywords.in )
        ) {
          const _in = this.parseExpression();
          if ( usedParen ) {
            this.expect( tt.parenR );
          }
          return {
            type: "For",
            await: _await,
            usedParen,
            init,
            in: _in,
            block: this.parseConsequent( usedParen ),
            loc: this.locNode( start )
          };
        }
        this.expect( tt.semi );
        const test = this.match( tt.semi ) ? null : this.parseExpression();
        this.expect( tt.semi );
        let update;
        if ( usedParen ) {
          update = this.match( tt.parenR ) ? null : this.parseExpression();
          this.expect( tt.parenR );
        } else {
          update = this.match( tt.braceL ) || this.match( tt.colon ) ? null : this.parseExpression();
        }
        return {
          type: "For",
          await: _await,
          usedParen,
          init,
          test,
          update,
          block: this.parseConsequent( usedParen ),
          loc: this.locNode( start )
        };
      }

      case keywords.do: {
        const start = this.startNode();
        this.next();
        const body = this.parseConsequent( true );
        this.expect( keywords.while );
        const test = this.parseExpression();
        return {
          type: "DoWhile",
          body,
          test,
          loc: this.locNode( start )
        };
      }

      default:
        throw this.unexpected();

    }

  }

  parseConsequent( allowExp: boolean ): Expression {
    if ( this.match( tt.braceL ) ) {
      return this.parseBlock();
    }
    // if ...: exp
    // if (...): exp
    // if (...) exp
    if ( this.eat( tt.colon ) || allowExp ) {
      return this.parseExpression();
    }
    throw this.unexpected( tt.colon );
  }

  parseBlock(): Block {
    const start = this.startNode();
    const body = [];
    this.expect( tt.braceL );
    while ( !this.eat( tt.braceR ) ) {
      body.push( this.parseStatement( false ) );
    }
    return {
      type: "Block",
      body,
      loc: this.locNode( start )
    };
  }

  parseParenExpression(): Expression {
    const start = this.startNode();

    this.expect( tt.parenL );

    const expressions = this.parseList(
      tt.comma,
      tt.parenR,
      () => this.parseExpression(),
      true
    );

    return {
      type: "SequenceExpression",
      expressions,
      loc: this.locNode( start )
    };
  }

  parseTemplateElement( close: Token ): TemplateElement {
    const { token } = this;

    if ( token.label !== "template" ) {
      throw this.unexpected();
    }

    const start = this.startNode();

    this.next();
    return {
      type: "TemplateElement",
      value: token,
      tail: this.match( close ),
      loc: this.locNode( start )
    };
  }

  parseTemplate( close: Token ): TemplateLiteral {
    const start = this.startNode();
    this.expect( close );
    const expressions = [];
    let curElt = this.parseTemplateElement( close );
    const quasis = [ curElt ];
    while ( !curElt.tail ) {
      this.expect( tt.dollarBraceL );
      expressions.push( this.parseExpression() );
      this.expect( tt.braceR );
      quasis.push( ( curElt = this.parseTemplateElement( close ) ) );
    }
    this.expect( close );
    return {
      type: "TemplateLiteral",
      expressions,
      quasis,
      loc: this.locNode( start )
    };
  }

  parseObjectExpression(): ObjectExpression {
    const propsSet = new Set();
    const start = this.startNode();

    this.expect( tt.braceL );

    const properties = this.parseList(
      tt.comma,
      tt.braceR,
      () => {
        if ( this.match( tt.ellipsis ) ) {
          return this.parseSpread();
        }

        const startProp = this.startNode();
        const key = this.parseIdentifierPropKey();
        const name = key.name;
        let value;

        if ( this.eat( tt.colon ) ) {
          value = this.parseExpression();
        } else {
          value = {
            type: "Identifier",
            name: key.name,
            idType: "reference",
            loc: key.loc
          };
          if ( keywords[ name ] ) {
            throw this.error( `${name} is a reserved keyword not a variable name` );
          }
        }

        this.checkPropClash( key, propsSet );

        return {
          type: "ObjectProperty",
          key,
          value,
          loc: this.locNode( startProp )
        };
      }
    );

    return {
      type: "ObjectExpression",
      properties,
      loc: this.locNode( start )
    };
  }

  checkPropClash( key: IdentifierPropKey, propsSet: Set<string> ) {
    const name = key.name;
    if ( propsSet.has( name ) ) {
      throw this.error( `Redefinition of ${name} property`, key.loc.start );
    }
    propsSet.add( name );
  }

  parseMetaProperty(): MetaProperty {
    const start = this.startNode();
    const meta = this.parseIdentifierReserved();
    this.expect( tt.dot );
    return {
      type: "MetaProperty",
      meta,
      property: this.parseIdentifierPropKey(),
      loc: this.locNode( start )
    };
  }

  checkCallExpression( node: CallExpression ): CallExpression {
    if ( node.callee.type === "Import" ) {
      if ( node.arguments.length !== 1 ) {
        throw this.error( "import() requires exactly one argument", node.loc.start );
      }

      const importArg = node.arguments[ 0 ];
      if ( importArg && importArg.type === "SpreadElement" ) {
        throw this.error( "... is not allowed in import()", importArg.loc.start );
      }
    }
    return node;
  }

  consumeModifiers(): Modifiers {
    const m = {};
    let token = this.token;
    while ( token.keyword && modifiers[ token.value ] ) {
      m[ token.value ] = true;
      token = this.next();
    }
    return m;
  }

  parseStatementContent( inClass: ?boolean, inFor: ?boolean ) {
    let node;

    if ( inClass ) {
      const start = this.startNode();
      const modifiers = this.consumeModifiers();

      switch ( this.token ) {
        case keywords.val:
        case keywords.var:
          node = this.parseVar( false, modifiers );
          break;
        case keywords.fun:
          node = this.parseFunction( modifiers );
          break;
        case keywords.class:
          node = this.parseClass( modifiers );
          break;
        default:
          if ( this.match( "identifier" ) && this.lookahead() === tt.parenL ) {
            node = this.parseFunction( modifiers, true );
          }
      }

      if ( !node ) {
        throw this.unexpected();
      }

      if ( node.type === "VariableDeclaration" ) {
        this.expect( tt.semi );
      } else {
        this.eat( tt.semi );
      }

      node.loc.start = start;
      node.loc.end = this.endNode();

    } else {

      switch ( this.token ) {
        case keywords.val:
        case keywords.var:
          node = this.parseVar( inFor );
          break;
        case keywords.export:
          node = this.parseExport();
          break;
        case keywords.import: {
          const l = this.lookahead();
          if ( l !== tt.parenL && l !== tt.dot ) {
            node = this.parseImport();
            break;
          }
        }
      }

      if ( !node ) {
        node = this.parseExpression();
      }

      if ( !inFor && ( node.type !== "ExportDeclaration" || !node.declaration ) ) {
        this.expect( tt.semi );
        node.loc.end = this.endNode();
      }
    }

    return node;
  }

  parseDeclaration(): Declaration {
    const { token } = this;
    let node;

    if ( token === keywords.val || token === keywords.var ) {
      node = this.parseVar( false );
    } else {
      node = this.parseMaybeFunClass();
    }

    if ( node.type === "VariableDeclaration" ) {
      this.expect( tt.semi );
    } else {
      this.eat( tt.semi );
    }

    node.loc.end = this.endNode();
    return node;
  }

  parseVar( isFor: ?boolean, modifiers: ?Modifiers ): VariableDeclaration {
    const start = this.startNode();
    const declarations = [];
    let kind;

    if ( this.token.label === "identifier" ) {
      kind = this.token.value;
      if ( kind !== "val" && kind !== "var" ) {
        throw this.unexpected();
      }
    } else {
      throw this.unexpected();
    }

    this.next();

    do {
      const declStart = this.startNode();
      const id = this.parseBindingAtom( { getAnnotation: true } );
      let init = null;

      if ( this.eat( tt.eq ) ) {
        init = this.parseExpression();
      } else {
        if ( id.type !== "Identifier" && !( isFor && this.match( tt.in ) ) ) {
          throw this.error( "Complex binding patterns require an initialization value" );
        }
      }

      declarations.push( {
        type: "VariableDeclarator",
        id,
        init,
        modifiers,
        loc: this.locNode( declStart )
      } );
    } while ( this.eat( tt.comma ) );

    return {
      type: "VariableDeclaration",
      kind,
      declarations,
      loc: this.locNode( start )
    };
  }

  parseMaybeFunClass(): FunctionExpression | ClassExpression {
    const start = this.startNode();
    const modifiers = this.consumeModifiers();
    let node;

    switch ( this.token ) {
      case keywords.fun:
        node = this.parseFunction( modifiers );
        break;
      case keywords.class:
        node = this.parseClass( modifiers );
        break;
      default:
        throw this.unexpected();
    }

    node.loc.start = start;
    return node;
  }

  parseFunction( modifiers: Modifiers, shorthand: ?boolean ): FunctionExpression {
    const start = this.startNode();
    if ( !shorthand ) {
      this.next();
    }
    const id = this.match( "identifier" ) ? this.parseIdentifierDefinition( {} ) : null;
    const params = this.eat( tt.parenL ) ? this.parseBindingList( tt.parenR ) : [];
    const returnType = this.parseAnnotation( true );
    const body = this.eat( tt.eq ) ? this.parseExpression() : this.parseBlock();
    return {
      type: "FunctionExpression",
      modifiers,
      id,
      params,
      returnType,
      body,
      loc: this.locNode( start )
    };
  }

  parseClass( modifiers: Modifiers ): ClassExpression {
    const start = this.startNode();
    this.next();
    const id = this.match( "identifier" ) ? this.parseIdentifierDefinition( {} ) : null;
    const generics = this.eat( tt.parenL ) ? this.parseBindingList( tt.parenR ) : [];
    let _extends;

    if ( this.eat( tt.colon ) || this.eat( keywords.extends ) ) {
      _extends = this.parseList(
        tt.comma,
        tt.braceL,
        () => this.parseExpression(),
        true,
        true
      );
    } else {
      _extends = [];
    }

    // TODO handle constructor

    const classBodyStart = this.startNode();
    const classBodyBody = [];

    this.expect( tt.braceL );
    while ( !this.eat( tt.braceR ) ) {
      classBodyBody.push( this.parseStatement( true ) );
    }

    const body = {
      type: "ClassBody",
      body: classBodyBody,
      loc: this.locNode( classBodyStart )
    };

    return {
      type: "ClassExpression",
      id,
      modifiers,
      generics,
      extends: _extends,
      body,
      loc: this.locNode( start )
    };
  }

  parseAnnotation( getAnnotation: ?boolean ): ?Expression {
    return getAnnotation && this.eat( tt.colon ) ? this.parseExpression( true ) : null;
  }

  parseBindingAtom( { getAnnotation, mutable }: { getAnnotation?: ?boolean, mutable?: ?boolean } ): BindingAtom {
    let node;
    switch ( this.token ) {
      case tt.bracketL: {
        node = this.parseArrayPattern( { getAnnotation, mutable } );
        break;
      }
      case tt.braceL:
        node = this.parseObjectPattern( { getAnnotation, mutable } );
        break;
      default:
        node = this.parseIdentifierDefinition( { getAnnotation, mutable } );
    }
    return node;
  }

  parseArrayPattern( { getAnnotation, mutable }: { getAnnotation?: ?boolean, mutable?: ?boolean } ): ArrayPattern {
    const start = this.startNode();
    this.next();
    return {
      type: "ArrayPattern",
      elements: this.parseBindingListWithEmpty( tt.bracketR ),
      typeAnnotation: this.parseAnnotation( getAnnotation ),
      mutable,
      loc: this.locNode( start )
    };
  }

  parseObjectPattern( { getAnnotation, mutable }: { getAnnotation?: ?boolean, mutable?: ?boolean } ): ObjectPattern {
    const start = this.startNode();

    this.expect( tt.braceL );

    const properties = this.parseList(
      tt.comma,
      tt.braceR,
      step => {
        if ( this.match( tt.ellipsis ) ) {
          step.stop = true;
          return this.parseRest( {} );
        }

        const propStart = this.startNode();
        const key = this.parseIdentifierPropKey();
        const name = key.name;
        let value;

        if ( this.match( tt.eq ) ) {
          value = this.parseMaybeDefault( { start: propStart, left: key } );
        } else if ( this.eat( tt.colon ) ) {
          value = this.parseMaybeDefault();
        } else {
          value = {
            type: "Identifier",
            idType: "definition",
            name: key.name,
            mutable: key.mutable,
            typeAnnotation: key.typeAnnotation,
            loc: key.loc
          };
          if ( keywords[ name ] ) {
            throw this.error( `${name} is a reserved keyword. Use { ${name}: _${name} } e.g. to rename.` );
          }
        }

        return {
          type: "ObjectProperty",
          key,
          value,
          loc: this.locNode( propStart )
        };
      }
    );

    return {
      type: "ObjectPattern",
      properties,
      typeAnnotation: this.parseAnnotation( getAnnotation ),
      mutable,
      loc: this.locNode( start )
    };
  }

  parseBindingList( close: Token ): Array<Binding> {
    return this.parseList(
      tt.comma,
      close,
      step => this.parseBindingListItem( step, close )
    );
  }

  parseBindingListWithEmpty( close: Token ): Array<Binding | null> {
    return this.parseListWithEmptyItems(
      tt.comma,
      close,
      step => this.parseBindingListItem( step, close )
    );
  }

  parseBindingListItem( step: { stop: boolean }, close: Token ): Binding {
    const mutable = close === tt.parenR ? !!( this.eat( keywords.var ) || ( this.eat( keywords.val ), false ) ) : null;
    const isRest = this.match( tt.ellipsis );
    if ( isRest ) {
      step.stop = true;
    }
    return isRest ? this.parseRest( { getAnnotation: true, mutable } ) : this.parseMaybeDefault( { getAnnotation: true, mutable } );
  }

  parseMaybeDefault( info?: {|
    start: Position,
    left: BindingAtom
  |} | {|
    getAnnotation?: ?boolean,
    mutable?: ?boolean
  |} ): BindingAtom | AssignmentPattern {

    let start, left;

    if ( info && info.left ) {
      start = info.start;
      left = info.left;
    } else {
      start = this.startNode();
      left = this.parseBindingAtom( info || {} );
    }

    if ( !this.eat( tt.eq ) ) {
      return left;
    }

    return {
      type: "AssignmentPattern",
      left,
      right: this.parseExpression(),
      loc: this.locNode( start )
    };
  }

  parseImport(): ImportDeclaration {
    const start = this.startNode();
    this.next();
    return {
      type: "ImportDeclaration",
      pattern: this.parseObjectPattern( {} ),
      from: this.parseImportExportFrom(),
      loc: this.locNode( start )
    };
  }

  eatFrom() {
    const { token } = this;
    if ( token.label === "identifier" && token.value === "from" ) {
      this.next();
    } else {
      throw this.unexpected();
    }
  }

  parseImportExportFrom(): TemplateLiteral {
    this.eatFrom();
    const { token } = this;
    if ( token !== tt.quote && token !== tt.backQuote ) {
      throw this.unexpected();
    }
    const string = this.parseTemplate( token );
    if ( string.expressions.length > 0 ) {
      throw this.error( "String should be static", string.loc.start );
    }
    return string;
  }

  parseExport(): ExportDeclaration {
    const start = this.startNode();
    this.next();

    if ( this.token === tt.braceL ) {
      return {
        type: "ExportDeclaration",
        object: this.parseObjectExpression(),
        loc: this.locNode( start )
      };
    }

    const declaration = this.parseDeclaration();
    if ( declaration.type !== "VariableDeclaration" && !declaration.id ) {
      throw this.error( "Missing name in exported declaration.", declaration.loc.start );
    }
    return {
      type: "ExportDeclaration",
      declaration,
      loc: this.locNode( start )
    };
  }

  checkLVal( expr: Node, contextDescription: string ): void {
    switch ( expr.type ) {
      case "Identifier":
        if ( keywords[ expr.name ] ) {
          throw this.error( `${expr.name} is a reserved word`, expr.loc.start );
        }
        break;

      case "MemberExpression":
        break;

      default: {
        throw this.error( `Invalid left-hand side in ${contextDescription}`, expr.loc.start );
      }
    }
  }

}
