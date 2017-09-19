export default function( thing ) {
  if ( Array.isArray( thing ) ) return thing;
  if ( thing == null ) return [];
  return [ thing ];
}
