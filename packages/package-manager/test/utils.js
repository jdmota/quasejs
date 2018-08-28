const path = require( "path" );
const childProcess = require( "child_process" );

export async function testProcess( file ) {

  const p = childProcess.fork( file, {
    stdio: "pipe"
  } );

  let str = "";

  await new Promise( resolve => {
    p.stdout.on( "data", data => {
      str += data;
    } );

    p.stderr.on( "data", data => {
      str += data;
    } );

    p.on( "close", code => {
      str += `\nchild process exited with code ${code}`;
      resolve();
    } );
  } );

  return str;
}

const homedir = require( "os" ).homedir();

export function createStore( key ) {
  return path.resolve( homedir, ".qpm-store-test", key );
}
