# Builder

## Features

- Supports any file type or language, even images, not just JavaScript
- Supports any file types as entries, like HTML
- Thanks to the plugin architecture, inlined JavaScript in HTML is possible
- Thanks to the architecture, file changes are correctly detected and only what changed is updated
- Automatic code splitting when using `import()`
- Hot Module Replacement support
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
  resolvers: [],
  transformers: [],
  packagers: [],
  checkers: []
};
```

## Plugins

Plugins are also deduplicated by name. This allows you to set options on internal plugins (for example), without having them run twice.

```ts
type MaybeAsync<T> = T | Promise<T>;
type MaybeAsyncOptional<T> = MaybeAsync<T | null | undefined>;

type Resolver = {
  name?: string;
  options?( options: any ): MaybeAsync<any>;
  resolve( options: any, imported: string, ctx: ModuleContext ): MaybeAsyncOptional<string | false | { path: string; transforms?: Transforms }>;
};

type Transformer = {
  name?: string;
  options?( options: any ): MaybeAsync<any>;
  canReuseAST?: ( options: any, ast: AstInfo ) => boolean;
  parse?: ( options: any, asset: TransformableAsset, ctx: ModuleContext ) => MaybeAsync<AstInfo>;
  transform?: ( options: any, asset: TransformableAsset, ctx: ModuleContext ) => MaybeAsync<TransformableAsset>;
  generate?: ( options: any, asset: TransformableAsset, ctx: ModuleContext ) => MaybeAsync<GenerateOutput>;
};

type Checker = {
  name?: string;
  options?( options: any ): MaybeAsync<any>;
  checker( options: any, _: { warn: WarnCb; error: ErrorCb } ): {
    newModule( module: FinalModule ): void;
    deletedModule( id: string ): void;
    check(): MaybeAsync<void>;
  };
};

type Packager = {
  name?: string;
  options?( options: any ): MaybeAsync<any>;
  pack( options: any, asset: FinalAsset, inlines: Map<FinalAsset, ToWrite>, ctx: BuilderUtil ): MaybeAsyncOptional<ToWrite>;
};
```

## ModuleContext

### id

An unique id of the module.

### path

String absolute path of the module.

### relativePath

String relative path of the module. Relative to the `context` provided in the options.

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
