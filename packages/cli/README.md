# @quase/cli

## About

A simple cli helper.

Based and adapted from [meow](https://github.com/sindresorhus/meow), and includes [update-notifier](https://github.com/yeoman/update-notifier), plus some features:

- We change the update notifier message if Yarn is detected.
- Passing a `configFiles` value automates the requiring of a config file. The user will be able to override the default using `--config=another-file.js`.
- Passing a `configKey` value automates the requiring of a config object from the `package.json` file, if a config file is not available.
- Support for `@quase/config`'s schema and defaults application.

## Usage example

`bin/index.js`

```js
#!/usr/bin/env node

require( "@quase/cli" ).default(
  ( {
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

  },
  {
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
    // false to disable notification
    notifier: {
      options: {}, // UpdateNotifier options
      notify: {} // .notify() options
    },
    // Infer the argument type. Default: false
    inferType: false,
    // The help text used with --help. Default: generated automatically from schema
    help: "",
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
  }
);
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

require( "@quase/cli" ).default( ( { options, input } ) => {
  require( "../dist" ).default( options, input );
}, {
  schema: {},
  configFiles: "sample.config.js",
  configKey: "sample"
} );
```
