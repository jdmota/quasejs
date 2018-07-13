# Builder

## Config example

`quase-builder.config.js`

```js
module.exports = {
  mode: "production",
  dest: "dest",
  context: "src",
  entries: [ "index.html" ],
  publicPath: "./",
  serviceWorker: {
    filename: "service-worker.js",
    staticFileGlobs: [
      "index.html",
      "*.js",
      "*.css",
    ],
    cacheId: "CACHE-ID",
    navigateFallback: "index.html"
  },
  plugins: [
    "quase-builder-plugin",
    [ "quase-builder-plugin-2", { /* options */ } ],
    () => ( {} )
  ]
};
```

## Lifecycle

- Plugin: getType
- Plugin: load
- Plugin: transform's
- Plugin: dependencies
- Plugin: resolve
- Plugin: isSplitPoint
- Plugin: getGeneration
- Plugin: check
- Plugin: graphTransform's
- Plugin: renderAsset
- Plugin: afterBuild

## Plugins

Plugins are applied by the order they are in the array.

Plugins are also deduplicated by name. This allows you to set options on internal plugins (for example), without having them run twice.
The ones that appear first in the array take precedence.

A plugin is a function that returns an object with one or more of the following properties:

### name

It's a string with the name of the plugin. Optional but should be used.

### getType

A synchronous function which receives `( path: string )` and returns a string with the type of the file.

The default is the extension of the file.

### load

A (maybe asynchronous) function that accepts `( path: string, m: ModuleUtils )` and returns `null` or `Buffer | string`.

Returning `null` defers to other `load` functions.

The default is to load from the file system.

### transform

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( { data, map, ast }, ModuleUtils )` and returns `null` or:

```
{
  data: Buffer | string,
  ast: ?Object,
  map: ?Object
}
```

Transforms are applied in sequence. `null` values are ignored. The function receives as first argument the output from the last transformer.

The builder will use the last output from the last transformer.

### dependencies

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( { data, map, ast }, ModuleUtils )` and returns `null` or:

```
{
  dependencies: NotResolvedDep[],
  importedNames: ImportedName[],
  exportedNames: ExportedName[]
}
```

### resolve

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( importee: string, importer: ModuleUtils )` and returns `null`, `false` or a path to the resolved file.

Returning `null` defers to other `resolve` functions. Returning `false` means the resolution should stop because the dependency was not found.

### isSplitPoint

A (maybe asynchronous) function that accepts `( importee: ModuleUtils, importer: ModuleUtils )` and returns `null` or a boolean.

Returning `null` defers to other `isSplitPoint` functions.

This function is used to decide if in the final result a importee module should go in a different file than the importer. The default is to exclude modules with a different type associated with it or when an asynchronous import is used.

## getGeneration

A synchronous function that accepts `( importee: ModuleUtils, importer: ?ModuleUtils )` and returns `null` or an array of strings.

Returning `null` defers to other `getGeneration` functions.

The function is used to decide if, for example, a CSS file should be converted to JS, when a JS module is importing it.

The array can suply various convertions.

The default is to do nothing.

```js
export default function() {
  return {
    getGeneration( importee, importer ) {
      // If it's an entry file, don't convert
      if ( !importer ) {
        return [];
      }
      // If what is importing is a JS file,
      // convert the importee to JS too
      if ( importer && importer.type === "js" ) {
        return [ "js" ];
      }
    }
  };
}
```

### checker

A (maybe asynchronous) function that receives the `Builder` and throws an error to stop the build if a necessary check failed.

All `check` functions are called in order.

### graphTransformer

A (maybe asynchronous) function that receives the produced graph and transforms it.

All `graphTransformer` functions are called in order passing the last produced value to each other.

The last graph produced will be used.

### renderAsset

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( FinalAsset, FinalAssets, Builder )` and returns `null` or `ToWrite`.

Returning `null` defers to other `renderAsset` functions.

### afterBuild

A (maybe asynchronous) function that is called after the build was done and the files were wrote to the file system.

## ModuleUtils

Information that each module provides:

- `id`: an unique id of the module
- `type`: type of the module
- `path`: string path of the file
- `normalized`: string path relative to the `context` provided in the options

Some useful functions you can find:

### builderOptions()

Returns the options passed to the builder.

Useful to know if source map generation was requested, for example.

```js
moduleUtils.builderOptions().optimization.sourceMaps // boolean | "inline"
```

### createFakePath( key: string ): string

A function that returns a fake path that you can use.

### isFakePath( path: string ): boolean

Returns `true` if the string contains a fake path.

### async stat( path: string )

Same as the `fs.stat` but returns a promise.

You should use this instead of the native `fs.stat` to tell the builder that it should watch the file in `path` for changes.

### async readFile( path: string, encoding: ?string )

Same as the `fs.readFile` but returns a promise.

You should use this instead of the native `fs.readFile` to tell the builder that it should watch the file in `path` for changes.

### cacheGet( key: any ): any

Get the value associated with `key` from the cache map associated with this module.

### cacheSet( key: any, value: any ): any

Set a key on the cache map associated with this module.

### cacheDelete( key: any ): boolean

Delete a key on the cache map associated with this module.
