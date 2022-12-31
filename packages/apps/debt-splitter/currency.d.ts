export namespace currencyN {
  type Any = number | string | currency;
  type Format = (currency?: currency, opts?: Options) => string;
  interface Constructor {
    (value: currencyN.Any, opts?: currencyN.Options): currency;
    new (value: currencyN.Any, opts?: currencyN.Options): currency;
  }
  interface Options {
    symbol?: string;
    separator?: string;
    decimal?: string;
    errorOnInvalid?: boolean;
    precision?: number;
    increment?: number;
    useVedic?: boolean;
    pattern?: string;
    negativePattern?: string;
    format?: currencyN.Format;
    fromCents?: boolean;
  }
}

export interface currency {
  add(number: currencyN.Any): currency;
  subtract(number: currencyN.Any): currency;
  multiply(number: currencyN.Any): currency;
  divide(number: currencyN.Any): currency;
  distribute(count: number): Array<currency>;
  distribute2(count: number): {
    distribution: Array<currency>;
    pennies: number;
    leftOvers: currency;
  };
  distribute3(count: number, except: number): Array<currency>;
  dollars(): number;
  cents(): number;
  compareTo(other: currency): number;
  format(opts?: currencyN.Options | currencyN.Format): string;
  toString(): string;
  toJSON(): number;
  readonly intValue: number;
  readonly value: number;
}

declare const currency: currencyN.Constructor;
