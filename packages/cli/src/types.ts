export type YargsOptions = {
  alias: { [key: string]: string[] };
  array: string[];
  boolean: string[];
  coerce: { [key: string]: Function };
  count: string[];
  string: string[];
  narg: { [key: string]: number };
  number: string[];
  configuration?: {
    "camel-case-expansion"?: boolean;
    "populate--"?: boolean;
  };
  "--"?: boolean;
};

export type Schema = {
  validateAndMerge: ( ..._: unknown[] ) => unknown;
  cli: {
    yargsOpts: YargsOptions;
    allAlias: string[];
    help: string;
  };
};

export type Command = {
  schema: Schema | string;
  description?: string;
  help?: string;
};

export type Pkg = {
  name: string;
  version: string;
  description: string | undefined;
  bin: { [ key: string ]: unknown } | undefined;
};

export type CliOptions = {
  cwd: string;
  argv: string[];
  description?: string | false;
  usage?: string;
  help?: string;
  defaultCommand?: string;
  commands?: { [key: string]: Command };
  schema: Schema | string;
  configFiles?: string | string[];
  configKey?: string;
  inferType?: boolean;
  "populate--"?: boolean;
  pkg?: Pkg;
  version?: string;
  autoVersion?: boolean;
  autoHelp?: boolean;
  notifier?: boolean | any;
};

export type CommandSet = {
  value: string;
  set: true;
} | {
  value: string | undefined;
  set: false;
};

export type ArgsInfo = {
  schema: Schema;
  command: CommandSet;
  flags: any;
  input: any;
  "--": any;
};
