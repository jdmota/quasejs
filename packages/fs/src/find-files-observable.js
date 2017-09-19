import req from "../../_helper/require";

const fs = req( "fs-extra" );
const path = req( "path" );
const mm = req( "micromatch" ); // FIXME don't depend on micromatch
const slash = req( "slash" );
const Observable = req( "zen-observable" );

const { stat: fsStatPromise, readdir: fsReadDirPromise } = fs;

class Pattern {

  constructor( pattern, options ) {
    const expand = mm.expand( pattern, options );
    const regexp = new RegExp( expand.pattern );
    this.matcher = regexp.test.bind( regexp );
    this.fullBase = slash( path.normalize( expand.tokens.base || path.dirname( pattern ) ) );
    this.negated = expand.negated;
  }

  matchesBase( dir ) {
    const fullBase = this.fullBase;
    const len = Math.min( fullBase.length, dir.length );
    for ( let i = 0; i < len; i++ ) {
      if ( fullBase.charCodeAt( i ) !== dir.charCodeAt( i ) ) {
        return false;
      }
    }
    return true;
  }

}

class Reader {

  constructor( patterns, cwd, observer, includeDirs ) {
    this.patterns = patterns;
    this.cwd = cwd;
    this.observer = observer;
    this.cancelled = false;
    this.pending = 0;
    this.includeDirs = !!includeDirs;
    this.error = this.error.bind( this );
    this.cancel = this.cancel.bind( this );
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
  //    1      0     return false
  //    1      1     keep going
  matches( string ) {
    let negated, matches, patterns = this.patterns, i = patterns.length;
    while ( i-- ) {
      negated = patterns[ i ].negated;
      matches = patterns[ i ].matcher( string );
      if ( negated !== matches ) {
        return matches;
      }
    }
    return false;
  }

  matchesBase( dir ) {
    let matches, patterns = this.patterns, i = patterns.length;
    while ( i-- ) {
      matches = patterns[ i ].matchesBase( dir );
      if ( matches ) {
        return true;
      }
    }
    return false;
  }

  readDir( folder ) {

    this.pending++;

    fsReadDirPromise( folder ).then( files => {

      if ( this.cancelled ) {
        return;
      }

      this.pending += files.length - 1;

      files.forEach( file => {

        file = path.join( folder, file );

        fsStatPromise( file ).then( stats => {

          if ( this.cancelled ) {
            return;
          }

          const relativePath = path.relative( this.cwd, file );
          const relativePathNormalized = slash( relativePath );
          const checkBoth = relativePath !== relativePathNormalized;

          this.pending--;

          if ( stats.isDirectory() ) {
            if ( this.includeDirs && ( this.matches( relativePath ) || ( checkBoth && this.matches( relativePathNormalized ) ) ) ) {
              this.next( relativePathNormalized );
              this.readDir( file );
            } else if ( this.matchesBase( relativePath ) || ( checkBoth && this.matchesBase( relativePathNormalized ) ) ) {
              this.readDir( file );
            }
          } else if ( stats.isFile() ) {
            if ( this.matches( relativePath ) || ( checkBoth && this.matches( relativePathNormalized ) ) ) {
              this.next( relativePathNormalized );
            }
          }

          this.checkPending();

        }, this.error );

      } );

      this.checkPending();

    }, this.error );

    return this;

  }

}

function makeSureArray( obj ) {
  if ( typeof obj === "string" ) {
    return [ obj ];
  }
  return Array.isArray( obj ) ? obj : [];
}

/*
src: [ "*.js" ], // Actual pattern(s) to match.
{
  cwd: "lib/",   // Src matches and files emitted are relative to this path.
  micromatch: {} // Options to be passed to micromatch or `false`.
}
*/
function findFiles( src, options = {} ) {

  const cwd = options.cwd ? path.resolve( options.cwd ) : process.cwd();

  const patterns = makeSureArray( src ).map( pattern => new Pattern( pattern, options.micromatch ) );

  return new Observable( observer => new Reader( patterns, cwd, observer, options.includeDirs ).readDir( cwd ).cancel );

}

export default findFiles;
