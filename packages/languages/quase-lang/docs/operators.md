# Operators

## Property access

`x.y`.

`x["y"]` same as `x.get("y")`.

`x["y"] = z` same as `x.set("y",z)`.

## Conditional property access

`x?.y`

`x?["y"]`

`x?()`

`x!` - If `x` is `null`, it will throw at runtime, but does not warn on compilation time.

`x!.y`, `x!()`, `x!["y"]`

## Increment/Decrement

`x++` - Post-increment

`x--`- Post-decrement

`++x` - Pre-increment

`--x` - Pre-decrement

## Typeof

`typeof x` - Obtains the type of `x`.

## Unary Operators

|Expression   |Description
|-------------|--------------
|+x           |Identity
|-x           |Negation
|!x           |Logical negation
|~x           |Bitwise negation
|++x          |Pre-increment
|--x          |Pre-decrement

## Multiplicative Operators

|Expression   |Description
|-------------|--------------
|*            |Multiplication
|**           |Exponential
|/            |Division
|%            |Remainder

## Additive Operators

|Expression   |Description
|-------------|--------------
|x + y        |Addition or string concatenation
|x - y        |Subtraction

## Shift Operators

|Expression   |Description
|-------------|--------------
|x << y       |Shift left
|x >> y       |Shift right
|x >>> y      |Unsigned shift right

## Relational and Type Operators

|Expression   |Description
|-------------|--------------
|x < y        |Less than
|x > y        |Greater than
|x <= y       |Less than or equal
|x >= y       |Greater than or equal
|x is T       |Return `true` if the type of `x` is compatible with type `T`
|x !is T      |
|x as T       |Return `x` typed as `T`, throws if not possible
|x as? T      |Return `x` typed as `T`, or `null` if `x` is not a `T`
|x in y
|x !in y

## Equality Operators

|Expression   |Description
|-------------|--------------
|x == y       |Structural equality (calls `.equals()` if not `null`)
|x != y       |Negated counterpart of structural equality
|x === y      |Equal reference (for primitives, works like `==`)
|x !== y      |Not equal reference (for primitives, works like `!=`)

## Logical, Conditional, and Null Operators

|Expression   |Description
|-------------|--------------
|x & y        |Integer bitwise
|x ^ y        |Integer bitwise XOR
|x | y        |Integer bitwise OR
|x && y       |Evaluates y only if x is not false and not null
|x \|\| y     |Evaluates y only if x is false or null

## Assignments

|Expression   |Description
|-------------|--------------
|=            |Assignment
|x op= y      |Compound assignment. +=, -=, *=, **=, /=, %=, &=, |=, !=, <<=, >>=

## Associativity

When two or more operators that have the same precedence are present in an expression, they are evaluated based on associativity.

- Left-associative operators are evaluated in order from left to right.
- Right-associative operators are evaluated in order from right to left.

Whether the operators in an expression are left associative or right associative, the operands of each expression are evaluated first, from left to right.

You can change the order imposed by operator precedence and associativity by using parentheses.

## TODO

- Overloading
- Pipeline operator `x |> filter( () => true )`
- Bind operator `x::toString()`
- Include or not the ternary operator?
- What `in`/`!in` does?
