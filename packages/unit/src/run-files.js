// TODO

const childProcess = require( "child_process" );
const path = require( "path" );
const os = require( "os" );

const cpus = os.cpus ? os.cpus() : [];

export default function( opts ) {
  return cpus.map( () => {
    return childProcess.fork( path.join( __dirname, "fork.js" ), opts.args, {
      cwd: opts.projectDir,
      silent: true,
      env: process.env,
      execArgv: opts.execArgv || process.execArgv
    } );
  } );
}
