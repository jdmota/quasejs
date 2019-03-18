# @quase/cli

## About

A cli helper.

Adapted from [meow](https://github.com/sindresorhus/meow), plus some features:

- Includes [import-local](https://github.com/sindresorhus/import-local).
- Passing a `configFiles` value automates the requiring of a config file. The user will be able to override the default using `--config=another-file.js`.
- Passing a `configKey` value automates the requiring of a config object from the `package.json` file, if a config file is not available.
- Support for `@quase/schema`, which includes defaults application and validation.
  - The options are validated automatically against the schema. If validation fails, an error is throw. If the error is left unhandled, the promise will loudly reject.
- Automatic help generation from the schema.
- Supports [update-notifier](https://github.com/yeoman/update-notifier).
  - Update message is changed if Yarn is detected.
  - If you want to use it, you have to install it and set `notifier` to `true` or an object (like in the example below).

## Usage example

`bin/index.js`

```js
#!/usr/bin/env node

const { cli, t } = require( "@quase/cli" );

cli( {
  // If you pass an array, we try to find the first file
  configFiles: "sample.config.js",
  configKey: "sample",
  // An object.
  // For more info, see @quase/schema
  schema: `type Schema {
    // Without description, the flag will not appear in the help text.
    // But with "", it will.
    someFlagName: boolean @default(false) @description("") @alias("s");
    someObject: type {
      someProp: number;
    };
  }`,
  // Subcommands
  defaultCommand: "commandName", // Default: undefined
  commands: { // Default: {}
    commandName: {
      description: "",
      // Specific schema for this command
      schema: `type Schema {
        foo: boolean @default(false);
      }`
    }
  },
  // Default: false to disable notification
  notifier: {
    options: {}, // UpdateNotifier options
    notify: {} // .notify() options
  },
  // Should unparsed flags be stored in "--" or "_". Default: false
  "populate--": false,
  // Infer the argument type. Default: false
  inferType: false,
  // The help text used with --help. Default: generated automatically from the schema
  help: "",
  // Usage example. Used when generating the help text
  usage: "",
  // Description to show above the help text. Default: The package.json "description" property
  description: undefined,
  // Set a custom version output. Default: The package.json "version" property
  version: undefined,
  // Automatically show the help text when the --help flag is present
  autoHelp: true,
  // Automatically show the version text when the --version flag is present
  autoVersion: true,
  // Custom arguments object
  argv: process.argv.slice( 2 )
} ).then( ( {
  input, // Array with non-flag arguments
  options, // Flags, config, and defaults all applied - does not include "--"
  flags, // The flags only (without defaults applied) - includes "--" if "populate--" was true
  config, // The config object only
  configLocation, // The absolute path of the config/package.json file found
  pkg, // The package.json object
  generateHelp, // Function that returns the help text used with --help
  showHelp, // showHelp([code=2]) - Show the help text and exit with code
  showVersion, // showVersion() - Show the version text and exit
} ) => {

} );
```

`package.json`

```json
{
  "bin": {
    "sample": "bin/index.js"
  },
}
```

## Copy-paste example

`bin/index.js`

```js
#!/usr/bin/env node
const run = require( "../dist" ).default;

require( "@quase/cli" ).cli( {
  usage: "$ sample",
  schema: `type Schema {}`,
  configFiles: "sample.config.js",
  configKey: "sample"
} ).then( ( { options, input } ) => {
  run( options, input );
} );
```
