# Quase lang

This is my attempt to create a programming language and investigate what can be done to help programmers make sure that the software developed and
constructed is "correct".

## Pratical objectives

- Good tooling
- Good libraries
- Be fast
- Syntax easy to learn
- Modular
- Compile targets:
  - WebAssembly
  - JavaScript
  - Others...

## Concept

- The compiler tries to proof safety and optimize as much as possible.
- The compiler shows how much and which code is using runtimes checks.
- You choose how much safety you want to impose.

```
 Static                  Dynamic
  code                    code
   |-----------------------|
No runtime              Runtimes
 checks                  checks
```

Code starts on the right, and the compiler tries to optimize it to the left.

## Types of correctness we might want to impose

- Runtime safety - Is it crash-free?
- Functional correctness - Gives the right results?
- Resource conformance - Does it operate effectively?
- Security conformance - Does it violate user privacy?
- Integrity conformance

## Language changes

The language should also be able to envolve and introduce breaking changes if necessary but with easy migration paths.

## More ideias

[Link](/docs/ideas.md).
