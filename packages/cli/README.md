## About

It's like `meow` but includes `update-notifier`.

We also change the update message if Yarn is detected.

## Usage example

`bin/my-name`

```js
#!/usr/bin/env node
"use strict";

require( "@quase/cli" )(
  {}, // Meow options
  {}, // Minimist options
  { isGlobal: false }, // .notify() options or false to disable notification
  ( { input, flags, pkg, help, showHelp } ) => {

  }
);
```

`package.json`

```json
{
  ...
  "bin": {
    "my-name": "bin/my-name"
  },
  ...
}
```

See https://github.com/sindresorhus/meow for details on the options.

> Keys passed to the minimist `default` option are decamelized, so you can for example pass in `fooBar: 'baz'` and have it be the default for the `--foo-bar` flag.

See https://github.com/yeoman/update-notifier for details on the `.notify()` options.
