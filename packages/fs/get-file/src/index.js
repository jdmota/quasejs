const fetch = typeof window !== "undefined" && window.fetch; // eslint-disable-line no-undef
const XMLHttpRequest = typeof window !== "undefined" && window.XMLHttpRequest; // eslint-disable-line no-undef
const fs = !fetch && require( "fs-extra" );

function xdr( url, useBuffer ) {
  return new Promise( ( resolve, reject ) => {
    const req = new XMLHttpRequest();
    req.open( "GET", url );
    req.responseType = useBuffer ? "arraybuffer" : "text";
    req.onerror = reject;
    req.onreadystatechange = () => {
      if ( req.readyState === 4 ) {
        if ( ( req.status >= 200 && req.status < 300 ) || ( url.substr( 0, 7 ) === "file://" && req.response ) ) {
          resolve( req.response );
        } else {
          reject( new Error( "HTTP status: " + req.status + " retrieving " + url ) );
        }
      }
    };
    req.send();
  } );
}

export const getFile =
  fetch ?
    location => fetch( location ).then( response => response.text() ) :
    XMLHttpRequest ?
      location => xdr( location ) :
      location => fs.readFile( location, "utf8" );

export const getFileBuffer =
  fetch ?
    location => fetch( location ).then( response => response.arrayBuffer() ) :
    XMLHttpRequest ?
      location => xdr( location, true ) :
      location => fs.readFile( location );
