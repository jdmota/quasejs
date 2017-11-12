/*

TODO

const visitedDirs = [];

findFiles( {
  src: [ "packages/builder/**", "!packages/**", "packages/cli/**" ],
  fs: {
    readdir( folder ) {
      visitedDirs.push( slash( path.relative( process.cwd(), folder ) ) );
      return fs.readdir( folder );
    }
  }
} ).subscribe( {
  next: x => console.log( "Output: ", x ),
  complete: () => console.log( visitedDirs.sort() )
} );

*/
