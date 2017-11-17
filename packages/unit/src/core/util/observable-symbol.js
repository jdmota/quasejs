export default function() {
  /* istanbul ignore if */
  if ( typeof Symbol === "function" && Symbol.observable ) {
    return Symbol.observable;
  }
  return "@@observable";
}
