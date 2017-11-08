const childProcess = require( "child_process" );
const path = require( "path" );

/* eslint-disable no-console, no-process-exit */

function run( command ) {
  process.env.PATH = path.resolve( "./node_modules/.bin" ) + path.delimiter + process.env.PATH;

  const commandArr = command.split( " " );
  const child = childProcess.spawn( commandArr[ 0 ], commandArr.slice( 1 ), {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    shell: true
  } );

  child.on( "close", code => {
    process.exitCode = code;
  } );
}

const args = process.argv.slice( 2 );
const publish = args[ 0 ] === "publish";
const pkg = args[ 1 ];

if ( typeof pkg !== "string" ) {
  console.error( pkg + " is not a string." );
  process.exit( 1 );
}

const pkgFolder = path.join( "packages", pkg ).replace( /\\+/g, "/" );
const src = path.join( "packages", pkg, "src" ).replace( /\\+/g, "/" );
const dist = path.join( "packages", pkg, "dist" ).replace( /\\+/g, "/" );

const babel = `babel ${src} --out-dir ${dist} --copy-files`;

const canPublish = true;

const publishCommand = canPublish ? "yarn publish --access public" : "echo Ignoring publishing!";

const command = publish ?
  `${babel} && cd ${pkgFolder} && yarn config set version-git-tag false && ${publishCommand} && echo Success!` :
  `${babel} && echo Success!`;

console.log( `Running '${command}' ...` );

run( command );
