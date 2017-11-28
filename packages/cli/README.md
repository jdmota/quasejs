## About

A simple cli helper.

Includes `meow` and `update-notifier` with some extensions:

- We change the update message if Yarn is detected.
- Passing a `defaultConfigFile` value automates the requiring of a config file. The user will be able to override the default using `--config=another-file.js`.
- Passing a `configKey` value automates the requiring of a config object from the `package.json` file, if a config file is not available.

## Usage example

`bin/index.js`

```js
#!/usr/bin/env node

require( "@quase/cli" ).default(
  ( {
    input,
    flags,
    pkg,
    help,
    config, /* the config object */
    configLocation, /* the absolute path of the config file or "pkg" */
  } ) => {

  },
  {
    defaultConfigFile: "sample.config.js",
    configKey: "sample"
  }, // Meow options + optional configs
  {
    options: {}, // UpdateNotifier options
    notify: {} // .notify() options
  }, // false to disable notification
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

See https://github.com/sindresorhus/meow for details.

See https://github.com/yeoman/update-notifier for details.

## Copy-paste example

`bin/index.js`

```js
#!/usr/bin/env node

require( "@quase/cli" ).default( ( { input, flags, config } ) => {
  require( "../dist" ).default( Object.assign( {}, config, flags ), input );
}, {
  defaultConfigFile: "sample.config.js",
  configKey: "sample"
} );
```
