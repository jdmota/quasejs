# Quase lang

This is my attempt to create a programming language and investigate what can be done to help even more programmers to make less mistakes, and avoid common problems.

## Pratical objectives

- Good tooling
- Good libraries
- Be fast
- Easy to learn syntax
- Modular
- Compile to WebAssembly
- Compile to JavaScript
- Work side by side with JavaScript modules

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

## More ideias

[Link](/docs/ideas.md).
