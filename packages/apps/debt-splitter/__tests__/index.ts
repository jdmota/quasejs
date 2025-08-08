import { expect, it } from "@jest/globals";
import {
  computeGraph,
  cost,
  cover,
  everyone,
  parseCurrency,
  printCurrency,
  tableToString,
  type CostsRegistry,
} from "../debt-split";

it("valid currency", () => {
  expect(parseCurrency("-24.00")).toBe(-2400n);
  expect(parseCurrency("24.00")).toBe(2400n);
  expect(parseCurrency("24.0")).toBe(2400n);
  expect(parseCurrency("24")).toBe(2400n);
  expect(parseCurrency(".00")).toBe(0n);
  expect(parseCurrency(".10")).toBe(10n);
  expect(parseCurrency(".1")).toBe(10n);
});

it("invalid currency", () => {
  ["24.", "24..", "24.000", "-"].forEach(c => {
    expect(() => parseCurrency(c)).toThrow(`Invalid value: ${c}`);
  });
});

it("debt split with hero strat", () => {
  const carA = ["A", "E", "L", "L2"];
  const carJ2 = ["A2", "I", "J", "J2"];
  const J = ["J"];
  const L2 = ["L2"];
  const jAndJ2 = ["J", "J2"];

  const costs: CostsRegistry = {
    A: [cost("24.66", "", everyone), cost("22.00", "", carA)],
    A2: [
      cost("10.00", "", everyone),
      cost("1.3", "", everyone),
      cost("28", "", everyone),
      cost("10", "", everyone),
      cost("8.67", "", J),
      cost("2.00", "", carJ2),
    ],
    E: [cost("54.39", "", everyone), cost("11.50", "", L2)],
    I: [],
    J: [
      cost("96.52", "", everyone, [cover("2.16", "E", "")]),
      cost("9.66", "", everyone, [cover("0.39", "E", "")]),
    ],
    J2: [
      cost("2.00", "", jAndJ2),
      cost("27.56", "", carJ2),
      cost("17.30", "", carJ2),
      cost("55.00", "", carJ2),
    ],
    L: [
      cost("25.95", "", everyone),
      cost("1.26", "", everyone),
      cost("8.29", "", everyone),
      cost("-3.90", "", everyone),
      cost("-1.50", "", everyone),
      cost("-1.40", "", everyone),
      cost("-1.45", "", everyone),
    ],
    L2: [
      cost("35.72", "", everyone),
      cost("58.88", "", everyone, [cover("2.19", "E", "")]),
      cost("5.20", "", everyone),
      cost("8.95", "", J),
    ],
  };

  const {
    graph,
    net,
    originalCost,
    diff,
    sanityCheck,
    givers,
    receivers,
    transactions,
    leftOversExisted,
  } = computeGraph(costs, "J");

  expect(tableToString(graph)).toMatchSnapshot("Graph");
  expect(printCurrency(originalCost)).toMatchSnapshot("Original Total Cost");
  expect(tableToString(diff)).toMatchSnapshot("Diff");
  expect(sanityCheck).toBe(0n);
  expect(tableToString(net)).toMatchSnapshot("Net");
  expect(tableToString(givers)).toMatchSnapshot("Givers");
  expect(tableToString(receivers)).toMatchSnapshot("Receivers");
  expect(tableToString(transactions)).toMatchSnapshot("Transactions");
  expect(leftOversExisted).toBe(true);
});
