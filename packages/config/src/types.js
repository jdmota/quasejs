// @flow
import type Path from "./path";
import getType from "./get-type";
import { clone, merge, extractDefaults } from "./defaults";
import { indent, formatTypes, format, addPrefix } from "./formating";
import { ValidationError, makeExample, validateType, printDeprecated, checkType, checkUnrecognized } from "./validation";
import { clone as cloneHelper, isPlainObject } from "./utils";

const turbocolor = require( "turbocolor" );

type Info = {
  +required?: ?boolean;
  +optional?: ?boolean;
  +default?: ?mixed;
  +deprecated?: ?boolean;
  +example?: ?mixed;
  +map?: any;
  +merge?: any;
};

export class Type {
  +required: boolean;
  +optional: boolean;
  +default: mixed;
  +deprecated: boolean;
  +example: mixed;
  +extra: { +[key: string]: any };
  constructor( info: ?Info ) {
    const extra = info || {};
    const { required, optional, default: d, deprecated, example } = extra;
    this.required = !!required;
    this.optional = !!optional;
    this.default = d;
    this.deprecated = !!deprecated;
    this.example = example;
    this.extra = extra;
  }
  clone( path: Path, value: any ) { // eslint-disable-line
    return cloneHelper( value );
  }
  merge( path: Path, objValue: any, srcValue: any ) { // eslint-disable-line
    if ( Array.isArray( objValue ) && Array.isArray( srcValue ) ) {
      if ( merge === "merge" ) {
        for ( let i = 0; i < srcValue.length; i++ ) {
          merge( path, anyType, objValue, srcValue, i ); // eslint-disable-line no-use-before-define
        }
      } else if ( merge === "concat" ) {
        return srcValue.concat( objValue );
      } else if ( merge === "spreadMeansConcat" && objValue[ 0 ] === "..." ) {
        return srcValue.concat( objValue.slice( 1 ) );
      }
    } else if ( isPlainObject( objValue ) && isPlainObject( srcValue ) ) {
      for ( const key in srcValue ) {
        merge( path, anyType, objValue, srcValue, key ); // eslint-disable-line no-use-before-define
      }
    }
    return objValue;
  }
  defaults( path: Path, dest: Object ) { // eslint-disable-line
    return undefined;
  }
  validate( path: Path, value: any, dest: Object ) { // eslint-disable-line
    if ( value === undefined ) {
      if ( !this.optional ) {
        throw new ValidationError( `Option ${path.format()} is required.` );
      }
    } else {
      if ( this.deprecated ) {
        printDeprecated( path );
      }
    }
  }
  checkType( path: Path, value: any, expected: string ) {
    checkType( path, getType( value ), expected, this.default, this.example );
  }
}

export type GeneralType = string | Type | ( { type: ?string } & Info );

class TAny extends Type {
  validate( path: Path, value: any, dest: Object ) { // eslint-disable-line
    if ( this.deprecated && value !== undefined ) {
      printDeprecated( path );
    }
  }
}

const anyType = new TAny();

type ObjectInfo = Info & {
  +properties?: ?Object,
  +additionalProperties?: ?boolean
};

class TObject extends Type {
  +properties: Object;
  +additionalProperties: boolean;
  +keys: string[];
  constructor( info: ?ObjectInfo ) {
    super( info );
    this.properties = ( info && info.properties ) || {};
    this.additionalProperties = info ? !!info.additionalProperties : true;
    this.keys = this.properties ? Object.keys( this.properties ) : [];
  }
  checkUnrecognized( path: Path, value: any ) {
    if ( !this.additionalProperties ) {
      checkUnrecognized(
        Object.keys( value ).map( o => addPrefix( path, o ) ),
        this.keys.map( o => addPrefix( path, o ) )
      );
    }
  }
  clone( path: Path, value: any ) {
    this.checkType( path, value, "object" );
    this.checkUnrecognized( path, value );

    const cloned = {};
    for ( const key in value ) {
      clone( path, this.properties[ key ] || anyType, cloned, value, key );
    }
    return cloned;
  }
  merge( path: Path, objValue: any, srcValue: any ) {
    this.checkType( path, srcValue, "object" );
    this.checkUnrecognized( path, srcValue );

    for ( const key in srcValue ) {
      merge( path, this.properties[ key ] || anyType, objValue, srcValue, key );
    }
    return objValue;
  }
  defaults( path: Path, dest: Object ) {
    const schema = this.properties;
    const defaults = {};
    for ( const k in schema ) {
      extractDefaults( path, schema[ k ], defaults, k, dest );
    }
    return defaults;
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      this.checkType( path, value, "object" );
      this.checkUnrecognized( path, value );

      for ( const key in this.properties ) {
        const type = this.properties[ key ];
        if ( type ) {
          path.push( key );
          validateType( type, path, value[ key ], dest );
          path.pop();
        }
      }
    }
  }
}

type ArrayInfo = Info & {
  +itemType?: ?GeneralType
};

class TArray extends Type {
  +itemType: ?GeneralType;
  constructor( info: ?ArrayInfo ) {
    super( info );
    this.itemType = info && info.itemType;
  }
  clone( path: Path, value: any ) {
    this.checkType( path, value, "array" );

    const cloned = [];
    for ( let i = 0; i < value.length; i++ ) {
      clone( path, this.itemType, cloned, value, i );
    }
    return cloned;
  }
  merge( path: Path, objValue: any, srcValue: any ) {
    this.checkType( path, srcValue, "array" );

    const mergeOpts = this.extra.merge;

    if ( mergeOpts === "merge" ) {
      for ( let i = 0; i < srcValue.length; i++ ) {
        merge( path, this.itemType, objValue, srcValue, i );
      }
    } else if ( mergeOpts === "concat" ) {
      objValue = srcValue.concat( objValue );
    } else if ( mergeOpts === "spreadMeansConcat" && objValue[ 0 ] === "..." ) {
      objValue = srcValue.concat( objValue.slice( 1 ) );
    }

    return objValue;
  }
  defaults() {
    return [];
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      this.checkType( path, value, "array" );

      const itemType = this.itemType;

      if ( itemType ) {
        for ( let i = 0; i < value.length; i++ ) {
          path.push( i );
          validateType( itemType, path, value[ i ], dest );
          path.pop();
        }
      }
    }
  }
}

type TupleInfo = Info & {
  +items: GeneralType[]
};

class TTuple extends Type {
  +items: GeneralType[];
  constructor( info: TupleInfo ) {
    super( info );
    this.items = info.items || [];
  }
  _error( path: Path ) {
    throw new ValidationError( [
      `Option ${path.format()} must be an array of ${this.items.length} items.`,
      makeExample( path, this.default, this.example )
    ] );
  }
  validateSize( path: Path, size: number ) {
    if ( size > this.items.length ) {
      this._error( path );
    }
  }
  clone( path: Path, value: any ) {
    this.checkType( path, value, "array" );
    this.validateSize( path, value.length );

    const cloned = [];
    for ( let i = 0; i < value.length; i++ ) {
      clone( path, this.items[ i ], cloned, value, i );
    }
    return cloned;
  }
  merge( path: Path, objValue: any, srcValue: any ) {
    this.checkType( path, srcValue, "array" );
    this.validateSize( path, srcValue.length );

    for ( let i = 0; i < srcValue.length; i++ ) {
      merge( path, this.items[ i ], objValue, srcValue, i );
    }
    return objValue;
  }
  defaults( path: Path, dest: Object ) {
    const schema = this.items;
    const defaults = [];
    for ( let i = 0; i < schema.length; i++ ) {
      extractDefaults( path, schema[ i ], defaults, i, dest );
    }
    return defaults;
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      if ( !Array.isArray( value ) || value.length !== this.items.length ) {
        this._error( path );
      }

      for ( let i = 0; i < this.items.length; i++ ) {
        const type = this.items[ i ];
        if ( type ) {
          path.push( i );
          validateType( type, path, value[ i ], dest );
          path.pop();
        }
      }
    }
  }
}

type ValueInfo = Info & {
  +value: mixed
};

class TValue extends Type {
  +value: mixed;
  constructor( info: ValueInfo ) {
    super( info );
    this.value = info.value;
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      if ( value === this.value ) {
        return;
      }
      throw new ValidationError( [
        `Option ${path.format()} should be:`,
        `${indent( format( this.value ) )}`,
        `but instead received:`,
        `${indent( turbocolor.bold.red( format( value ) ) )}`
      ] );
    }
  }
}

type UnionInfo = Info & {
  +types: GeneralType[]
};

class TUnion extends Type {
  +types: GeneralType[];
  constructor( info: UnionInfo ) {
    super( info );
    this.types = info.types;
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      for ( const type of this.types ) {
        try {
          validateType( type, path, value, dest );
          return;
        } catch ( e ) {
          // Ignore
        }
      }
      throw new ValidationError( [
        `Option ${path.format()} should be one of these types:`,
        `${indent( turbocolor.bold.green( formatTypes( this.types ) ) )}`,
        `but instead received:`,
        `${indent( turbocolor.bold.red( format( value ) ) )}`,
        makeExample( path, this.default, this.example )
      ] );
    }
  }
}

type ChoicesInfo = Info & {
  +values: mixed[];
};

class TChoices extends Type {
  +values: mixed[];
  constructor( info: ChoicesInfo ) {
    super( info );
    this.values = info.values;
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      if ( this.values.some( v => v === value ) ) {
        return;
      }

      throw new ValidationError( [
        `Option ${path.format()} should be one of:`,
        `${indent( turbocolor.bold.green( this.values.map( format ).join( " | " ) ) )}`,
        `but instead received:`,
        `${indent( turbocolor.bold.red( format( value ) ) )}`
      ] );
    }
  }
}

type PrimitiveInfo = Info & {
  +type: ?string;
};

class TPrimitive extends Type {
  +type: ?string;
  constructor( info: PrimitiveInfo ) {
    super( info );
    this.type = info.type;
  }
  defaults( path: Path, dest: Object ) { // eslint-disable-line
    if ( this.type === "boolean" ) {
      return false;
    }
    if ( this.type === "array" ) {
      return [];
    }
    if ( this.type === "object" ) {
      return {};
    }
  }
  validate( path: Path, value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( this.type != null && value !== undefined ) {
      this.checkType( path, value, this.type );
    }
  }
}

export type Schema = {
  [key: string]: GeneralType;
};

export function toType( type: ?GeneralType, path: Path ): Type {
  if ( typeof type === "string" ) {
    if ( type === "any" ) {
      return new TAny();
    }
    return new TPrimitive( { type: type } );
  }
  if ( type != null && typeof type === "object" ) {
    if ( type instanceof Type ) {
      return type;
    }
    if ( typeof type.type === "string" ) {
      if ( type.type === "object" ) {
        return new TObject( type );
      }
      if ( type.type === "array" ) {
        return new TArray( type );
      }
      if ( type.type === "any" ) {
        return new TAny( type );
      }
      return new TPrimitive( type );
    }
  }
  throw new Error( `[Schema] Invalid type. See ${path.chainToString()}` );
}

export const types = {
  Type,
  Object: TObject,
  Array: TArray,
  Tuple: TTuple,
  Value: TValue,
  Union: TUnion,
  Choices: TChoices,
  Primitive: TPrimitive,
  Any: TAny
};

export const t = {
  object( x: ObjectInfo ) {
    return new types.Object( x );
  },
  array( x: ArrayInfo ) {
    return new types.Array( x );
  },
  tuple( x: TupleInfo ) {
    return new types.Tuple( x );
  },
  value( x: ValueInfo ) {
    return new types.Value( x );
  },
  union( x: UnionInfo ) {
    return new types.Union( x );
  },
  choices( x: ChoicesInfo ) {
    return new types.Choices( x );
  },
  primitive( x: PrimitiveInfo ) {
    return new types.Primitive( x );
  },
  any( x: Info ) {
    return new types.Any( x );
  }
};
