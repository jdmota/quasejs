import { Schema, Scope, Type, TypeNotIdentifier, TypeDeclaration, TypeProperty, TypeObject, TypeTuple, OptionalType, ArrayType, UnionType, TypeLiteral, Decorator, TypeInfo, CircularCheck, Context } from "./common";
import TYPES from "./types";
import { isOptional } from "./typechecking";

export class Compiler {

  private compiledBuiltins: Map<string, TypeInfo>;
  private compiledLiterals: Map<string, TypeInfo>;
  private statements: string[];
  private typeInfos: Map<TypeNotIdentifier, TypeInfo>;
  private typeUuid: number;
  private literalUuid: number;
  private funUuid: number;

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
    if ( node.type === "String" || node.type === "Number" || node.type === "Boolean" ) {
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

    const seenKeys = new Set();
    for ( const { name } of node.properties ) {
      if ( seenKeys.has( name ) ) {
        throw new Error( `Duplicate key '${name}' in object type` );
      }
      seenKeys.add( name );
    }

    const defaultObj = `{${node.properties.map( p => `${p.name}:undefined` ).join( "," )}}`;

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
      code += `if(dest===undefined)dest=${defaultObj};\nelse if(this.mergeStrategy==="override")return dest;\n`;
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
      code += `if(value===undefined)value=${defaultObj};\n`;
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
      const requiredCode = isOptional( node, ctx ) ? "" : "else throw runtime.requiredError(path);";

      let code = "";
      code += `if(value===undefined) { if(this.default) return this.default(); ${requiredCode}}\n`;
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

    if ( name === "any" || name === "undefined" ) {
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
