// From https://github.com/sindresorhus/fn-name

const re = /function ([^(]+)?\(/;

export default function( fn ) {
  return fn.displayName || fn.name || ( re.exec( fn.toString() ) || [] )[ 1 ] || "anonymous";
}
