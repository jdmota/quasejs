// @flow

const pathUrl = require( "@quase/path-url" );
const path = require( "path" );

export function dirname( p: string ): string {
  return pathUrl.lowerPath( path.dirname( p ) );
}

export function makeAbsolutePath( p: string ): string {
  return pathUrl.lowerPath( pathUrl.makeAbsolutePath( p ) );
}

export function cacheableJob<T>( jobAsync: () => Promise<T>, jobSync: () => T ) {
  return {
    value: undefined,
    promise: undefined,
    error: undefined,
    async async( ...args: any[] ): Promise<T> {
      if ( this.error ) {
        throw this.error;
      }
      if ( this.value === undefined ) {
        if ( this.promise === undefined ) {
          this.promise = jobAsync( ...args ).then( v => {
            this.value = v;
            this.promise = undefined;
            return v;
          }, e => {
            this.error = e;
            this.promise = undefined;
            throw e;
          } );
        }
        return this.promise;
      }
      return this.value;
    },
    sync( ...args: any[] ): T {
      if ( this.error ) {
        throw this.error;
      }
      if ( this.value === undefined ) {
        try {
          this.value = jobSync( ...args );
          this.promise = undefined;
          return this.value;
        } catch ( e ) {
          this.error = e;
          this.promise = undefined;
          throw e;
        }
      }
      return this.value;
    }
  };
}
