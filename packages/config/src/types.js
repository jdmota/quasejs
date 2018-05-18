// @flow
import { extractDefaults } from "./defaults";
import { indent, formatTypes, formatPathOption, format, addPrefix, pathToStr } from "./formating";
import getType from "./get-type";
import { ValidationError, makeExample, validateType, printDeprecated, checkType, checkUnrecognized, checkKeys } from "./validation";

const chalk = require( "chalk" );

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
  +map: any;
  +merge: any;
  +extra: { +[key: string]: any };
  constructor( info: ?Info ) {
    const extra = info || {};
    const { required, optional, default: d, deprecated, example, map, merge } = extra;
    this.required = !!required;
    this.optional = !!optional;
    this.default = d;
    this.deprecated = !!deprecated;
    this.example = example;
    this.map = map;
    this.merge = merge;
    this.extra = extra;
  }
  defaults( path: string[], dest: Object ) { // eslint-disable-line
    return undefined;
  }
  validate( path: string[], value: any, dest: Object ) { // eslint-disable-line
    if ( value === undefined ) {
      if ( !this.optional ) {
        throw new ValidationError( `Option ${formatPathOption( path )} is required.` );
      }
    } else {
      if ( this.deprecated ) {
        printDeprecated( path );
      }
    }
  }
}

export type GeneralType = string | Type | ( { type: ?string } & Info );

type ObjectInfo = Info & {
  +properties?: ?Object,
  +additionalProperties?: ?boolean
};

class TObject extends Type {
  +properties: ?Object;
  +additionalProperties: boolean;
  +keys: string[];
  constructor( info: ?ObjectInfo ) {
    super( info );
    this.properties = info && info.properties;
    this.additionalProperties = info ? !!info.additionalProperties : true;
    this.keys = this.properties ? Object.keys( this.properties ) : [];
  }
  defaults( path: string[], dest: Object ) {
    const schema = this.properties;
    const defaults = {};
    for ( const k in schema ) {
      path.push( k );
      defaults[ k ] = extractDefaults( schema[ k ], path, dest );
      path.pop();
    }
    return defaults;
  }
  validate( path: string[], value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      checkType( path, getType( value ), "object", this.default, this.example );

      if ( !this.additionalProperties ) {
        checkUnrecognized(
          Object.keys( value ).map( o => addPrefix( path, o ) ),
          this.keys.map( o => addPrefix( path, o ) )
        );
      }

      if ( this.properties ) {
        checkKeys( this.properties, path, value, dest );
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
  defaults() {
    return [];
  }
  validate( path: string[], value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      checkType( path, getType( value ), "array", this.default, this.example );

      const itemType = this.itemType;

      if ( itemType ) {
        for ( let i = 0; i < value.length; i++ ) {
          path.push( i + "" );
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
    this.items = info.items;
  }
  defaults( path: string[], dest: Object ) {
    const schema = this.items;
    const defaults = [];
    for ( let i = 0; i < schema.length; i++ ) {
      path.push( i + "" );
      defaults[ i ] = extractDefaults( schema[ i ], path, dest );
      path.pop();
    }
    return defaults;
  }
  validate( path: string[], value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      if ( !Array.isArray( value ) || value.length !== this.items.length ) {
        throw new ValidationError( [
          `Option ${formatPathOption( path )} must be an array of ${this.items.length} items.`,
          makeExample( path, this.default, this.example )
        ] );
      }

      checkKeys( this.items, path, value, dest );
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
  validate( path: string[], value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      if ( value === this.value ) {
        return;
      }
      throw new ValidationError( [
        `Option ${formatPathOption( path )} should be:`,
        `${indent( format( this.value ) )}`,
        `but instead received:`,
        `${indent( chalk.bold.red( format( value ) ) )}`
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
  validate( path: string[], value: any, dest: Object ) {
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
        `Option ${formatPathOption( path )} should be one of these types:`,
        `${indent( chalk.bold.green( formatTypes( this.types ) ) )}`,
        `but instead received:`,
        `${indent( chalk.bold.red( format( value ) ) )}`,
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
  validate( path: string[], value: any, dest: Object ) {
    super.validate( path, value, dest );

    if ( value !== undefined ) {
      if ( this.values.some( v => v === value ) ) {
        return;
      }

      throw new ValidationError( [
        `Option ${formatPathOption( path )} should be one of:`,
        `${indent( chalk.bold.green( this.values.map( format ).join( " | " ) ) )}`,
        `but instead received:`,
        `${indent( chalk.bold.red( format( value ) ) )}`
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
  defaults( path: string[], dest: Object ) { // eslint-disable-line
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
  validate( path: string[], value: any, dest: Object ) {
    super.validate( path, value, dest );

    const type = this.type;

    if ( type != null && value !== undefined ) {
      checkType( path, getType( value ), type, this.default, this.example );
    }
  }
}

export type Schema = {
  [key: string]: GeneralType;
};

export function toTypeMaybe( type: ?GeneralType ): ?Type {
  if ( typeof type === "string" ) {
    return new TPrimitive( { type: type } );
  }
  if ( type != null && typeof type === "object" ) {
    if ( type instanceof Type ) {
      return type;
    }
    if ( type.type === undefined || typeof type.type === "string" ) {
      return new TPrimitive( type );
    }
  }
}

export function toType( _type: ?GeneralType, path: string[] ): Type {
  const type = toTypeMaybe( _type );
  if ( type ) {
    return type;
  }
  throw new Error( `[Schema] Invalid type. See ${pathToStr( path )}` );
}

export const types = {
  Type,
  Object: TObject,
  Array: TArray,
  Tuple: TTuple,
  Value: TValue,
  Union: TUnion,
  Choices: TChoices,
  Primitive: TPrimitive
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
  }
};
