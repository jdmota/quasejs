// @flow
import { BuilderContext, ModuleContext } from "../plugins/context";

// Inspired in https://github.com/dfahlander/typeson/

const toString = ( {}.toString );

function get<K, V>( map: Map<K, V>, key: K ): V {
  // $FlowIgnore
  return map.get( key );
}

function toStringTag( val ) {
  return toString.call( val ).slice( 8, -1 );
}

const getType = value =>
  ( value === null ? "null" : ( Array.isArray( value ) ? "array" : typeof value ) );

function objectEncapsulate( o, getPointer ) {
  const clone = {};
  for ( const key of Object.keys( o ) ) {
    clone[ key ] = getPointer( o[ key ] );
  }
  return clone;
}

function objectFill( clone, revived, getValue ) {
  for ( const key of Object.keys( clone ) ) {
    revived[ key ] = getValue( clone[ key ] );
  }
}

const ourPreset = {
  BuilderContext: [
    o => o instanceof BuilderContext,
    objectEncapsulate,
    _ => Object.create( BuilderContext.prototype ),
    objectFill
  ],
  ModuleContext: [
    o => o instanceof ModuleContext,
    objectEncapsulate,
    _ => Object.create( ModuleContext.prototype ),
    objectFill
  ]
};

const builtins = {
  null: [
    o => o === null,
    _ => "",
    _ => null
  ],
  undefined: [
    o => o === undefined,
    _ => "",
    _ => undefined
  ],
  boolean: [
    o => o === true || o === false,
    o => ( o ? 1 : 0 ),
    o => o === 1
  ],
  string: [
    o => typeof o === "string",
    o => o,
    o => o
  ],
  nan: [
    x => typeof x === "number" && isNaN( x ),
    _ => "NaN",
    _ => NaN
  ],
  infinity: [
    x => x === Infinity || x === -Infinity,
    x => ( x === Infinity ? "Infinity" : "-Infinity" ),
    x => ( x === "Infinity" ? Infinity : -Infinity )
  ],
  number: [
    o => typeof o === "number",
    o => o,
    o => o
  ],
  function: [
    o => typeof o === "function",
    _ => "",
    _ => function() {
      throw new Error( "This function existed in another process. Cannot be called, since it lost its closure" );
    }
  ],
  array: [
    o => Array.isArray( o ),
    ( array, getPointer ) => {
      const clone = new Array( array.length );
      for ( let i = 0; i < array.length; i++ ) {
        clone[ i ] = getPointer( array[ i ] );
      }
      return clone;
    },
    clone => new Array( clone.length ),
    ( clone, array, getValue ) => {
      for ( let i = 0; i < clone.length; i++ ) {
        array[ i ] = getValue( clone[ i ] );
      }
    }
  ],
  date: [
    x => toStringTag( x ) === "Date",
    x => {
      const time = x.getTime();
      return isNaN( time ) ? "NaN" : time;
    },
    x => ( x === "NaN" ? new Date( NaN ) : new Date( x ) )
  ],
  error: [
    x => toStringTag( x ) === "Error",
    ( { name, message } ) => ( { name, message } ),
    ( { name, message } ) => {
      const e = new Error( message );
      e.name = name;
      return e;
    }
  ],
  regexp: [
    x => toStringTag( x ) === "RegExp",
    rexp => ( {
      source: rexp.source,
      flags: ( rexp.global ? "g" : "" ) +
              ( rexp.ignoreCase ? "i" : "" ) +
              ( rexp.multiline ? "m" : "" ) +
              ( rexp.sticky ? "y" : "" ) +
              ( rexp.unicode ? "u" : "" )
    } ),
    ( { source, flags } ) => new RegExp( source, flags )
  ],
  map: [
    x => toStringTag( x ) === "Map",
    ( map, getPointer ) => {
      const arr = [];
      for ( const [ key, value ] of map ) {
        arr.push( [ getPointer( key ), getPointer( value ) ] );
      }
      return arr;
    },
    () => new Map(),
    ( arr, map, getValue ) => {
      for ( const [ key, value ] of arr ) {
        map.set( getValue( key ), getValue( value ) );
      }
    }
  ],
  set: [
    x => toStringTag( x ) === "Set",
    ( set, getPointer ) => {
      const arr = [];
      for ( const value of set ) {
        arr.push( getPointer( value ) );
      }
      return arr;
    },
    () => new Set(),
    ( arr, set, getValue ) => {
      for ( const value of arr ) {
        set.add( getValue( value ) );
      }
    }
  ],
  Buffer: [
    o => o instanceof Buffer,
    o => Array.from( o ),
    o => Buffer.from( o )
  ],
  object: [
    o => typeof o === "object",
    objectEncapsulate,
    _ => ( {} ),
    objectFill
  ]
};

type GetPointerFn = any => number;

type GetValueFn = number => any;

type TypeSpec<T> = {
  +type: string,
  +test: any => boolean,
  +encapsulate: ( any, GetPointerFn ) => T,
  +revive: any => T,
  +fill: ?( any, T, GetValueFn ) => void
};

type Encapsulated = {
  t: { [key: number]: string },
  o: [ number, any ][]
};

type ProvidedSpec = $ReadOnlyArray<any>;
type ProvidedTypeSpecsMap = { +[key: string]: ProvidedSpec };
type ProvidedTypeSpecs = ?( ProvidedTypeSpecsMap | $ReadOnlyArray<ProvidedTypeSpecsMap> );

class Typeson {

  +typesMap: Map<string, TypeSpec<*>>;
  +typesArr: TypeSpec<*>[];

  constructor() {
    this.typesMap = new Map();
    this.typesArr = [];
  }

  encapsulate( value: any ): Encapsulated {

    const refs = new Map();
    const objects = [];
    const idToType: { [key: number]: string } = {};
    const typeToId: { [key: string]: number } = {};
    let typeUUID = 1;

    const getPointer: GetPointerFn = value => {

      const currPointer = refs.get( value );

      if ( currPointer == null ) {
        const spec: ?TypeSpec<*> = this.typesArr.find( spec => spec.test( value ) );

        if ( !spec ) {
          throw new Error( `Spec not found for value of type ${getType( value )}` );
        }

        const typeId = typeToId[ spec.type ] || ( typeToId[ spec.type ] = typeUUID++ );
        idToType[ typeId ] = spec.type;

        const pointer = objects.length;
        refs.set( value, pointer );

        const newObject = [ typeId, null ];
        objects.push( newObject );

        newObject[ 1 ] = spec.encapsulate( value, getPointer );

        return pointer;
      }
      return currPointer;
    };

    getPointer( value );

    return {
      t: idToType,
      o: objects
    };
  }

  revive( { t: types, o: objects }: Encapsulated ) {

    const refs = new Map();

    for ( let pointer = 0; pointer < objects.length; pointer++ ) {
      const [ typeId, encapsulated ] = objects[ pointer ];

      const type = types[ typeId ];
      const spec: ?TypeSpec<*> = this.typesMap.get( type );

      if ( !spec ) {
        throw new Error( `Spec not found for type ${type}` );
      }

      refs.set( pointer, {
        spec,
        encapsulated,
        revived: spec.revive( encapsulated )
      } );
    }

    const getValue: GetValueFn = pointer => {
      return get( refs, pointer ).revived;
    };

    for ( let pointer = 0; pointer < objects.length; pointer++ ) {
      const { spec, encapsulated, revived } = get( refs, pointer );
      if ( spec.fill ) {
        spec.fill( encapsulated, revived, getValue );
      }
    }

    return get( refs, 0 ).revived;
  }

  register( typeSpecs: ProvidedTypeSpecs ) {
    const _register = typeSpec => {
      if ( Array.isArray( typeSpec ) ) {
        typeSpec.map( _register );
      } else if ( typeSpec ) {
        for ( const type of Object.keys( typeSpec ) ) {
          if ( this.typesMap.has( type ) ) {
            throw new Error( `Type id '${type}' was already registered` );
          } else {
            const arr = typeSpec[ type ];
            const spec = {
              type,
              test: arr[ 0 ],
              encapsulate: arr[ 1 ],
              revive: arr[ 2 ],
              fill: arr[ 3 ]
            };
            this.typesMap.set( type, spec );
            this.typesArr.push( spec );
          }
        }
      }
      return this;
    };
    return _register( typeSpecs );
  }

}

const typeson = new Typeson().register( [ ourPreset, builtins ] );

export default typeson;
