export type Options = Readonly<{
  folder: string;
  all: boolean;
  verbose: boolean;
}>;

export type Rule = Readonly<{
  part: "filename" | "extension" | "path";
  type: "regex" | "match";
  pattern: string;
  caption: string;
  description: string | null;
}>;

export const PART_VALUES = ["filename", "extension", "path"] as const;

export const TYPE_VALUES = ["regex", "match"] as const;

export type FileReport =
  | Readonly<{
      kind: "ok";
      filename: string;
    }>
  | Readonly<{
      kind: "banned";
      filename: string;
      rules: readonly Rule[];
    }>
  | Readonly<{
      kind: "sensitive";
      filename: string;
      errors: readonly string[];
    }>;
