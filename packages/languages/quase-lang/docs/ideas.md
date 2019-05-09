# Ideias for investigation

Just some random ideas that pop up in my head or concepts that I find.

## Language features

- Advanced type system
  - Support assertions, for example, that we have a number type, that should be less than 10
- Statically define or infer side-effects.
- Statically define or infer possible circular references.
- Statically define or infer the refinements that functions produce.
  - Inspiration:
    - https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards
- Statically define or infer the states of an object.
  - Consecutive writes should be fine.
  - A read on an inconsistent state should warn.
- Behavioural types?
- Dependent types? Allow for manipulation of types like normal values.
- Ownership?
  - Inspiration:
    - https://github.com/Microsoft/TypeScript/issues/16148
    - Rust-lang
- Remove need for a garbage collector?
  - Should be optional.
  - Only needed if we in the future desire native support.
- Deal with aliasing
- Hoare Logic and Separation Logic
  - Support some inference

## Provide as a library or in the language?

- Help with the problems of concurrency?
  - Study different paradigms: message passing, shared state, lock-free, functional.
  - Concurrent Revisions?
    - https://www.microsoft.com/en-us/research/project/concurrent-revisions/
- Help with data serialization
  - For example to save some application state, and then restore it.
- Help with data storage
  - Change history, versions, know what changed, hashing
- Help with the problems of mutability?
  - Just go for immutability?
  - Observe changes?
  - History of what changed?
- Help with data and computations
  - Computations should be pure or declare all their dependencies.
  - Cancellation should be possible.
    - Cancelled computations should not be able to declare new dependencies.
  - Cache results.
  - Support cache invalidation (active and passive?).
    - If some value is invalidated, other values that depend on that should be invalidated as well.
    - Or, when running the computation again, check if the dependencies changed.
  - Static computations and static dependencies should be detected by the compiler.
- Help with objects that have references to other objects of the same type, and destroy those links.

## Things the compiler should do

- Optimize initial load.
  - Initial memory snapshot.
- Removal of dead code
  - Optional: show which code gets removed
- Allow for plugins
  - Linting
  - New type checking features
    - Type providers
- Detect data dependencies.
  - Example: to be able to use something like JSX to create a DOM element, and have the compiler just find out what EXACTLY will change if a certain variable changes value.
  - If a value depends on the result of a function, see if the function is pure and if it produces always the same output on same input.
- Optimizations
  - Caching of function results
  - Caching of function side-effects
    - Ignore side-effects that are not read later.
  - Move functions
    - A function that does not depend on state inside its scope, can be moved to an outer scope.
  - Optimize a function for certain parameters

## Dev tools

- Language server
- Auto correct name spelling
- Create console extension for Chrome DevTools

## Domains to consider

- Web development
- DevOps
- Systems programming
- Network programming
- Databases
- Security
- Data science
- Finance/Commerce
- Desktop/GUI applications
- Mobile
- Embedded devices/Internet of Things
- AI
- Academic/Scientific/Numeric
- Gaming
