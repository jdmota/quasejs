# Basic Types

In Quase, everything is an object in the sense that we can call member functions and properties on any variable.

Some types are built-in, because their implementation is optimized, but to the user they look like ordinary classes.

## Numbers

- Decimals: `123`
- Longs: `123L`
- Hexadecimals: `0x0F`
- Binaries: `0b00001011`
- Doubles: `123.5`, `123.5e10`
- Floats: `123.5f`

You can use underscores to make number more readable:

```
val oneMillion = 1_000_000;
```

## Characters

`'1'`, `\t`, `\b`, `\n`, `\r`, `\'`, `\"`, `\\`, `'\uFF00'`, etc...

## Booleans

`true` or `false`

## Arrays

`new [ 0, 1, 2 ];`

## Strings

```js
val s1 = "Hello, world!\n";
val s2 = `Hello, world!\n`;
val s3 = "Hello ${"world"}
";
val s3 = `Hello ${`world`}
`;
// All the same
```

# Comments

```js
// one line comment

/*
multi-line comment
*/
```

# Null

```js
var a;
a == null; // true
```

There is no `undefined` concept like in JavaScript, only `null`.

# Blocks

```js
{
  // Blocks are expressions too
}
```

# Defining variables

```js
val a: number = 1; // Constant
var b: number = 2; // Variable
val c: number;
c = 3; // Deferred assignment
```

# Control flow

## If

```js
if ( x ) {

} else {

} // Same as

if ( x != false && x != null ) {
  // True or an object
} else if ( x == false || x == null ) {
  // False or null
}
```

```js
if ( true ) {};
if ( true ) log();
if true {};
if true: log();
```

## Match

```
// TODO
```

<!--```
match (x) {
  1: print("x == 1")
  is Int: print("x is Int")
  else: { // Note the block
      print("x is neither 1 nor 2")
  }
}

match (x) {
  0, 1: print("x == 0 or x == 1")
  else: print("otherwise")
}
```-->

## For

```js
for ( var i = 0; i < 10; i++ ) {

};

for var i = 0; i < 10; i++ {

};

for ( ;; ) log();

for ( val item in items ) {
  console.log( item );
};

for ( val item in items ) console.log( item );
```

## While and do-while

```js
while ( true ) {

};
while true {};
while true: log();

do {

} while ( true );
do {} while true;
do log() while true;
```

## Try-catch-finally

```js
try {};
try log();
try {} catch {};
try {} catch log();
try {} catch ( e ) {};
try {} catch ( e ) log();
try {} catch {} finally {};
try {} catch {} finally log();
try {} finally {};
try {} finally log();
```

# Returns and jumps

- `return`: By default returns from the nearest enclosing function or anonymous function.
- `break`: Terminates the nearest enclosing loop.
- `continue`: Proceeds to the next step of the nearest enclosing loop.

All of these expressions can be used as part of larger expressions:

```js
val age = if ( person.name == "John" ) return else 20;
```

## Labels

Labels must be valid identifiers.

```js
loop@ for ( val item in items ) {
  if ( ... ) break@loop;
};
```

# Functions

```js
val withoutName = fun() {};

val withName = fun name() {};

fun mightHaveSideEffects() {

};

pure fun withoutSideEffects() {

};

gen fun generator() {

};

async fun asyncFunc() {

};

async gen fun asyncGenFun() {

};

pure async gen fun asyncGenFunWithoutEffects() {

};

rec fun recursive() {
  recursive();
  return;
};

tail fun recursive() { // using 'tail' implicity shows that it's recursive
  return recursive();
};
```

## Default arguments

```js
fun hello( name: string = "World" ) {
  console.log( `Hello ${name}!` );
};
```

## Spread operator

```js
something( ...(new []) );
```

## Rest argument

```js
fun f( ...args ) {

};
```

## Destructing declarations

```js
val { a } = new { a: 10 };
val [ b ] = new [ 20 ];

fun f1( { a } ) {

};

fun f2( [ b ] ) {

};
```
