# @quase/cli

## About

A cli helper.

Adapted from [meow](https://github.com/sindresorhus/meow), plus some features:

- Includes [import-local](https://github.com/sindresorhus/import-local).
- Includes [update-notifier](https://github.com/yeoman/update-notifier).
  - We change the update notifier message if Yarn is detected.
- Passing a `configFiles` value automates the requiring of a config file. The user will be able to override the default using `--config=another-file.js`.
- Passing a `configKey` value automates the requiring of a config object from the `package.json` file, if a config file is not available.
- Support for `@quase/config`'s schema, defaults application, and validation.
- Automatic help generation.

## Usage example

`bin/index.js`

```js
#!/usr/bin/env node

require( "@quase/cli" ).default( {
  // If you pass an array, we try to find the first file
  configFiles: "sample.config.js",
  configKey: "sample",
  // Function or just the object. For more info, see @quase/config
  schema( t ) {
    return {
      someFlagName: {
        type: "boolean",
        description: "",
        alias: "s",
        default: false
      },
      someObject: {
        type: t.object( {
          someProp: {
            type: "number"
          }
        } )
      }
    };
  },
  // Automatically validate the options against the schema. If validation fails, an error is throw.
  // If the error is left unhandled, the promise will loudly reject.
  // See @quase/config for more info.
  // Default: true
  validate: true,
  // Subcommands
  defaultCommand: "commandName", // Default: undefined
  commands: { // Default: {}
    commandName: {
      description: "",
      schema: { // Specific schema for this command. Can also be a function.
        foo: {
          type: "boolean"
        }
      }
    }
  },
  // false to disable notification
  notifier: {
    options: {}, // UpdateNotifier options
    notify: {} // .notify() options
  },
  // Infer the argument type. Default: false
  inferType: false,
  // The help text used with --help. Default: generated automatically from schema
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
  options, // Flags, config, and defaults all applied
  flags, // The flags only (without defaults applied yet)
  config, // The config object only
  configLocation, // The absolute path of the config file found or "pkg"
  pkg, // The package.json object
  help, // The help text used with --help
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

require( "@quase/cli" ).default( {
  usage: "$ sample",
  schema: {},
  configFiles: "sample.config.js",
  configKey: "sample"
} ).then( ( { options, input } ) => {
  run( options, input );
} );
```
