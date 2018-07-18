# @quase/config

## About

Provides utilities to get configuration (from a file or `package.json`), apply defaults and validate options.

```js
import { getConfig, applyDefaults, t, validate, printError } from "@quase/config";

const schema = {
  foo: {
    type: "boolean",
    optional: true,
    deprecated: true
  },
  bar: {
    type: "boolean",
    default: true
  },
  object: t.object( {
    properties: {
      prop: {
        type: "number",
        default: 10,
        example: 10
      }
    }
  } ),
  tuple: t.tuple( {
    items: [ "string", "string" ]
  } ),
  array: t.array( {
    itemType: "number",
    merge: "concat"
  } ),
  value: t.choices( {
    values: [ 0, 1, 2 ],
    default: 0
  } )
};

const config = await getConfig( {
  cwd: process.cwd(),
  // If the config file exports a function, that function will be called with this argument.
  // The return value will be the config object.
  // The function can be asynchronous.
  arg: undefined,
  configFiles: [],
  configKey: "",
  failIfNotFound: false
} );

const options = applyDefaults( schema, [ config ], [ "config" ] ); // The first object passed (after schema) takes precedence

try {
  validate( schema, options );
} catch ( e ) {
  printError( e );
}
```

### Merge mode

It is used to customize how values are merged when applying defaults and merging multiple objects.

- `"override"`: Just sets the value without merging.
- `"merge"`: If they are arrays, merge them.
- `"concat"`: If they are arrays, just concats them.
- `"spreadMeansConcat"`: If they are arrays, concat them when the value with higher precedence has `"..."` as its first element.
