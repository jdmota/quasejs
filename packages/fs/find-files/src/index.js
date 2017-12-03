const fs = require( "fs-extra" );
const path = require( "path" );
const ignoredDirectories = require( "ignore-by-default" ).directories().map( dir => `!**/${dir}/**` );
const mm = require( "micromatch" );
const globParent = require( "glob-parent" );
const slash = require( "slash" );
const Observable = require( "zen-observable" );

class Pattern {

  constructor( pattern, _opts ) {
    const options = this.negated ? Object.assign( {}, _opts, { dot: true } ) : _opts;

    this.negated = /^![^(]/.test( pattern );
    if ( this.negated ) {
      pattern = pattern.slice( 1 );
    }

    this.regexp = mm.makeRe( pattern, options );
    this.endsWithGlobstar = pattern.slice( -3 ) === "/**";
    this.parent = globParent( pattern ).replace( /^\.$/g, "" );
  }

}

class Reader {

  constructor( patterns, cwd, observer, options ) {
    this.patterns = patterns;
    this.cwd = cwd;
    this.observer = observer;
    this.cancelled = false;
    this.pending = 0;
    this.includeDirs = !!options.includeDirs;
    this.visitedDirs = options.visitedDirs;
    this.error = this.error.bind( this );
    this.cancel = this.cancel.bind( this );
    this.fsStat = options.fs.stat;
    this.fsReadDir = options.fs.readdir;
  }

  start() {
    for ( const { negated, parent } of this.patterns ) {
      if ( !negated ) {
        this.check( path.resolve( this.cwd, parent ) );
      }
    }
    this.checkPending();
    return this.cancel;
  }

  checkPending() {
    if ( this.pending === 0 ) {
      this.complete();
    }
  }

  next( file ) {
    this.observer.next( file );
  }

  complete() {
    this.observer.complete();
  }

  error( error ) {
    this.observer.error( error );
  }

  cancel() {
    this.cancelled = true;
  }

  // We start from the end
  // negated matches
  //    0      0     keep going
  //    0      1     return true
  //    1      0     keep going
  //    1      1     return false
  matches( string ) {
    const patterns = this.patterns;
    let i = patterns.length;
    while ( i-- ) {
      const negated = patterns[ i ].negated;
      const matches = patterns[ i ].regexp.test( string );
      if ( matches ) {
        return !negated;
      }
    }
    return false;
  }

  matchesDir( dir ) {
    const patterns = this.patterns;
    let i = patterns.length;
    while ( i-- ) {
      const p = patterns[ i ];
      if ( p.negated ) {
        if ( p.endsWithGlobstar ) {
          const matches = p.regexp.test( dir + "/" );
          if ( matches ) {
            return false;
          }
        }
      } else {
        const parent = p.parent;
        let matches = true;
        const len = Math.min( parent.length, dir.length );
        for ( let i = 0; i < len; i++ ) {
          if ( parent.charCodeAt( i ) !== dir.charCodeAt( i ) ) {
            matches = false;
            break;
          }
        }
        if ( matches ) {
          return true;
        }
      }
    }
    return false;
  }

  check( file ) {
    this.pending++;

    this.fsStat( file ).then( stats => {

      if ( this.cancelled ) {
        return;
      }

      this.pending--;

      const relativePath = slash( path.relative( this.cwd, file ) );

      if ( stats.isDirectory() ) {
        if ( this.includeDirs && this.matches( relativePath ) ) {
          this.next( file );
          this.readDir( file );
        } else if ( this.matchesDir( relativePath ) ) {
          this.readDir( file );
        }
      } else if ( stats.isFile() ) {
        if ( this.matches( relativePath ) ) {
          this.next( file );
        }
      }

      this.checkPending();

    }, this.error );
  }

  readDir( folder ) {
    if ( this.visitedDirs ) {
      this.visitedDirs.push( slash( path.relative( this.cwd, folder ) ) );
    }

    this.pending++;

    this.fsReadDir( folder ).then( files => {

      if ( this.cancelled ) {
        return;
      }

      this.pending--;

      files.forEach( f => this.check( path.join( folder, f ) ) );

      this.checkPending();

    }, this.error );
  }

}

function makeSureArray( obj ) {
  if ( typeof obj === "string" ) {
    return [ obj ];
  }
  return Array.isArray( obj ) ? obj : [];
}

/*
{
  src: [], // Pattern(s) to match.
  cwd: process.cwd(), // Files emitted are relative to this path.
  append: [], // An array of patterns to append to the array. Used to override the default.
  micromatch: {} // Options to be passed to micromatch.
  includeDirs: false // Include directories in the output.
}
*/
function findFiles( _opts ) {

  const options = Object.assign( {}, _opts );

  options.fs = options.fs || fs;
  options.fs.stat = options.fs.stat || fs.stat;
  options.fs.readdir = options.fs.readdir || fs.readdir;

  options.append = makeSureArray( options.append || ignoredDirectories );

  const cwd = options.cwd ? path.resolve( options.cwd ) : process.cwd();

  const patterns = makeSureArray( options.src ).concat( options.append ).map(
    pattern => new Pattern( pattern, options.micromatch )
  );

  return new Observable( observer => new Reader( patterns, cwd, observer, options ).start() );
}

export default findFiles;
