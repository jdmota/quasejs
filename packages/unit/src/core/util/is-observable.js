import SYMBOL_OBSERVABLE from "./observable-symbol";

export default function( fn ) {
  return !!( fn && fn[ SYMBOL_OBSERVABLE() ] );
}
