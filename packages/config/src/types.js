// @flow
import { extractDefaults } from "./defaults";
import { indent, formatTypes, formatPathOption, format, addPrefix } from "./formating";
import getType from "./get-type";
import { ValidationError, makeExample, validateType, checkType, checkUnrecognized, checkKeys } from "./validation";

const chalk = require( "chalk" );

class Type {
  defaults( path: string[], dest: Object ) { // eslint-disable-line
    return undefined;
  }
  validate( path: string[], value: any, info: SchemaProp, dest: Object ) { // eslint-disable-line
    throw new Error( "abstract" );
  }
}

export type MaybeType = ?string | Type;

export type SchemaProp = {
  type?: MaybeType,
  choices?: ?Array<mixed>,
  required?: ?boolean,
  default?: mixed,
  additionalProperties?: ?boolean,
  deprecated?: ?boolean,
  example?: ?mixed
};

export type Schema = {
  [key: string]: SchemaProp
};

class TUnion extends Type {
  +types: ( string | Type )[];
  constructor( types: ( string | Type )[] ) {
    super();
    this.types = types;
  }
  validate( path: string[], value: any, info: SchemaProp, dest: Object ) {
    for ( const type of this.types ) {
      try {
        validateType( path, value, { type }, dest );
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
      makeExample( path, info )
    ] );
  }
}

class TObject extends Type {
  +properties: Schema;
  +keys: string[];
  constructor( properties: Schema ) {
    super();
    this.properties = properties;
    this.keys = Object.keys( properties );
  }
  defaults( path: string[] = [], dest: Object ) {
    const schema = this.properties;
    const defaults = {};
    for ( const k in schema ) {
      path.push( k );
      defaults[ k ] = extractDefaults( path, schema[ k ], dest );
      path.pop();
    }
    return defaults;
  }
  validate( path: string[], value: any, info: SchemaProp, dest: Object ) {

    checkType( path, getType( value ), "object", info );

    if ( !info.additionalProperties ) {
      checkUnrecognized(
        Object.keys( value ).map( o => addPrefix( path, o ) ),
        this.keys.map( o => addPrefix( path, o ) )
      );
    }

    checkKeys( path, value, this.properties, dest );
  }
}

class TArray extends Type {
  +itemType: ?SchemaProp;
  constructor( itemType: ?SchemaProp ) {
    super();
    this.itemType = itemType;
  }
  defaults() {
    return [];
  }
  validate( path: string[], value: any, info: SchemaProp, dest: Object ) {
    checkType( path, getType( value ), "array", info );

    const itemInfo = this.itemType;

    if ( itemInfo ) {
      for ( let i = 0; i < value.length; i++ ) {
        path.push( i + "" );
        validateType( path, value[ i ], itemInfo, dest );
        path.pop();
      }
    }
  }
}

class TTuple extends Type {
  +items: SchemaProp[];
  constructor( items: SchemaProp[] ) {
    super();
    this.items = items;
  }
  defaults( path: string[] = [], dest: Object ) {
    const schema = this.items;
    const defaults = [];
    for ( let i = 0; i < schema.length; i++ ) {
      path.push( i + "" );
      defaults[ i ] = extractDefaults( path, schema[ i ], dest );
      path.pop();
    }
    return defaults;
  }
  validate( path: string[], value: any, info: SchemaProp, dest: Object ) {
    if ( !Array.isArray( value ) || value.length !== this.items.length ) {
      throw new ValidationError( [
        `Option ${formatPathOption( path )} must be an array of ${this.items.length} items.`,
        makeExample( path, info )
      ] );
    }

    checkKeys( path, value, this.items, dest );
  }
}

class TValue extends Type {
  +value: mixed;
  constructor( value: mixed ) {
    super();
    this.value = value;
  }
  validate( path: string[], value: any ) {
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

export const types = {
  Type,
  Union: TUnion,
  Object: TObject,
  Array: TArray,
  Tuple: TTuple,
  Value: TValue
};

export const t = {
  union( x: ( string | Type )[] ) {
    return new types.Union( x );
  },
  object( x: Schema ) {
    return new types.Object( x );
  },
  array( x: ?SchemaProp ) {
    return new types.Array( x );
  },
  tuple( x: SchemaProp[] ) {
    return new types.Tuple( x );
  },
  value( x: mixed ) {
    return new types.Value( x );
  }
};
