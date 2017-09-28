import req from "../../_helper/require";

const fs = req( "fs-extra" );
const fetch = typeof window !== "undefined" && window.fetch; // eslint-disable-line no-undef
const XMLHttpRequest = typeof window !== "undefined" && window.XMLHttpRequest; // eslint-disable-line no-undef

function xdr( url, useBuffer ) {
  return new Promise( ( resolve, reject ) => {
    const req = new XMLHttpRequest();
    req.open( "get", url );
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

export function getFile( location ) {
  if ( fetch ) {
    return fetch( location ).then( response => response.text() );
  }
  if ( XMLHttpRequest ) {
    return xdr( location );
  }
  return fs.readFile( location, "utf8" );
}

export function getFileBuffer( location ) {
  if ( fetch ) {
    return fetch( location ).then( response => response.arrayBuffer() );
  }
  if ( XMLHttpRequest ) {
    return xdr( location, true );
  }
  return fs.readFile( location );
}
