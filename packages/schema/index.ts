// Inspired in:
// https://zod.dev/
// https://gcanti.github.io/io-ts/
// https://github.com/sinclairzx81/typebox
// https://mael.dev/typanion/
// https://pure-parse.vercel.app/guide/why-pure-parse.html
// https://jsonforms.io/
// https://www.effect.website/docs/v4/schema/introduction

// Question: Why parse and not just validate? Or, why not support both?
// Answer: I believe that one should use this schema tool to handle user options and other user input. If that is the case, one should be safe and just clone the objects (thus also avoiding unwanted and hidden properties that might be a source of security issues). Pure validation is probably not needed because, when it comes to objects internal to libraries, these ideally should be statically typed anyway.

// Decode
// Encode
// Transforms, additional checks (before, after, etc.), coercions, defaults
// Generate equals + hash + formatter
// Form generation
// Cli args generator
// Merge?
// Convert from one schema version to another

// TODO branded types
// TODO intersection parse based on merge?
// TODO readonly: apply Object.freeze on parse?

// TODO in form generation, we could make disabled options be marked with null, and customized with decorators (or other operators?)

export {};
