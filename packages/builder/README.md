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

- Plugin: load
- Plugin: transform's
- Plugin: getLanguage
- Plugin: resolve
- Plugin: checker
- Graph production
  - Plugin: isSplitPoint
- Plugin: graphTransform's
- Render
  - language.renderAsset
- Plugin: afterBuild

## Plugins

Plugins are applied by the order they are in the array.

A plugin is a function that returns an object with one or more of the following properties:

### name

It's a string with the name of the plugin. Optional but should be used.

### load

A (maybe asynchronous) function that accepts `( id: string, builder: Builder )` and returns `null` or:

```
{
  type: string,
  data: Buffer | string,
  map: ?Object
} | {
  type: string,
  ast: Object
}
```

`type` is a string that represents the type of data. Examples: `js`, `html`.

`data` is a buffer or a string with the data.

Returning `null` defers to other `load` functions.

The default is to load from the file system, having `type` as the extension of the file.

### transform

A (maybe asynchronous) function that accepts `( { type, data, map, ast }, Module, Builder )` and returns `null` or:

```
{
  type: string,
  data: Buffer | string,
  map: ?Object
} | {
  type: string,
  data: Buffer | string,
  ast: Object
}
```

Transforms are applied in sequence. `null` values are ignored. The function receives as first argument the output from the last transformer (or loader, if it's the first transform).

You can optionally return a sourcemap or an ast, but not both. At the end, sourcemaps will be collapsed automatically, you don't have to do that.

The builder will use the last output from the last transformer.

### getLanguage

A (maybe asynchronous) function that accepts `( Module, Builder )` and returns `null` or a `Language`.

Returning `null` defers to other `getLanguage` functions.

This function is used to associate a language type to a module.

### resolve

A (maybe asynchronous) function that accepts `( importee: string, importer: Module, Builder )` and returns `null`, `false` or a path to the resolved file.

Returning `null` defers to other `resolve` functions. Returning `false` means the resolution should stop because the dependency was not found.

This function is used to resolve a dependency of a module. The default is to use the `resolve` function from the language.

### isSplitPoint

A (maybe asynchronous) function that accepts `( importee: Module, importer: Module, Builder )` and returns `null` or a boolean.

Returning `null` defers to other `isSplitPoint` functions.

This function is used to decide if in the final result a importee module should go in a different file than the importer. The default is to exclude modules with a different type associated with it.

Note that the function is not called for asynchronous dependency imports (like `import()` in JavaScript). For those the split will happen always by default.

### checker

A (maybe asynchronous) function that receives the `Builder` and throws an error to stop the build if a necessary check failed.

All `check` functions are called in order.

### graphTransformer

A (maybe asynchronous) function that receives the produced graph and transforms it.

All `graphTransformer` functions are called in order passing the last produced value to each other.

The last graph produced will be used.

### afterBuild

A (maybe asynchronous) function that is called after the build was done and the files were wrote to the file system.

## Builder

Some useful functions you can find in the builder:

### createFakePath( string )

A function that returns a fake path that you can use.

## Module

Information that each module provides:

- `path`: string path of the file
- `normalized`: string path relative to the `context` provided in the options
- `dest`: the destination path
- `id`: an unique id of the module

## Language

See examples of Language implementations at:

- [Base class](/packages/builder/src/language.js)
- [HTML](/packages/builder/src/languages/html.js)
- [JS](/packages/builder/src/languages/js.js)
