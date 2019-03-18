# @quase/config

## About

Provides utilities to get configuration (from a file or `package.json`).

```js
import { getConfig } from "@quase/config";

const { config, location } = await getConfig( {
  cwd: process.cwd(),
  // If the config file exports a function, that function will be called with this argument.
  // The return value will be the config object.
  // The function can be asynchronous.
  arg: undefined,
  configFiles: [],
  configKey: "",
  failIfNotFound: false
} );
```
