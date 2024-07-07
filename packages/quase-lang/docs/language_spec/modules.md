# Modules

Each file is a module.

Each module imports or exports live bindings.

Think of the exported names as a set of key-value pairs, like in objects.

```js
import { a, ...b } from "./a";

export { a, ...b };
```

```js
const a = 10;
export { a };
// Equals
export const a = 10;
```

## Notes

The compiler must be able to know all the exported and imported names statically.

```js
import { a, ...b } from "./a";

export { a, ...b }; // To use spread here, the structure of `b` must be known statically

// Which should be possible, unless we have some kind of circular dependency
```
