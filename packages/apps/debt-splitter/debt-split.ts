import { currency } from "./currency.js";

// null means the cost is evenly distributed between all persons (discounting the covers)
type WhoPays = readonly string[] | null;

type Cost = Readonly<{
  amount: currency;
  where: string;
  covers: readonly Cover[];
  distribution: WhoPays;
}>;

type Cover = Readonly<{
  amount: currency;
  who: string;
  why: string;
}>;

type CostsRegistry = {
  readonly [key: string]: readonly Cost[];
};

const everyone: WhoPays = null;

const cost = (
  amount: string,
  where: string,
  distribution: WhoPays,
  covers: readonly Cover[] = []
): Cost => ({
  amount: currency(amount),
  where,
  covers,
  distribution,
});

const cover = (amount: string, who: string, why: string): Cover => ({
  amount: currency(amount),
  who,
  why,
});

const ZERO = currency(0);

type Table = { [key: string]: currency };

function createTable(persons: string[]) {
  const personsNumber = persons.length;
  const table: Table = {};
  for (let i = 0; i < personsNumber; i++) {
    table[persons[i]] = ZERO;
  }
  return table;
}

type Graph<D = currency> = { [key: string]: { [key: string]: D } };

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

type CurrencyTable = { [key: string]: null | currency | CurrencyTable };
type CurrencyTableStr = { [key: string]: null | string | CurrencyTableStr };

function print(info: null | currency | CurrencyTable) {
  function convert(info: null | currency | CurrencyTable) {
    if (info == null) {
      return ZERO.toString();
    }
    if (info instanceof currency) {
      return info.toString();
    }
    const print: CurrencyTableStr = {};
    for (const [key, obj] of Object.entries(info)) {
      print[key] = convert(obj);
    }
    return print;
  }
  console.table(convert(info));
}

enum PennyLeftOversStrategy {
  RANDOM_DISTRIBUTION,
  COST_OWNER_TAKES_IT,
  ALL_EXCEPT_COST_OWNER_PAY_EXTRA,
  // TODO another strat: the ones who had less costs, pays the extra pennies
}

function computeGraph(
  registry: CostsRegistry,
  strat: PennyLeftOversStrategy | string
) {
  const persons = Object.keys(registry);
  // Compute diff (for display)
  const diff = createTable(persons);
  for (const [person, costs] of Object.entries(registry)) {
    for (const { amount } of costs) {
      diff[person] = diff[person].subtract(amount);
    }
  }
  // Create graph and fill
  const graph = createGraph(persons, ZERO);
  for (const [person, costs] of Object.entries(registry)) {
    const distributions = new Map<readonly string[], currency>();
    // Discount covers and dedup before distributing
    for (const { amount, distribution, covers } of costs) {
      let actualAmount = amount;
      // Compute the actual amount to split by subtracting the covers
      for (const { amount: amountCover, who: whoCover } of covers) {
        actualAmount = actualAmount.subtract(amountCover);
        graph[whoCover][person] = graph[whoCover][person].add(amountCover);
      }
      // Dedup
      const whoPays = distribution ?? persons;
      distributions.set(
        whoPays,
        (distributions.get(whoPays) ?? ZERO).add(actualAmount)
      );
    }
    // Distribute
    for (const [whoPays, amount] of distributions) {
      let distribution, leftOvers;
      switch (strat) {
        case PennyLeftOversStrategy.RANDOM_DISTRIBUTION: {
          distribution = amount.distribute(whoPays.length);
          break;
        }
        case PennyLeftOversStrategy.COST_OWNER_TAKES_IT: {
          ({ distribution, leftOvers } = amount.distribute2(whoPays.length));
          // The one who contracted the cost, does not get payed for the left over pennies :(
          graph[person][person] = graph[person][person].add(leftOvers);
          break;
        }
        case PennyLeftOversStrategy.ALL_EXCEPT_COST_OWNER_PAY_EXTRA: {
          distribution = amount.distribute3(
            whoPays.length,
            whoPays.indexOf(person)
          );
          break;
        }
        default: {
          ({ distribution, leftOvers } = amount.distribute2(whoPays.length));
          // This hero takes the extra cost!
          graph[strat][person] = graph[strat][person].add(leftOvers);
        }
      }
      for (const [payer, num] of distribution.map(
        (num, idx) => [whoPays[idx], num] as const
      )) {
        graph[payer][person] = graph[payer][person].add(num);
      }
    }
  }
  // Finish diff computation
  for (const pTo of persons) {
    for (const pFrom of persons) {
      diff[pTo] = diff[pTo].add(graph[pFrom][pTo]);
    }
  }
  // Compute net
  const net = createTable(persons);
  for (const pTo of persons) {
    for (const pFrom of persons) {
      net[pTo] = net[pTo].add(graph[pFrom][pTo]).subtract(graph[pTo][pFrom]);
    }
  }
  // Compute givers and receivers
  const givers: Table = {};
  for (const [person, value] of Object.entries(net)) {
    if (value.intValue < 0) {
      givers[person] = value;
    }
  }
  const receivers: Table = {};
  for (const [person, value] of Object.entries(net)) {
    if (value.intValue > 0) {
      receivers[person] = value;
    }
  }
  // Compute transactions
  const transactions = createGraph<currency | null>(
    Object.keys(givers),
    null,
    Object.keys(receivers)
  );
  // Based on https://www.geeksforgeeks.org/minimize-cash-flow-among-given-set-friends-borrowed-money/
  {
    function minOf2(x: currency, y: currency) {
      // x < y ? x : y
      return x.compareTo(y) < 0 ? x : y;
    }

    function find(
      net: Table,
      fn: (acc: currency, amount: currency) => boolean
    ) {
      const entries = Object.entries(net);
      return entries.reduce(
        ([accPerson, accAmount], [person, amount]) =>
          fn(accAmount, amount) ? [person, amount] : [accPerson, accAmount],
        entries[0]
      )[0];
    }

    function minCashFlowRec(net: Table) {
      // print(net);
      const mxCredit: string = find(net, (max, x) => x.compareTo(max) > 0);
      const mxDebit: string = find(net, (min, x) => x.compareTo(min) < 0);

      // If both amounts are 0, then all amounts are settled
      if (net[mxCredit].intValue == 0 && net[mxDebit].intValue == 0) return;

      // Find the minimum of two amounts
      const min = minOf2(ZERO.subtract(net[mxDebit]), net[mxCredit]);
      net[mxCredit] = net[mxCredit].subtract(min);
      net[mxDebit] = net[mxDebit].add(min);

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
      (acc, costs) => costs.reduce((acc, { amount }) => acc.add(amount), acc),
      ZERO
    ),
    diff,
    sanityCheck: Object.values(net).reduce((acc, val) => acc.add(val), ZERO),
    givers,
    receivers,
    transactions,
  };
}

export { everyone, computeGraph, CostsRegistry, cost, cover, print };
