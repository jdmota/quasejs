## About

A simple cli helper.

Includes `meow` and `update-notifier` with some extensions:

- We change the update message if Yarn is detected.
- Passing a `defaultConfigFile` value automates the requiring of a config file. The user will be able to override the default using `--config=another-file.js` or `--config=none` (if he just wants to send an empty object as config).

## Usage example

`bin/index.js`

```js
#!/usr/bin/env node

require( "@quase/cli" ).default(
  ( { input, flags, pkg, help, config /* the config object, if "defaultConfigFile" was used */ } ) => {

  },
  {
    defaultConfigFile: "config.js"
  }, // Meow options + optional defaultConfigFile
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
    "my-name": "bin/index.js"
  },
}
```

See https://github.com/sindresorhus/meow for details.

See https://github.com/yeoman/update-notifier for details.

## Copy-paste example

`bin/index.js`

```js
#!/usr/bin/env node
/* eslint-disable no-shebang */

require( "@quase/cli" ).default( function( o ) {
  require( "../dist" ).default( Object.assign( o.config, o.flags ) );
}, {
  defaultConfigFile: "my-name-config.js"
} );
```
