const nativeGetPrototype = Object.getPrototypeOf;

export default function( obj ) {
  return nativeGetPrototype( Object( obj ) );
}
