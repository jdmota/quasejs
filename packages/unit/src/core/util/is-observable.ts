import SYMBOL_OBSERVABLE from "./observable-symbol";

export default ( x: any ): boolean => {
  return !!( x && x[ SYMBOL_OBSERVABLE() ] );
};
