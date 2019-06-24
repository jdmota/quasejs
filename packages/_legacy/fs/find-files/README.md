# @quase/find-files

`node-glob` alternative.

```js
const { default: findFiles, findFilesObservable } = require( "@quase/find-files" );

( async () => {
  const paths = await findFiles( [] );

  findFilesObservable( [] ).subscribe( {
    next( file ) {
      console.log( file );
    }
  } );
} )();
```

## findFiles( patterns[, options] )

### Options

**cwd**

The current working directory in which to search.

Default: `process.cwd()`.

**relative**

If set to `true`, emitted files will be relative to `cwd` and have `\\` normalized to `/`.

Default: `false`.

**append**

An array of patterns to append to the array. Used to override the default.

Default: `[]`.

**micromatch**

Options to be passed to micromatch.

Default: `{}`.

**includeDirs**

Include directories in the output.

Default: `false`.

