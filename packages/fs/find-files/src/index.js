const fs = require( "fs-extra" );
const path = require( "path" );
const ignoredDirectories = require( "ignore-by-default" ).directories().map( dir => `!**/${dir}/**` );
const mm = require( "micromatch" );
const globParent = require( "glob-parent" );
const toAbsoluteGlob = require( "to-absolute-glob" );
const isNegatedGlob = require( "is-negated-glob" );
const slash = require( "slash" );
const Observable = require( "zen-observable" );

class Pattern {

  constructor( _pattern, { cwd, micromatch } ) {
    const micromatchOpts = this.negated ? Object.assign( {}, micromatch, { dot: true } ) : micromatch;
    const { negated, pattern } = isNegatedGlob( _pattern );
    this.negated = negated;
    this.regexp = mm.makeRe( pattern, micromatchOpts );
    this.endsWithGlobstar = pattern.slice( -3 ) === "/**";
    this.parent = globParent( pattern ).replace( /^\.$/g, "" );
    this.fullParent = toAbsoluteGlob( this.parent, { cwd } );
  }

}

class Reader {

  constructor( patterns, observer, options ) {
    this.patterns = patterns;
    this.cwd = options.cwd;
    this.observer = observer;
    this.cancelled = false;
    this.pending = 0;
    this.includeDirs = options.includeDirs;
    this.visitedDirs = options.visitedDirs;
    this.relative = options.relative;
    this.fsStat = options.fs.stat;
    this.fsReadDir = options.fs.readdir;
    this.error = this.error.bind( this );
    this.cancel = this.cancel.bind( this );
  }

  start() {
    for ( const { negated, fullParent } of this.patterns ) {
      if ( !negated ) {
        this.check( fullParent );
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
          this.next( this.relative ? relativePath : file );
          this.readDir( file );
        } else if ( this.matchesDir( relativePath ) ) {
          this.readDir( file );
        }
      } else if ( stats.isFile() ) {
        if ( this.matches( relativePath ) ) {
          this.next( this.relative ? relativePath : file );
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

function makeSureArray( val ) {
  if ( val == null ) {
    return [];
  }
  return Array.isArray( val ) ? val : [ val ];
}

export function findFilesObservable( src, _opts ) {

  const options = Object.assign( {}, _opts );

  options.cwd = options.cwd ? path.resolve( options.cwd ) : process.cwd();
  options.fs = options.fs || fs;
  options.fs.stat = options.fs.stat || fs.stat;
  options.fs.readdir = options.fs.readdir || fs.readdir;
  options.append = makeSureArray( options.append || ignoredDirectories );

  const patterns = makeSureArray( src ).concat( options.append ).map(
    pattern => new Pattern( pattern, options )
  );

  return new Observable( observer => new Reader( patterns, observer, options ).start() );
}

export default function( patterns, options ) {
  return new Promise( ( resolve, reject ) => {
    const files = [];

    findFilesObservable( patterns, options ).subscribe( {
      error: reject,
      next: x => files.push( x ),
      complete: () => resolve( files )
    } );
  } );
}
