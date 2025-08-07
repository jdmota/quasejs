import {
  type CostsRegistry,
  everyone,
  computeGraph,
  cost,
  cover,
  tableToString,
  printCurrency,
} from "../debt-split";

const carA = ["A", "E", "L", "L2"];
const carJ2 = ["A2", "I", "J", "J2"];
const J = ["J"];
const L2 = ["L2"];
const jAndJ2 = ["J", "J2"];

const costs: CostsRegistry = {
  A: [cost("24.66", "", everyone), cost("22.00", "", carA)],
  A2: [
    cost("10.00", "", everyone),
    cost("1.30", "", everyone),
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
} = computeGraph(costs, "J");

console.table(tableToString(graph));
console.log("Original Total Cost", printCurrency(originalCost));
console.table(tableToString(diff));
console.log("Sanity Check", printCurrency(sanityCheck));
console.log("Net");
console.table(tableToString(net));
console.table(tableToString(givers));
console.table(tableToString(receivers));
console.log("Transactions to perform");
console.table(tableToString(transactions));

// yarn n packages\apps\debt-splitter\__examples__\example.ts > packages\apps\debt-splitter\__examples__\example.txt
