# Unit

## :construction: This is a work in progress :construction:

## About

- Minimal and fast.
- Simple test syntax.
- No implicit globals.
- Node and browser support.
- Global variables detection.
- Error stacks are cleaned and point to the original file and location (if a sourcemap is found).
- Let's you know about errors that happened after tests have finished.
- Ctrl+C lets you interrupt tests, and after hooks are still called.
- After calling Ctrl+C 3 times, child processes will be killed, and pending tests will be reported.
- `--debug` mode on Node.
- `--inspect` and `--inspect-brk` work too (but force concurrency `1`).
- `--random [seed]` support.
- `--env <environment>` support.
- Implements https://github.com/js-reporters/js-reporters
- Inspired a lot on [AVA](https://github.com/avajs/ava).

## Modifiers

Modifiers can be chained!

- `test`: to create a test.
- `group`: to create a group.
- `before`: registers a hook to be run before the first test in the group it's defined.
- `after`: registers a hook to be run after the last test in the group it's defined.
- `beforeEach`: registers a hook to be run before each test in the group it's defined.
- `afterEach`: registers a hook to be run after each test in the group it's defined.
- `skip`: marks a test/hook/group as skipped.
- `serial`: marks a test/group as serial. It will force tests to run serially before the concurrent ones.
- `only`: marks a test/group as only.
- `todo`: marks a test/group as todo. Allows you to not include an implementation.
- `failing`: marks a test/group as failing. For groups it means all their tests must fail.
- `strict`: disallows the usage of `only`, `failing`, `todo`, `skipped` modifiers for any inner test or group. Can be applied globally.
- `allowNoPlan`: makes a test or tests inside a group still succeed if no assertions are run and no planning was done. Can be applied globally.

`serial`, `failing`, `todo`, `only`, `allowNoPlan` don't make sense for hooks.

## Test api

### Planning

`.plan( number )`

Assertion plans ensure tests only pass when a **exact** number of assertions have been executed. They'll help you catch cases where tests exit too early or when too many assertions are executed.

If you do not specify an assertion plan, your test will still fail if no assertions are executed. Set the `allowNoPlan` option to `true` to disable this behavior.

```js
test( t => {
  t.plan( 10 );
  t.incCount();
  t.incCount();
} );
// Will fail with "Planned 10 but 2 assertions were run."
```

### Increment assertion count

`.incCount()`

### Logging

`.log( string )`

Print a log message contextually alongside the test result instead of immediately printing it to `stdout` like `console.log`.

### Skip

`.skip( ?string )`

Mark the test as skipped. You can specify a reason.

`skip()` throws an error, which will interrupt the test.

### Retries

`.retries( number )`

How many times the test may retry in case of error.

Example:
- If value is `0` it never retries.
- If value is `1`, it will run once, and if it fails, it will retry once.

Run `retries()` without arguments to get the current value.

Value is inherit from the value especified on the group by default. If the test belongs to the root, the default is `0`.

Not available in hooks.

### Retry delay

`.retryDelay( number )`

Specify a delay between each retry.

Run `retryDelay()` without arguments to get the current value.

Value is inherit from the value especified on the group by default. If the test belongs to the root, the default is `0`.

Not available in hooks.

### Reruns

`.reruns( number )`

How many times the test will rerun.

Example:
- If value is `0` it never reruns.
- If value is `1`, it will run once, and if it fails, it will rerun once.

Run `reruns()` without arguments to get the current value.

Value is inherit from the value especified on the group by default. If the test belongs to the root, the default is `0`.

Not available in hooks.

### Rerun delay

`.rerunDelay( number )`

Specify a delay between each rerun.

Run `rerunDelay()` without arguments to get the current value.

Value is inherit from the value especified on the group by default. If the test belongs to the root, the default is `0`.

Not available in hooks.

### Timeout

`.timeout( number )`

Define the max time a test may run. In milleseconds.

Set `0` to disable timeout checking.

Run `timeout()` without arguments to get the current value.

Value is inherit from the value especified on the group by default. If the test belongs to the root, the default is `0`.

### Slow

`.slow( number )`

Specify the "slow" test threshold. This is used to highlight test-cases that are taking too long.

Set `0` to disable slowness checking.

Run `slow()` without arguments to get the current value.

Value is inherit from the value especified on the group by default. If the test belongs to the root, the default is `0`.

## Group api

```js
test.group( "group 1", g => {

  g.timeout( 5000 );

  g.test( () => {} );
  test( () => {} ); // Same

  // Nested groups are supported
  test.group( "group 2", () => {
    test( () => {} );
  } );

} );
```

```js
// Alternative api
const group1 = test.group( "group 1" );
group1.timeout( 5000 );
group1.test( () => {} );

// Nested groups are supported
group1.group( "group 2", () => {
  test( () => {} );
} );
```

### Delayed setup

`.delaySetup( Promise )`

Pass a promise to delay the execution.

You will need to use `g.test()` instead of `test()` if you are not defining tests synchronously.

```js
test.group( "group 2", () => {
  return Promise.resolve(); // Returning a promise does the same
} );
```

### Retries

`.retries( number )`

Define the retries value that tests will inherit.

Run `retries()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Retry delay

`.retryDelay( number )`

Define the retry delay value that tests will inherit.

Run `retryDelay()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Reruns

`.reruns( number )`

Define the reruns value that tests will inherit.

Run `reruns()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Rerun delay

`.rerunDelay( number )`

Define the rerun delay value that tests will inherit.

Run `rerunDelay()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Timeout

`.timeout( number )`

Define the timeout value that tests will inherit.

Set `0` to disable timeout checking.

Run `timeout()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Slow

`.slow( number )`

Define the slow value that tests will inherit.

Set `0` to disable slowness checking.

Run `slow()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Random

`.allowRandomization( boolean )`

Default is `true`. Set `false` to disable randomization in that group.

Run `allowRandomization()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

### Force serial

`.forceSerial( boolean )`

Default is `false`. Set `true` to force tests in that group to run serially.

Run `forceSerial()` without arguments to get the current value.

Nested groups inherit the value from their parent groups.

## Promise/Observable support

```js
test( t => {
  return somePromise().then( result => {
    // Assert something
  } );
} );
```

```js
test( async t => {
  const value = await promiseFn();
  // Assert something
} );
```

```js
test( t => {
  t.plan( 3 );
  return Observable.of( 1, 2, 3, 4, 5, 6 )
    .filter( n => {
      // Only even numbers
      return n % 2 === 0;
    } )
    .map( () => t.incCount() );
} );
```

## Details about hooks

- `before` and `after` hooks don't run if all the tests have the `skip` modifier.
- `.skip()` from within a `before` or `beforeEach` hook, will skip all the associated tests.
  - This will not happen if you use a `skip` modifier on the hook. Tests will still run.
- Failed `before` hook skips all tests in a suite and subsuites, but runs `after` hooks.
- Failed `beforeEach` hook skips remaining tests in a suite and subsuites, but runs `afterEach` hooks.
- Failed `after` does nothing. Other `after` hooks run as well.
- Failed `afterEach` hook skips remaining tests in a suite and subsuites, but executes other `afterEach` hooks for that test.
- `after` and `afterEach` always run, even on fast bail mode.

```js
// They share the same context object.

test.beforeEach( ( { context } ) => {

} );

test( ( { context } ) => {

} );

t.afterEach( ( { context } ) => {

} );
```

## Stack trace

The stack trace that is shown only contains what is important and maps to the original files.

You can disable the showing of stack traces with `--no-stack`.

## Config

Configuration can be defined in the `package.json` file of your project, or through a `quase-unit.config.js` file or through the `--config <path/to/js|json>` option.

If you'd like to use your `package.json` to store configuration, use the `"quase-unit"` key.

You can also pass configuration via the arguments used in the command line interface. These will override the ones used in the config.

Note that in the command line you should use `--snapshot-location` notation but in the config you should use camelCase like: `snapshotLocation`.

> We look first for the configuration file, and then the config in `package.json`. See `@quase/cli` for more info.

## Snapshots

#### CI

Tests fail if snapshots are missing on CI, instead of creating them.

#### Custom directory

You can specify a fixed location for storing the snapshot files using the `snapshotLocation` config.

The snapshot files will be saved in a directory structure that mirrors that of your test files.

#### Precompiled files

If you are running against precompiled test files, Unit will try and use source maps to determine the location of the original files.

Snapshots will be stored following the same rules as if Unit had executed the original files directly.
