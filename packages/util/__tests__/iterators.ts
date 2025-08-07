import { roundRobin } from "../iterators";

it("round robin basic", () => {
  const array = "abc".split("");

  const rr = roundRobin(array);

  const values = [];

  for (const value of rr) {
    values.push(value);
    break;
  }

  expect(values).toEqual(["a"]);

  for (const value of rr) {
    values.push(value);
    break;
  }

  expect(values).toEqual(["a", "b"]);

  for (const value of rr) {
    values.push(value);
    break;
  }

  expect(values).toEqual(["a", "b", "c"]);

  for (const value of rr) {
    values.push(value);
    break;
  }

  expect(values).toEqual(["a", "b", "c", "a"]);
});

it("round robin empty", () => {
  const rr = roundRobin([]);

  const values: never[] = [];
  for (const value of rr) {
    values.push(value);
  }
  expect(values).toEqual([]);
});
