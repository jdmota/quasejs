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
    "strip-aliased"?: boolean;
    "strip-dashed"?: boolean;
  };
  "--"?: boolean;
};

export type Schema = {
  validateAndMerge: ( ..._: unknown[] ) => unknown;
  cli: {
    yargsOpts: YargsOptions;
    help: string;
  };
};

export type Pkg = {
  name: string;
  version: string;
  description?: string;
  bin?: { [ key: string ]: unknown };
};

export type CommandsOpts = {
  schema: Schema | string;
  usage?: string;
  description?: string | false;
  help?: string;
  defaultCommand?: string;
  requiredCommand?: boolean;
  commands?: { [key: string]: CommandsOpts };
};

export type CliOptions = CommandsOpts & {
  cwd: string;
  argv: string[];
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
  value: string[];
  detail: {
    last: string | undefined;
    set: false;
  } | {
    last: string;
    set: true;
  };
};

export type ArgsInfo = {
  argv: string[];
  schema: Schema;
  parentCommandOpts: CommandsOpts | null;
  commandOpts: CommandsOpts;
  commandSet: CommandSet;
  flags: any;
  input: any;
  "--": any;
};
