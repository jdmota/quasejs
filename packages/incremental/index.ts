// https://github.com/adamhaile/S-array
// https://github.com/adamhaile/S
// https://github.com/solidjs/solid/blob/main/packages/solid/src/reactive/array.ts

// Dependencies:
// Read cell
// Write cell
// Create cell
// Call computation

/*
ctx = {
  read(cell),
  write(cell, value),
  alloc(),
  call(computation, arguments)
}

To avoid circular dependencies, we can force each computation to state the types of computations it will depend on. This will force the computation classes to be defined before the ones that will depend on it.

Creating a computation inside another one is just moving the computation to the outer scope and having the context as an argument. So, this functionality is not needed.
*/
