import { isBoolean, isNumber } from "./typechecking";
import { YargsOptions, Schema, Scope, CliContext, pad, Type, TypeNotIdentifier, TypeDeclaration, TypeProperty, TypeObject, TypeTuple, OptionalType, ArrayType, UnionType, TypeLiteral, BooleanNode, NumberNode, StringNode, JsNode, Decorator } from "./common";
import TYPES from "./types";

const decamelize = require( "decamelize" );

export class CliCompiler {

  private allAlias: string[];
  private yargsOpts: YargsOptions;
  private defaults: { [key: string]: string };
  private optionLines: string[][];
  private optionsLength: number;

  constructor() {
    this.allAlias = [];
    this.yargsOpts = {
      alias: {},
      array: [],
      boolean: [],
      coerce: {},
      count: [],
      string: [],
      narg: {},
      number: []
    };
    this.defaults = {};
    this.optionLines = [];
    this.optionsLength = 0;
  }

  start( ast: Schema ) {
    return this.compileSchema( ast, {
      scope: new Scope(),
      path: [],
      stack: new Set()
    } );
  }

  compileSchema( { types }: Schema, ctx: CliContext ) {

    for ( const t of types ) {
      ctx.scope.bind( t.name, t );
    }

    const root = ctx.scope.get( "Schema" );
    /* istanbul ignore if */
    if ( !root ) {
      throw new Error( "You need to define a type called 'Schema' that will work as root" );
    }

    this.compileType( root, ctx );

    let yargOpts = "{\n";
    for ( const [ key, value ] of Object.entries( this.yargsOpts ) ) {
      if ( key === "coerce" ) {
        yargOpts += `coerce:{\n`;
        for ( const [ key, value ] of Object.entries( this.yargsOpts.coerce ) ) {
          yargOpts += `${JSON.stringify( key )}:${value},\n`;
        }
        yargOpts += `},\n`;
      } else {
        yargOpts += `${key}:${JSON.stringify( value )},\n`;
      }
    }
    yargOpts += `}`;

    let helpArray = [];
    if ( this.optionLines.length ) {
      helpArray.push( "Options:" );
      for ( const line of this.optionLines ) {
        line[ 0 ] = pad( line[ 0 ], this.optionsLength );
        helpArray.push(
          line.filter( Boolean ).join( " " )
        );
      }
    }

    let code = "{\n";
    code += `help:${JSON.stringify( helpArray.join( "\n" ) )},\n`;
    code += `allAlias:${JSON.stringify( this.allAlias )},\n`;
    code += `yargsOpts:${yargOpts},\n`;
    code += `}`;
    return code;
  }

  compileType( node: Type, ctx: CliContext ) {
    if ( node.type === "Identifier" ) {
      if ( TYPES.has( node.name ) ) {
        return this.compileBuilt( node.name, ctx );
      }
      return this.compileTypeNotIdentifier( ctx.scope.find( node ), ctx );
    }
    if ( node.type === "String" || node.type === "Number" || node.type === "Boolean" ) {
      return this.compileLiteral( node, ctx );
    }
    return this.compileTypeNotIdentifier( node, ctx );
  }

  compileTypeNotIdentifier( node: TypeNotIdentifier, ctx: CliContext ) {
    if ( ctx.stack.has( node ) ) {
      return;
    }
    ctx.stack.add( node );

    switch ( node.type ) {
      case "TypeDeclaration":
        if ( node.init ) {
          this.compileTypeInit( node, ctx );
        } else {
          this.compileTypeObject( node, ctx );
        }
        break;
      case "TypeObject":
        this.compileTypeObject( node, ctx );
        break;
      case "TypeProperty":
        this.compileTypeProperty( node, ctx );
        break;
      case "TypeTuple":
        this.compileTypeTuple( node, ctx );
        break;
      case "Union":
        this.compileUnion( node, ctx );
        break;
      case "Array":
        this.compileArray( node, ctx );
        break;
      case "Optional":
        this.compileOptional( node, ctx );
        break;
      /* istanbul ignore next */
      default:
        throw new Error( "Assertion error" );
    }

    ctx.stack.delete( node );
  }

  compileTypeObject( node: ( TypeDeclaration & { properties: TypeProperty[] } ) | TypeObject, ctx: CliContext ) {
    for ( const prop of node.properties ) {
      ctx.path.push( decamelize( prop.name, "-" ) );
      this.compileType( prop, ctx );
      ctx.path.pop();
    }
    this.applyDecorators( node, ctx, node.decorators );
  }

  compileTypeProperty( node: TypeProperty, ctx: CliContext ) {
    this.compileType( node.typeSignature, ctx );
    this.applyDecorators( node, ctx, node.decorators );
  }

  compileTypeInit( node: TypeDeclaration & { init: Type }, ctx: CliContext ) {
    this.compileType( node.init, ctx );
    this.applyDecorators( node, ctx, node.decorators );
  }

  compileTypeTuple( node: TypeTuple, ctx: CliContext ) {
    for ( let i = 0; i < node.types.length; i++ ) {
      ctx.path.push( decamelize( `${i}`, "-" ) );
      this.compileType( node.types[ i ], ctx );
      ctx.path.pop();
    }
  }

  compileOptional( node: OptionalType, ctx: CliContext ) {
    this.compileType( node.type1, ctx );
  }

  compileArray( node: ArrayType, ctx: CliContext ) {
    if ( isBoolean( node.type1 ) ) {
      this.yargsOpts.array.push( {
        key: ctx.path.join( "." ),
        boolean: true
      } );
    } else if ( isNumber( node.type1 ) ) {
      this.yargsOpts.array.push( {
        key: ctx.path.join( "." ),
        number: true
      } );
    } else {
      this.yargsOpts.array.push( ctx.path.join( "." ) );
    }
  }

  compileUnion( node: UnionType, ctx: CliContext ) {
    this.compileType( node.type1, ctx );
    this.compileType( node.type2, ctx );
  }

  compileBuilt( name: string, ctx: CliContext ) {
    if (
      name === "array" || name === "boolean" ||
      name === "string" || name === "number"
    ) {
      this.yargsOpts[ name ].push( ctx.path.join( "." ) );
    }
  }

  compileLiteral( node: TypeLiteral, ctx: CliContext ) {
    switch ( node.type ) {
      case "Number":
        this.yargsOpts.number.push( ctx.path.join( "." ) );
        break;
      case "String":
        this.yargsOpts.string.push( ctx.path.join( "." ) );
        break;
      case "Boolean":
        this.yargsOpts.boolean.push( ctx.path.join( "." ) );
        break;
      /* istanbul ignore next */
      default:
        throw new Error( "Assertion error" );
    }
  }

  typeToString( node: Type, ctx: CliContext ): string {
    if ( node.type === "Identifier" ) {
      if ( TYPES.has( node.name ) ) {
        return node.name;
      }
      node = ctx.scope.find( node );
    }

    switch ( node.type ) {
      case "String":
        return "string";
      case "Number":
        return "number";
      case "TypeDeclaration":
        if ( node.init ) {
          return this.typeToString( node.init, ctx );
        }
        return "object";
      case "TypeObject":
        return "object";
      case "TypeProperty":
        return this.typeToString( node.typeSignature, ctx );
      case "TypeTuple":
        return `[${node.types.map( t => this.typeToString( t, ctx ) ).join( ", " )}]`;
      case "Union":
        return `${this.typeToString( node.type1, ctx )} | ${this.typeToString( node.type2, ctx )}`;
      case "Array":
        return "array";
      case "Optional":
        return `${this.typeToString( node.type1, ctx )}?`;
      /* istanbul ignore next */
      default:
        throw new Error( "Assertion error" );
    }
  }

  suffixDefault( d: BooleanNode | NumberNode | StringNode | JsNode ) {
    if ( d.type === "Boolean" || d.type === "Number" ) {
      return `(default: ${d.raw})`;
    }
    if ( d.type === "String" && d.raw.length < 15 ) {
      return `(default: ${d.raw})`;
    }
    return "";
  }

  applyDecorators( node: TypeNotIdentifier, ctx: CliContext, decorators: Decorator[] ) {
    const sortedDecorators = decorators.sort(
      ( a, b ) => ( a.name === "description" ? 1 : b.name === "description" ? -1 : 0 )
    );

    for ( const decorator of sortedDecorators ) {
      const args = decorator.arguments;
      switch ( decorator.name ) {
        case "alias": {
          if ( args.length === 0 ) {
            throw new Error( "@alias should have at least 1 argument" );
          }
          const key = ctx.path.join( "." );
          const arr = this.yargsOpts.alias[ key ] = this.yargsOpts.alias[ key ] || [];
          for ( const arg of args ) {
            if ( arg.type !== "String" ) {
              throw new Error( "@alias arguments must be strings" );
            }
            const alias = JSON.parse( arg.raw );
            arr.push( alias );
            this.allAlias.push( alias );
          }
          break;
        }
        case "coerce": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 ) {
            throw new Error( "@coerce should have 1 argument" );
          }
          const key = ctx.path.join( "." );
          this.yargsOpts.coerce[ key ] = arg0.raw;
          break;
        }
        case "narg": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 || arg0.type !== "Number" ) {
            throw new Error( "@narg should have 1 number argument" );
          }
          const key = ctx.path.join( "." );
          this.yargsOpts.narg[ key ] = Number.parseInt( arg0.raw, 10 );
          break;
        }
        case "count": {
          if ( args.length !== 0 ) {
            throw new Error( "@count should have 0 arguments" );
          }
          const key = ctx.path.join( "." );
          this.yargsOpts.count.push( key );
          break;
        }
        case "default": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 ) {
            throw new Error( "@default should have 1 argument" );
          }
          const key = ctx.path.join( "." );
          this.defaults[ key ] = this.suffixDefault( arg0 );
          break;
        }
        case "description": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 || arg0.type !== "String" ) {
            throw new Error( "@description should have 1 string argument" );
          }

          const key = ctx.path.join( "." );
          const description = JSON.parse( arg0.raw );
          const typeStr = this.typeToString( node, ctx );

          const alias = this.yargsOpts.alias[ key ];
          const aliasText = alias ? `, ${alias.map( a => `-${a}` ).join( ", " )}` : "";

          const line = [
            `  --${key === "--" ? "" : decamelize( key, "-" )}${aliasText}`,
            description,
            this.defaults[ key ] || "",
            typeStr ? `[${typeStr}]` : ""
          ];

          this.optionLines.push( line );

          if ( this.optionsLength < line[ 0 ].length ) {
            this.optionsLength = line[ 0 ].length;
          }
          break;
        }
        default:
      }
    }
  }

}
