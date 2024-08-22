declare module "concordance" {
  export type Descriptor = unknown;

  export type CompareResult = {
    pass: boolean;
    actual?: Descriptor;
    expected?: Descriptor;
  };

  export type Plugin = {
    name: string;
    apiVersion: number;
    serializerVersion?: number;
    minimalConcordanceVersion?: string;
    register: (concordance: any) => any;
  };

  export type DescribeOptions = {
    plugins?: Plugin[];
  };

  export type Theme = any;

  export type Options = {
    plugins?: Plugin[];
    maxDepth?: number;
    invert?: boolean;
    theme?: Theme;
  };

  export function compare(
    actual: unknown,
    expected: unknown,
    options: DescribeOptions
  ): CompareResult;
  export function compareDescriptors(
    actual: Descriptor,
    expected: Descriptor
  ): boolean;

  export function describe(
    value: unknown,
    options: DescribeOptions
  ): Descriptor;

  export function diff(
    actual: unknown,
    expected: unknown,
    options: Options
  ): string;
  export function diffDescriptors(
    actual: Descriptor,
    expected: Descriptor,
    options: Options
  ): string;

  export function format(value: unknown, options: Options): string;
  export function formatDescriptor(desc: Descriptor, options: Options): string;

  export function serialize(desc: Descriptor): Buffer;
  export function deserialize(buffer: Buffer): Descriptor;
}
