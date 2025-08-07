import { roundRobin } from "../../util/iterators";

const reCurrency = /^-?(\d+)?(?:\.(\d{1,2}))?$/;

export function parseCurrency(value: string): bigint {
  const match = value.match(reCurrency);
  if (!match || value === "-") {
    throw new Error(`Invalid value: ${value}`);
  }
  const negative = value.startsWith("-") ? -1n : 1n;
  const integer = BigInt(match[1] || "0");
  const cents = BigInt((match[2] || "0").padEnd(2, "0"));
  return negative * (100n * integer + cents);
}

export function printCurrency(value: bigint) {
  const str = value.toString();
  return `${str.slice(0, -2) || "0"}.${str.slice(-2).padEnd(2, "0")}`;
}

function distribute(value: bigint, count: bigint) {
  const split = value / count;
  const leftOvers = value - split * count;
  return { split, leftOvers } as const;
}

// null means the cost is evenly distributed between all persons (discounting the covers)
type WhoPays = readonly string[] | null;

type Cost = Readonly<{
  amount: bigint;
  where: string;
  covers: readonly Cover[];
  distribution: WhoPays;
}>;

type Cover = Readonly<{
  amount: bigint;
  who: string;
  why: string;
}>;

export type CostsRegistry = {
  readonly [key: string]: readonly Cost[];
};

export const everyone: WhoPays = null;

export const cost = (
  amount: string,
  where: string,
  distribution: WhoPays,
  covers: readonly Cover[] = []
): Cost => ({
  amount: parseCurrency(amount),
  where,
  covers,
  distribution,
});

export const cover = (amount: string, who: string, why: string): Cover => ({
  amount: parseCurrency(amount),
  who,
  why,
});

const ZERO = 0n;

type Table = { [key: string]: bigint };

function createTable(persons: string[]) {
  const personsNumber = persons.length;
  const table: Table = {};
  for (let i = 0; i < personsNumber; i++) {
    table[persons[i]] = ZERO;
  }
  return table;
}

type Graph<D> = { [key: string]: { [key: string]: D } };

function createGraph<D>(
  persons: string[],
  def: D,
  persons2: string[] = persons
): Graph<D> {
  const graph: Graph<D> = {};
  for (let i = 0; i < persons.length; i++) {
    graph[persons[i]] = {};
    for (let j = 0; j < persons2.length; j++) {
      graph[persons[i]][persons2[j]] = def;
    }
  }
  return graph;
}

type CurrencyTable = { [key: string]: null | bigint | CurrencyTable };
type CurrencyTableStr = { [key: string]: null | string | CurrencyTableStr };

export function tableToString(info: null | bigint | CurrencyTable) {
  if (info == null) {
    return printCurrency(ZERO);
  }
  if (typeof info === "bigint") {
    return printCurrency(info);
  }
  const print: CurrencyTableStr = {};
  for (const [key, obj] of Object.entries(info)) {
    print[key] = tableToString(obj);
  }
  return print;
}

export enum PennyLeftOversStrategy {
  RANDOM_DISTRIBUTION,
  COST_OWNER_TAKES_IT,
  ALL_EXCEPT_COST_OWNER_PAY_EXTRA,
  // TODO another strat: the ones who had less costs, pays the extra pennies
}

export function computeGraph(
  registry: CostsRegistry,
  strat: PennyLeftOversStrategy | string
) {
  let leftOversExisted = false;
  const persons = Object.keys(registry);
  const rr = roundRobin(persons);
  // Compute diff (for display)
  const diff = createTable(persons);
  for (const [person, costs] of Object.entries(registry)) {
    for (const { amount } of costs) {
      diff[person] = diff[person] - amount;
    }
  }
  // Create graph and fill
  const graph = createGraph(persons, ZERO);
  for (const [person, costs] of Object.entries(registry)) {
    const distributions = new Map<readonly string[], bigint>();
    // Discount covers and dedup before distributing
    for (const { amount, distribution, covers } of costs) {
      let actualAmount = amount;
      // Compute the actual amount to split by subtracting the covers
      for (const { amount: amountCover, who: whoCover } of covers) {
        actualAmount = actualAmount - amountCover;
        graph[whoCover][person] = graph[whoCover][person] + amountCover;
      }
      // Dedup
      const whoPays = distribution ?? persons;
      distributions.set(
        whoPays,
        (distributions.get(whoPays) ?? ZERO) + actualAmount
      );
    }
    // Distribute
    for (const [whoPays, amount] of distributions) {
      const { split, leftOvers } = distribute(amount, BigInt(whoPays.length));
      for (const payer of whoPays) {
        graph[payer][person] = graph[payer][person] + split;
      }
      const leftOversDiff = leftOvers > 0n ? 1n : -1n;
      if (leftOvers !== 0n) {
        leftOversExisted = true;
      }
      switch (strat) {
        case PennyLeftOversStrategy.RANDOM_DISTRIBUTION: {
          if (leftOvers !== 0n) {
            let leftOversToGive = leftOvers;
            for (const payer of rr) {
              if (!whoPays.includes(payer)) continue;
              graph[payer][person] = graph[payer][person] + leftOversDiff;
              leftOversToGive -= leftOversDiff;
              if (leftOversToGive === 0n) break;
            }
          }
          break;
        }
        case PennyLeftOversStrategy.COST_OWNER_TAKES_IT: {
          // The one who contracted the cost, does not get payed for the left over pennies :(
          graph[person][person] = graph[person][person] + leftOvers;
          break;
        }
        case PennyLeftOversStrategy.ALL_EXCEPT_COST_OWNER_PAY_EXTRA: {
          if (leftOvers !== 0n) {
            for (const payer of whoPays) {
              if (payer !== person) {
                graph[payer][person] = graph[payer][person] + leftOversDiff;
              }
            }
          }
          break;
        }
        default: {
          // This hero takes the extra cost!
          graph[strat][person] = graph[strat][person] + leftOvers;
        }
      }
    }
  }
  // Finish diff computation
  for (const pTo of persons) {
    for (const pFrom of persons) {
      diff[pTo] = diff[pTo] + graph[pFrom][pTo];
    }
  }
  // Compute net
  const net = createTable(persons);
  for (const pTo of persons) {
    for (const pFrom of persons) {
      net[pTo] = net[pTo] + graph[pFrom][pTo] - graph[pTo][pFrom];
    }
  }
  // Compute givers and receivers
  const givers: Table = {};
  for (const [person, value] of Object.entries(net)) {
    if (value < 0n) {
      givers[person] = value;
    }
  }
  const receivers: Table = {};
  for (const [person, value] of Object.entries(net)) {
    if (value > 0n) {
      receivers[person] = value;
    }
  }
  // Compute transactions
  const transactions = createGraph<bigint | null>(
    Object.keys(givers),
    null,
    Object.keys(receivers)
  );
  // Based on https://www.geeksforgeeks.org/minimize-cash-flow-among-given-set-friends-borrowed-money/
  {
    function minOf2(x: bigint, y: bigint) {
      return x < y ? x : y;
    }

    function find(net: Table, fn: (acc: bigint, amount: bigint) => boolean) {
      const entries = Object.entries(net);
      return entries.reduce(
        ([accPerson, accAmount], [person, amount]) =>
          fn(accAmount, amount) ? [person, amount] : [accPerson, accAmount],
        entries[0]
      )[0];
    }

    function minCashFlowRec(net: Table) {
      // print(net);
      const mxCredit: string = find(net, (max, x) => x - max > 0);
      const mxDebit: string = find(net, (min, x) => x - min < 0);

      // If both amounts are 0, then all amounts are settled
      if (net[mxCredit] === 0n && net[mxDebit] === 0n) return;

      // Find the minimum of two amounts
      const min = minOf2(ZERO - net[mxDebit], net[mxCredit]);
      net[mxCredit] = net[mxCredit] - min;
      net[mxDebit] = net[mxDebit] + min;

      if (transactions[mxDebit][mxCredit]) throw new Error("Wrong");
      transactions[mxDebit][mxCredit] = min;
      minCashFlowRec(net);
    }
    minCashFlowRec(Object.fromEntries(Object.entries(net)));
  }
  return {
    graph,
    net,
    originalCost: Object.values(registry).reduce(
      (acc, costs) => costs.reduce((acc, { amount }) => acc + amount, acc),
      ZERO
    ),
    diff,
    sanityCheck: Object.values(net).reduce((acc, val) => acc + val, ZERO),
    givers,
    receivers,
    transactions,
    leftOversExisted,
  } as const;
}
