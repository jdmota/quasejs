# Builder

## Features

- Automatic code splitting when using `import()`
- Customizable code splitting
- Hot Module Replacement support
- Automatic service worker creation support
- Supports any file type or language, even images, not just JavaScript
- Supports any file types as entries, like HTML
- Thanks to the plugin architecture, inlined JavaScript in HTML is possible
- `load` and `error` events are emitted for script tags, replicating the `<script type="module">` behaviour
- The runtime is small (2kB or less) and is able to fetch the necessary scripts for each module in parallel
- Errors have code frames to help pinpoint to the problem
- In watch mode, if you change a file, the build is restarted without waiting for the previous build to finish

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
    [ "quase-builder-plugin-2", { /* options */ } ]
  ]
};
```

## Lifecycle

- Plugin: getType
- Plugin: load
- Plugin: parse
- Plugin: transformAst's
- Plugin: transformBuffer's
- Plugin: dependencies
- Plugin: resolve
- Plugin: isSplitPoint
- Plugin: getTypeTransforms
- Plugin: transformType's
- Plugin: check
- Plugin: graphTransform's
- Plugin: renderAsset

## Plugins

Plugins are applied by the order they are in the array.

Plugins are also deduplicated by name. This allows you to set options on internal plugins (for example), without having them run twice.
The ones that appear first in the array take precedence.

A plugin is a function that returns an object with one or more of the following properties:

### name

It's a string with the name of the plugin. Optional, but should be used.

### getType

A synchronous function which receives `( path: string )` and returns a string with the type of the file.

The default is the extension of the file.

### load

A (maybe asynchronous) function that accepts `( path: string, m: ModuleContext )` and returns `null` or `Buffer | string`.

Returning `null` defers to other `load` functions.

The default is to load from the file system.

### parse

A (maybe asynchronous) function that accepts `( data: string, m: ModuleContext )` and returns `null` or an object (the AST).

Returning `null` defers to other `parse` functions.

If no AST is produced, the module contents will be a buffer and `transformBuffer`'s will be called instead of `transformAst`'s in the next phase.

### transformAst

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( ast, ModuleContext )` and returns `null` or a new AST.

Transforms are applied in sequence. `null` values are ignored. The function receives as first argument the output from the last transformer.

The builder will use the last output from the last transformer.

### transformBuffer

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( buffer, ModuleContext )` and returns `null` or a new buffer.

Transforms are applied in sequence. `null` values are ignored. The function receives as first argument the output from the last transformer.

The builder will use the last output from the last transformer.

### dependencies

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( ast, ModuleContext )` and returns `null` or:

```
{
  dependencies: Map<string, {
    loc: ?Loc,
    async: ?boolean
  }>,
  innerDependencies: Map<string, {
    type: string,
    data: Buffer | string,
    map: ?Object,
    loc: ?Loc,
    async: ?boolean
  }>,
  importedNames: ImportedName[],
  exportedNames: ExportedName[]
}
```

### resolve

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( importee: string, importer: ModuleContext )` and returns `null`, `false` or a path to the resolved file.

Returning `null` defers to other `resolve` functions. Returning `false` means the resolution should stop because the dependency was not found.

### isSplitPoint

A synchronous function that accepts `( importee: ModuleContext, importer: ModuleContext )` and returns `null` or a boolean.

Returning `null` defers to other `isSplitPoint` functions.

This function is used to decide if in the final result a importee module should go in a different file than the importer. The default is to exclude modules with a different type associated with it or when an asynchronous import is used.

## getTypeTransforms

A synchronous function that accepts `( importee: ModuleContext, importer: ?ModuleContext )` and returns `null` or an array of strings.

Returning `null` defers to other `getTypeTransforms` functions.

The function is used to decide if, for example, a CSS file should be converted to JS, when a JS module is importing it.

The array can suply various convertions.

The default is to do nothing.

```js
export default function() {
  return {
    getTypeTransforms( importee, importer ) {
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

### transformType

Each function (maybe asynchronous) is used to transform a module type to another. In the example below, the function transform `ts` modules into `js`.

Returning `null` defers to other plugins that might support that transformation.

```js
type TransformOutput = {
  ast: Object,
  buffer: void
} | {
  ast: void,
  buffer: Buffer
};

export default function() {
  return {
    transformType: {
      ts: {
        js( output: TransformOutput ) {
          // TODO generation
          return {
            data: "", // string | Buffer
            map: {}
          };
        }
      }
    }
  };
}
```

### check

A (maybe asynchronous) function that receives the `Builder` and throws an error to stop the build if a necessary check failed.

All `check` functions are called in order.

### graphTransform

A (maybe asynchronous) function that receives the produced graph and transforms it.

All `graphTransform` functions are called in order passing the last produced value to each other.

The last graph produced will be used.

### renderAsset

An object where the key is a module type, and the value a function.

The function can be asynchronous and accepts `( FinalAsset, FinalAssets, BuilderContext )` and returns `null` or `ToWrite`.

Returning `null` defers to other `renderAsset` functions.

## ModuleContext

### id

An unique id of the module.

### type

Type of the module.

### path

String path of the file.

### normalized

String path relative to the `context` provided in the options.

### builderOptions

Useful to know if source map generation was requested, for example.

```js
moduleUtils.builderOptions.optimization.sourceMaps // boolean | "inline"
```

### isFakePath( path: string ): boolean

Returns `true` if the string contains a fake path.

### createFakePath( key: string ): string

A function that returns a fake path that you can use.

### async stat( path: string )

Same as the `fs.stat` but returns a promise.

You should use this instead of the native `fs.stat` to tell the builder that it should watch the file in `path` for changes.

### async readFile( path: string, encoding: ?string )

Same as the `fs.readFile` but returns a promise.

You should use this instead of the native `fs.readFile` to tell the builder that it should watch the file in `path` for changes.

### async readdir( path: string )

Same as the `fs.readdir` but returns a promise.

You should use this instead of the native `fs.readdir` to tell the builder that it should watch the folder in `path` for changes.

### async isFile( path: string )

Checks if `path` is a file.
