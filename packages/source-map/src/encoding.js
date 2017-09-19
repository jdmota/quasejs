const win = typeof window !== "undefined" && window; // eslint-disable-line
const encoding = {};

if ( win && typeof win.btoa === "function" ) {
  encoding.encode = win.btoa;
  encoding.decode = win.atob;
} else if ( typeof Buffer === "function" ) {
  encoding.encode = str => Buffer.from( str ).toString( "base64" );
  encoding.decode = str => Buffer.from( str, "base64" ).toString();
}

export default encoding;
