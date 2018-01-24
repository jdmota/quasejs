// @flow

class Type {

}

export type SchemaProp = {
  type?: ?string | Type,
  choices?: ?Array<mixed>,
  required?: ?boolean,
  default?: mixed,
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
}

class TObject extends Type {
  +properties: Schema;
  constructor( properties: Schema ) {
    super();
    this.properties = properties;
  }
}

class TArray extends Type {
  +itemType: ?SchemaProp;
  constructor( itemType: ?SchemaProp ) {
    super();
    this.itemType = itemType;
  }
}

class TTuple extends Type {
  +items: SchemaProp[];
  constructor( items: SchemaProp[] ) {
    super();
    this.items = items;
  }
}

export const types = {
  Type,
  Union: TUnion,
  Object: TObject,
  Array: TArray,
  Tuple: TTuple
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
  }
};
