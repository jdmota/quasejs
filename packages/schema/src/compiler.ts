// @ts-ignore
import Parser from "./parser";
import TYPES from "./types";

const decamelize = require( "decamelize" );

type Schema = {
  type: "Schema";
  types: TypeDeclaration[];
};

type TypeDeclaration = {
  type: "TypeDeclaration";
  name: string;
  decorators: Decorator[];
  properties: TypeProperty[];
  init: undefined;
} | {
  type: "TypeDeclaration";
  name: string;
  decorators: Decorator[];
  properties: undefined;
  init: Type;
};

type TypeProperty = {
  type: "TypeProperty";
  name: string;
  typeSignature: Type;
  decorators: Decorator[];
};

type Decorator = {
  type: "Decorator";
  name: string;
  arguments: ( BooleanNode | NumberNode | StringNode | JsNode )[];
};

type UnionType = {
  type: "Union";
  type1: Type;
  type2: Type;
};

type ArrayType = {
  type: "Array";
  type1: Type;
};

type OptionalType = {
  type: "Optional";
  type1: Type;
};

type TypeObject = {
  type: "TypeObject";
  decorators: Decorator[];
  properties: TypeProperty[];
};

type TypeTuple = {
  type: "TypeTuple";
  types: Type[];
};

type Identifier = {
  type: "Identifier";
  name: string;
};

type BooleanNode = {
  type: "Boolean";
  raw: string;
}

type NumberNode = {
  type: "Number";
  raw: string;
};

type StringNode = {
  type: "String";
  raw: string;
};

type JsNode = {
  type: "Js";
  raw: string;
};

type TypeLiteral = NumberNode | StringNode;

type TypeNotIdentifier = TypeDeclaration | UnionType | ArrayType | OptionalType | TypeObject | TypeProperty | TypeTuple;

type Type = TypeNotIdentifier | TypeLiteral | Identifier;

class Scope {

  map: Map<string, TypeNotIdentifier>;

  constructor() {
    this.map = new Map();
  }

  bind( name: string, node: TypeNotIdentifier ) {
    const curr = this.map.get( name );
    if ( curr ) {
      throw new Error( `Duplicate ${name} declaration` );
    }
    this.map.set( name, node );
  }

  get( name: string ) {
    return this.map.get( name );
  }

  find( node: Identifier ) {
    const curr = this.map.get( node.name );
    if ( curr ) {
      return curr;
    }
    throw new Error( `${node.name} was not defined` );
  }

}

class CircularCheck {

  set: WeakSet<TypeNotIdentifier>;

  constructor() {
    this.set = new WeakSet();
  }

  check( node: TypeNotIdentifier ) {
    if ( this.set.has( node ) ) {
      throw new Error( `Type refers itself` );
    }
  }

  add( node: TypeNotIdentifier ) {
    this.set.add( node );
  }

  remove( node: TypeNotIdentifier ) {
    this.set.delete( node );
  }

}

class TypeInfo {

  id: string;
  map: Map<string, string>;

  constructor( id: string ) {
    this.id = id;
    this.map = new Map();
  }

  /* get( name: string ) {
    return this.map.get( name );
  } */

  getForSure( name: string ) {
    const value = this.map.get( name );
    /* istanbul ignore if */
    if ( value == null ) {
      throw new Error( "Assertion error" );
    }
    return value;
  }

  set( name: string, funId: string ) {
    const oldValue = this.map.get( name );
    this.map.set( name, funId );
    return oldValue;
  }

  toCode() {
    let code = "";
    code += `const ${this.id}={\n`;
    for ( const [ name, funId ] of this.map ) {
      code += `${name}:${funId},\n`;
    }
    code += `};\n`;
    return code;
  }

}

type Context = {
  // To prevent types from refering themselfs
  circular: CircularCheck;
  // Scope
  scope: Scope;
};

type YargsOptions = {
  alias: { [key: string]: string[] };
  array: string[];
  boolean: string[];
  coerce: { [key: string]: string };
  count: string[];
  string: string[];
  narg: { [key: string]: number };
  number: string[];
};

type CliContext = {
  // Scope
  scope: Scope;
  // The current path
  path: string[];
  // To prevent maximum call stack size exceeded
  stack: Set<TypeNotIdentifier>;
};

function pad( str: string, length: number ) {
  while ( str.length < length ) {
    str += " ";
  }
  return str;
}

class CliCompiler {

  allAlias: string[];
  yargsOpts: YargsOptions;
  defaults: { [key: string]: string };
  optionLines: string[][];
  optionsLength: number;

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
    if ( node.type === "String" || node.type === "Number" ) {
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

  compileArray( _: ArrayType, ctx: CliContext ) {
    this.yargsOpts.array.push( ctx.path.join( "." ) );
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
    const sortedDecorators = decorators.sort( ( a, b ) => ( a.name === "description" ? 1 : b.name === "description" ? -1 : 0 ) );

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

class Compiler {

  compiledBuiltins: Map<string, TypeInfo>;
  compiledLiterals: Map<string, TypeInfo>;
  statements: string[];
  typeInfos: Map<TypeNotIdentifier, TypeInfo>;
  typeUuid: number;
  literalUuid: number;
  funUuid: number;

  constructor() {
    this.compiledBuiltins = new Map();
    this.compiledLiterals = new Map();
    this.statements = [];
    this.typeInfos = new Map();
    this.typeUuid = 1;
    this.literalUuid = 1;
    this.funUuid = 1;
  }

  start( ast: Schema ) {
    return this.compileSchema( ast, {
      scope: new Scope(),
      circular: new CircularCheck()
    } );
  }

  compileSchema( { types }: Schema, ctx: Context ) {
    let code = `(()=>{\n`;

    code += `const { runtime } = require( "@quase/schema" );\n`;

    for ( const t of types ) {
      ctx.scope.bind( t.name, t );
    }

    const root = ctx.scope.get( "Schema" );
    if ( !root ) {
      throw new Error( "You need to define a type called 'Schema' that will work as root" );
    }

    const schemaId = this.compileType( root, ctx ).id;

    code += `${this.statements.join( "\n" )}\n`;
    code += `const path = new runtime.Path(null,"");\n`;
    code += `return (...values) => {
      if(values.length===0){
        throw new Error( "If must pass at least one value" );
      }
      const busy = new runtime.Busy();
      const dest = values[0];
      if(values.length>1)path.where="0";
      ${schemaId}.validate(busy,path,dest);
      for(let i=1;i<values.length;i++){
        path.where=i+"";
        ${schemaId}.validate(busy,path,values[i]);
        ${schemaId}.merge(path,path,dest,values[i]);
      }
      path.where="";
      return ${schemaId}.defaults(path,dest);
    };\n`;

    return `${code}})()`;
  }

  genFunId() {
    return `fun${this.funUuid++}`;
  }

  compileInfo( node: TypeNotIdentifier ) {
    let typeInfo = this.typeInfos.get( node );
    let existed = true;
    if ( !typeInfo ) {
      typeInfo = new TypeInfo( `type${this.typeUuid++}` );
      existed = false;
      this.typeInfos.set( node, typeInfo );
    }
    return {
      typeInfo,
      existed
    };
  }

  compileType( node: Type, ctx: Context ): TypeInfo {
    if ( node.type === "Identifier" ) {
      if ( TYPES.has( node.name ) ) {
        return this.compileBuilt( node.name );
      }
      return this.compileTypeNotIdentifier( ctx.scope.find( node ), ctx );
    }
    if ( node.type === "String" || node.type === "Number" ) {
      return this.compileLiteral( node );
    }
    return this.compileTypeNotIdentifier( node, ctx );
  }

  compileTypeNotIdentifier( node: TypeNotIdentifier, ctx: Context ): TypeInfo {
    ctx.circular.check( node );

    let info;

    switch ( node.type ) {
      case "TypeDeclaration":
        if ( node.init ) {
          ctx.circular.add( node );
          info = this.compileTypeInit( node, ctx );
          ctx.circular.remove( node );
        } else {
          info = this.compileTypeObject( node, {
            scope: ctx.scope,
            circular: new CircularCheck()
          } );
        }
        break;
      case "TypeObject":
        info = this.compileTypeObject( node, {
          scope: ctx.scope,
          circular: new CircularCheck()
        } );
        break;
      case "TypeProperty":
        info = this.compileTypeProperty( node, {
          scope: ctx.scope,
          circular: new CircularCheck()
        } );
        break;
      case "TypeTuple":
        info = this.compileTypeTuple( node, {
          scope: ctx.scope,
          circular: new CircularCheck()
        } );
        break;
      case "Union":
        ctx.circular.add( node );
        info = this.compileUnion( node, ctx );
        ctx.circular.remove( node );
        break;
      case "Array":
        info = this.compileArray( node, {
          scope: ctx.scope,
          circular: new CircularCheck()
        } );
        break;
      case "Optional":
        ctx.circular.add( node );
        info = this.compileOptional( node, ctx );
        ctx.circular.remove( node );
        break;
      /* istanbul ignore next */
      default:
        throw new Error( "Assertion error" );
    }
    return info;
  }

  compileTypeObject( node: ( TypeDeclaration & { properties: TypeProperty[] } ) | TypeObject, ctx: Context ) {
    const { typeInfo, existed } = this.compileInfo( node );
    if ( existed ) return typeInfo;

    this.statements.push( `const keys_${typeInfo.id}=[${node.properties.map( p => `'${p.name}'` )}];` );

    // Validate
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `busy.add(path,value);\n`;
      code += `runtime.assertType(path,value,'Object',this);\n`;
      code += `if(!this.additionalProperties) runtime.checkUnrecognized(path,Object.keys(value),keys_${typeInfo.id});\n`;
      for ( const prop of node.properties ) {
        code += `${this.callValidate( prop, ctx, prop.name )};\n`;
      }
      this.fnValidate( typeInfo, code );
    }

    // Merge
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `if(dest===undefined)dest={};else if(this.mergeStrategy==="override")return dest;\n`;
      for ( const prop of node.properties ) {
        code += `dest.${prop.name}=${this.callMerge( prop, ctx, prop.name, prop.name )};\n`;
      }
      code += `if(this.additionalProperties){\n`;
      code += `const otherKeys = Object.keys(value).filter( k => !keys_${typeInfo.id}.includes( k ) );\n`;
      code += `for(const key of otherKeys) if(dest[key]===undefined&&value[key]!==undefined) dest[key]=value[key];\n`;
      code += `}\n`;
      code += `return dest;\n`;
      this.fnMerge( typeInfo, code );
    }

    // Defaults
    {
      let code = "";
      code += `if(value===undefined)value={};\n`;
      for ( const prop of node.properties ) {
        code += `value.${prop.name}=${this.callDefaults( prop, ctx, prop.name )};\n`;
      }
      code += `return value;\n`;
      this.fnDefaults( typeInfo, code );
    }

    this.applyDecorators( typeInfo, node.decorators );
    this.statements.push( typeInfo.toCode() );

    return typeInfo;
  }

  compileTypeProperty( node: TypeProperty, ctx: Context ) {
    if ( node.decorators.length === 0 ) {
      return this.compileType( node.typeSignature, ctx );
    }
    return this.compileTypeWithDecorators( node, node.typeSignature, node.decorators, ctx );
  }

  compileTypeInit( node: TypeDeclaration & { init: Type }, ctx: Context ) {
    if ( node.decorators.length === 0 ) {
      return this.compileType( node.init, ctx );
    }
    return this.compileTypeWithDecorators( node, node.init, node.decorators, ctx );
  }

  compileTypeWithDecorators( parentType: TypeNotIdentifier, type: Type, decorators: Decorator[], ctx: Context ) {
    const { typeInfo, existed } = this.compileInfo( parentType );
    if ( existed ) return typeInfo;

    const innerTypeInfo = this.compileType( type, ctx );

    for ( const [ name, funId ] of innerTypeInfo.map ) {
      typeInfo.set( name, funId );
    }

    this.applyDecorators( typeInfo, decorators );
    this.statements.push( typeInfo.toCode() );

    return typeInfo;
  }

  compileTypeTuple( node: TypeTuple, ctx: Context ) {
    const { typeInfo, existed } = this.compileInfo( node );
    if ( existed ) return typeInfo;

    // Validate
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `busy.add(path,value);\n`;
      code += `runtime.assertType(path,value,'Array',this);\n`;
      code += `if(!this.additionalProperties) runtime.assertSize(path,value.length,${node.types.length});\n`;
      code += `let i=0;\n`;
      for ( let i = 0; i < node.types.length; i++ ) {
        code += `${this.callValidate( node.types[ i ], ctx, 0 )};i++;\n`;
      }
      this.fnValidate( typeInfo, code );
    }

    // Merge
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `if(dest===undefined)dest=[];else if(this.mergeStrategy==="override")return dest;\n`;
      code += `let i=0;\n`;
      for ( let i = 0; i < node.types.length; i++ ) {
        code += `dest[i]=${this.callMerge( node.types[ i ], ctx, 0, 0 )};i++;\n`;
      }
      code += `if(!this.additionalProperties){\n`;
      code += `for(;i<value.length;i++) dest[i]=value[i];\n`;
      code += `}\n`;
      code += `return dest;\n`;
      this.fnMerge( typeInfo, code );
    }

    // Defaults
    {
      let code = "";
      code += `if(value===undefined)value=[];\n`;
      code += `let i=0;\n`;
      for ( let i = 0; i < node.types.length; i++ ) {
        code += `value[i]=${this.callDefaults( node.types[ i ], ctx, 0 )};i++;\n`;
      }
      code += `return value;\n`;
      this.fnDefaults( typeInfo, code );
    }

    this.statements.push( typeInfo.toCode() );

    return typeInfo;
  }

  compileOptional( node: OptionalType, ctx: Context ) {
    const { typeInfo, existed } = this.compileInfo( node );
    if ( existed ) return typeInfo;

    // Validate
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `${this.callValidate( node.type1, ctx, null )};\n`;
      this.fnValidate( typeInfo, code );
    }

    // Merge
    {
      let code = "";
      code += `if(value===undefined)return dest;\n`;
      code += `return ${this.callMerge( node.type1, ctx, null, null )};\n`;
      this.fnMerge( typeInfo, code );
    }

    // Defaults
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `return ${this.callDefaults( node.type1, ctx, null )};\n`;
      this.fnDefaults( typeInfo, code );
    }

    this.statements.push( typeInfo.toCode() );

    return typeInfo;
  }

  compileArray( node: ArrayType, ctx: Context ) {
    const { typeInfo, existed } = this.compileInfo( node );
    if ( existed ) return typeInfo;

    // Validate
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `busy.add(path,value);\n`;
      code += `runtime.assertType(path,value,'Array',this);\n`;
      code += `let i=(this.mergeStrategy==="spreadMeansConcat"&&value[0]==="...")?1:0;\n`;
      code += `for(;i<value.length;i++) ${this.callValidate( node.type1, ctx, 0 )};\n`;
      this.fnValidate( typeInfo, code );
    }

    // Merge
    {
      let code = "";
      code += `if(value===undefined)return dest;\n`;
      code += `const first=dest===undefined;\n`;
      code += `if(first)dest=[];\n`;
      code += `let j=dest.length;\n`;
      code += `if(this.mergeStrategy==="merge") for(let i=0;i<value.length;i++) dest[i]=${this.callMerge( node.type1, ctx, 0, 0 )};\n`;
      code += `else if(this.mergeStrategy==="concat") for(let i=0;i<value.length;i++,j++) dest.push(${this.callMerge( node.type1, ctx, 1, 0 )});\n`;
      code += `else if(this.mergeStrategy==="spreadMeansConcat"&&value[0]==="...")`;
      code += `  for(let i=1;i<value.length;i++,j++) dest.push(${this.callMerge( node.type1, ctx, 1, 0 )});\n`;
      code += `else if(first) for(let i=0;i<value.length;i++) dest[i]=${this.callMerge( node.type1, ctx, 0, 0 )};\n`;
      code += `return dest;\n`;
      this.fnMerge( typeInfo, code );
    }

    // Defaults
    {
      let code = "";
      code += `if(value===undefined)return [];\n`;
      code += `return value;\n`;
      this.fnDefaults( typeInfo, code );
    }

    this.statements.push( typeInfo.toCode() );

    return typeInfo;
  }

  compileUnion( node: UnionType, ctx: Context ) {
    const { typeInfo, existed } = this.compileInfo( node );
    if ( existed ) return typeInfo;

    // Validate
    {
      let code = "";
      code += `if(value===undefined)return;\n`;
      code += `try{${this.callValidate( node.type1, ctx, null )};}catch(err){\n`;
      code += `busy.remove(value);${this.callValidate( node.type2, ctx, null )};\n}\n`;
      this.fnValidate( typeInfo, code );
    }

    // Merge
    {
      let code = "";
      code += `return dest===undefined ? value : dest;\n`;
      this.fnMerge( typeInfo, code );
    }

    // Defaults
    {
      let code = "";
      code += `if(value===undefined) { if(this.default) return this.default(); else throw runtime.requiredError(path); }\n`;
      code += `return value;\n`;
      this.fnDefaults( typeInfo, code );
    }

    this.statements.push( typeInfo.toCode() );

    return typeInfo;
  }

  compileBuilt( name: string ) {
    let typeInfo = this.compiledBuiltins.get( name );
    if ( typeInfo ) {
      return typeInfo;
    }
    typeInfo = new TypeInfo( `_${name}` );
    this.compiledBuiltins.set( name, typeInfo );

    if ( name === "any" ) {
      this.fnValidate( typeInfo, `busy.add(path,value);\n` );
      this.fnMerge( typeInfo, `return dest===undefined ? value : dest;\n` );
      this.fnDefaults( typeInfo, `if(value===undefined && this.default) return this.default();\nreturn value;\n` );
    } else {
      this.fnValidate( typeInfo, `if(value===undefined)return;\nbusy.add(path,value);\nruntime.assertType(path,value,'${name}',this);\n` );
      this.fnMerge( typeInfo, `return dest===undefined ? value : dest;\n` );
      {
        let code = "";
        code += `if(value===undefined) { if(this.default) return this.default(); else throw runtime.requiredError(path); }\n`;
        code += `return value;\n`;
        this.fnDefaults( typeInfo, code );
      }
    }

    this.statements.push( typeInfo.toCode() );
    return typeInfo;
  }

  compileLiteral( node: TypeLiteral ) {
    let typeInfo = this.compiledLiterals.get( node.raw );
    if ( typeInfo ) {
      return typeInfo;
    }
    typeInfo = new TypeInfo( `literal${this.literalUuid++}` );
    this.compiledLiterals.set( node.raw, typeInfo );

    this.fnValidate( typeInfo, `if(value===undefined)return;\nruntime.assertValue(path,value,${node.raw},this);\n` );
    this.fnMerge( typeInfo, `return dest===undefined ? value : dest;\n` );
    {
      let code = "";
      code += `if(value===undefined) { if(this.default) return this.default(); else throw runtime.requiredError(path); }\n`;
      code += `return value;\n`;
      this.fnDefaults( typeInfo, code );
    }

    this.statements.push( typeInfo.toCode() );
    return typeInfo;
  }

  applyDecorators( typeInfo: TypeInfo, decorators: Decorator[] ) {
    for ( const decorator of decorators ) {
      const args = decorator.arguments;
      switch ( decorator.name ) {
        case "alias":
        case "coerce":
        case "narg":
        case "count":
        case "description":
          break;
        case "default": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 ) {
            throw new Error( "@default should have 1 argument" );
          }
          typeInfo.set( decorator.name, `()=>${arg0.raw}` );
          break;
        }
        case "example": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 ) {
            throw new Error( "@example should have 1 argument" );
          }
          typeInfo.set( decorator.name, arg0.raw );
          break;
        }
        case "deprecated": {
          const arg0 = args[ 0 ];
          if ( args.length > 1 || ( arg0 && arg0.type !== "String" ) ) {
            throw new Error( "@deprecated should have 0 or 1 string argument" );
          }
          const validateFn = typeInfo.getForSure( "validate" );
          const code = `${validateFn}(busy,path,value);if(value!==undefined)runtime.printDeprecated(path,${arg0 ? arg0.raw : ""});\n`;
          this.fnValidate( typeInfo, code );
          break;
        }
        case "additionalProperties": {
          const arg0 = args[ 0 ];
          if ( args.length > 1 || ( arg0 && arg0.type !== "Boolean" ) ) {
            throw new Error( "@additionalProperties should have 0 or 1 argument (true or false)" );
          }
          typeInfo.set( decorator.name, arg0 ? arg0.raw : "true" );
          break;
        }
        case "mergeStrategy": {
          const arg0 = args[ 0 ];
          if ( args.length !== 1 || arg0.type !== "String" ) {
            throw new Error( "@mergeStrategy should have 1 string argument" );
          }
          typeInfo.set( decorator.name, arg0.raw );
          break;
        }
        default:
          throw new Error( `Decorator ${decorator.name} is not defined` );
      }
    }
  }

  fnValidate( typeInfo: TypeInfo, body: string ) {
    const id = this.genFunId();
    const code = `function ${id}(busy,path,value){\n${body}}`;
    this.statements.push( code );
    typeInfo.set( "validate", id );
    return id;
  }

  callValidate( node: Type, ctx: Context, key: null | 0 | string ) {
    const args = key === null ? `path,value` : key === 0 ? `path.addIdx(i),value[i]` : `path.add('${key}'),value.${key}`;
    return `${this._callId( node, ctx )}.validate(busy,${args})`;
  }

  fnMerge( typeInfo: TypeInfo, body: string ) {
    const id = this.genFunId();
    const code = `function ${id}(pathDest,pathValue,dest,value){\n${body}}`;
    this.statements.push( code );
    typeInfo.set( "merge", id );
    return id;
  }

  callMerge( node: Type, ctx: Context, keyDest: null | 0 | 1 | string, keyValue: null | 0 | string ) {
    const pathDest = keyDest === null ? `pathDest` :
      keyDest === 0 ? `pathDest.addIdx(i)` : keyDest === 1 ? `pathDest.addIdx(j)` : `path.add('${keyDest}')`;
    const pathValue = keyValue === null ? `pathValue` :
      keyValue === 0 ? `pathValue.addIdx(i)` : `pathValue.add('${keyValue}')`;
    const argDest = keyDest === null ? `dest` :
      keyDest === 0 ? `dest[i]` : keyDest === 1 ? `dest[j]` : `dest.${keyDest}`;
    const argValue = keyValue === null ? `value` :
      keyValue === 0 ? `value[i]` : `value.${keyValue}`;
    return `${this._callId( node, ctx )}.merge(${pathDest},${pathValue},${argDest},${argValue})`;
  }

  fnDefaults( typeInfo: TypeInfo, body: string ) {
    const id = this.genFunId();
    const code = `function ${id}(path,value){\n${body}}`;
    this.statements.push( code );
    typeInfo.set( "defaults", id );
    return id;
  }

  callDefaults( node: Type, ctx: Context, key: null | 0 | string ) {
    const args = key === null ? `path,value` : key === 0 ? `path.addIdx(i),value[i]` : `path.add('${key}'),value.${key}`;
    return `${this._callId( node, ctx )}.defaults(${args})`;
  }

  _callId( node: Type, ctx: Context ) {
    return this.compileType( node, ctx ).id;
  }

}

export { CliCompiler, Compiler };

function schemaCompiler( text: string ) {
  const ast = new Parser( text ).parse() as Schema;
  return `/* eslint-disable */({
    validateAndMerge: ${new Compiler().start( ast )},
    cli: ${new CliCompiler().start( ast )}
  })`;
}

export default schemaCompiler;
