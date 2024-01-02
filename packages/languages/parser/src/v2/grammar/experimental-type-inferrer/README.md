# Inferrer

TODO

- Simplify unions and intersection types (use DNF)
- Better error locations
- Support ValueOf ?

- Need to deal with the scenario where we have `T1- ----> T2+`

// See sketch.png

- The store should also reason on paths like `x.field` for better inference

// export type D_arg = Readonly<{ y: $rec1 }> & Readonly<{ x: $rec2 }> & Readonly<{ x: $rec3 }> & Readonly<{ y: $rec4 }>;
// export type D = Readonly<{ x: $rec2, y: $rec1 }> | Readonly<{ x: $rec4, y: $rec3 }>;

// export type D_arg = Readonly<{ x: $rec2 & $rec3, y: $rec1 & $rec4 }>;
// export type D = Readonly<{ x: $rec2, y: $rec1 }> | Readonly<{ x: $rec4, y: $rec3 }>;

- The store could potentially capture this:

choice(x = {}, y = {}) leading to result { x: {}, y: null } | { x: null, y : {} } instead of { x: null | {}, y : null | {} }

- Support constraints with unions on the right side and intersections on the left (leading to optional "edges" in the constraints graph)
- Support polymorphism via generics

# Inspirations

Simplifying Subtyping Constraints: A Theory
François Pottier

Type Inference in the Presence of Subtyping: from Theory to Practice
François Pottier

- The explanation on polarities, especially 10.3., really shows some of the conclusions I found.
