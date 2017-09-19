export default function() {
  let resolve, reject;
  return {
    promise: new Promise( function( a, b ) {
      resolve = a;
      reject = b;
    } ),
    resolve: resolve,
    reject: reject
  };
}
