import {
  string,
  alias,
  object,
  array,
  optional,
  number,
  boolean,
} from "./generator";

/*
export type EnvContext =
  | "browser"
  | "web-worker"
  | "service-worker"
  | "node"
  | "electron-main"
  | "electron-renderer"
  | string;
*/

export const EnvContext = alias("EnvContext", string);

const EnvContextOptionalArray = optional(array(EnvContext));

/*
export type TransformsConfig = DeepReadonly<{
  [key: string]: string[];
}>;
*/

export const TransformsConfig = alias("TransformsConfig", object([])); // TODO

export const AssetRequest = alias(
  "AssetRequest",
  object([
    ["path", string],
    ["target", string],
    ["env", EnvContextOptionalArray],
    ["transforms", optional(TransformsConfig)],
  ])
);

export const Position = alias(
  "Position",
  object([
    ["line", number],
    ["column", optional(number)],
  ])
);

export const Loc = alias(
  "Loc",
  object([
    ["filePath", optional(string)],
    ["start", Position],
    ["end", optional(Position)],
  ])
);

export const Meta = alias("Meta", object([])); // TODO

export const DependencyRequest = alias(
  "DependencyRequest",
  object([
    ["specifier", string],
    ["entry", boolean],
    ["async", boolean],
    ["weak", boolean],
    ["glob", boolean],
    ["url", boolean],
    ["target", string],
    ["env", EnvContextOptionalArray],
    ["splitPoint", optional(boolean)],
    ["loc", optional(Loc)],
    ["meta", optional(Meta)],
    ["transforms", optional(TransformsConfig)],
    ["resolved", optional(string)],
  ])
);

export const DepParent = alias(
  "DepParent",
  object([
    ["type", string],
    ["id", string],
    ["request", AssetRequest],
  ])
);

export const DepRequestAndParent = alias(
  "DepRequestAndParent",
  object([
    ["dependency", DependencyRequest],
    ["parent", DepParent],
  ])
);

export const version = "1.0.0";
