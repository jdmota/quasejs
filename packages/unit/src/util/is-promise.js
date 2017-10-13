export default function( obj ) {
  return obj != null && typeof obj.then === "function";
}
