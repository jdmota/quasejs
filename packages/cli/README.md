## About

It's like `meow` but includes `update-notifier`.

We also change the update message if Yarn is detected.

## Usage example

`bin/my-name`

```js
#!/usr/bin/env node
"use strict";

require( "@quase/cli" ).default(
  ( { input, flags, pkg, help, showHelp } ) => {

  },
  {}, // Meow options
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
    "my-name": "bin/my-name"
  },
}
```

See https://github.com/sindresorhus/meow for details.

See https://github.com/yeoman/update-notifier for details.
