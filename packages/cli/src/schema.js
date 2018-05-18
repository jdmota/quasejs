import { arrify, DEFAULT } from "./utils";

const decamelize = require( "decamelize" );
const { types, toType } = require( "@quase/config" );

export function typeToString( type ) {
  if ( typeof type === "string" ) {
    return type;
  }
  if ( type != null && typeof type === "object" ) {
    if ( type instanceof types.Tuple || type instanceof types.Array ) {
      return "array";
    }
    if ( type instanceof types.Object ) {
      return "object";
    }
    if ( type instanceof types.Choices ) {
      return type.values.map( x => JSON.stringify( x ) ).filter( Boolean ).join( " | " );
    }
    if ( type instanceof types.Union ) {
      return type.types.map( x => typeToString( x ) ).filter( Boolean ).join( " | " );
    }
    if ( type instanceof types.Value ) {
      return JSON.stringify( type.value );
    }
    if ( typeof type.type === "string" ) {
      return type.type;
    }
  }
  return "";
}

export function flattenSchema( schema ) {
  const newSchema = {};
  for ( const key in schema ) {
    const type = toType( schema[ key ] );
    if ( type ) {
      newSchema[ key ] = type;

      const list = type instanceof types.Union ? type.types : [ type ];

      for ( const type of list ) {
        if ( type instanceof types.Tuple ) {
          for ( let i = 0; i < type.items.length; i++ ) {
            newSchema[ `${key}.${i}` ] = toType( type.items[ i ] );
          }
        } else if ( type instanceof types.Object ) {
          for ( const k in type.properties ) {
            newSchema[ `${key}.${k}` ] = toType( type.properties[ k ] );
          }
        }
      }
    }
  }
  return newSchema;
}

export function fillOptions( schema, yargsOpts, allAlias, chain = [] ) {

  for ( const k in schema ) {

    const type = toType( schema[ k ] );
    const { argType, alias, coerce, narg } = type.extra;
    let key = decamelize( k, "-" );

    chain.push( key );
    key = chain.join( "." );

    if ( type ) {
      const wasUnion = type instanceof types.Union;
      const acceptedTypes = wasUnion ? type.types : [ type ];

      for ( const t of acceptedTypes ) {
        if ( t instanceof types.Object ) {
          fillOptions( t.properties, yargsOpts, allAlias, chain );
        } else if ( t instanceof types.Tuple ) {
          fillOptions( t.items, yargsOpts, allAlias, chain );
        } else {
          const typeStr = argType || typeToString( t );
          const arr = yargsOpts[ typeStr ];
          if ( Array.isArray( arr ) ) {
            if ( typeStr === "boolean" ) {
              if ( !wasUnion ) {
                arr.push( key );
                yargsOpts.default[ key ] = DEFAULT;
              }
            } else {
              arr.push( key );
            }
          }
        }
      }
    }

    if ( alias ) {
      const arr = yargsOpts.alias[ key ] = yargsOpts.alias[ key ] || [];
      arrify( alias ).forEach( a => {
        arr.push( a );
        allAlias.add( a );
      } );
    }
    if ( coerce ) {
      yargsOpts.coerce[ key ] = coerce;
    }
    if ( narg ) {
      yargsOpts.narg[ key ] = narg;
    }

    chain.pop();
  }

}
