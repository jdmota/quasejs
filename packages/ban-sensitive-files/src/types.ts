export type Options = {
  all: boolean;
  verbose: boolean;
};

export type Rule = {
  part: "filename" | "extension" | "path";
  type: "regex" | "match";
  pattern: string;
  caption: string;
  description: string | null;
};

export const PART_VALUES = ["filename", "extension", "path"];

export const TYPE_VALUES = ["regex", "match"];

export type Banned = {
  filename: string;
  rules: Rule[];
};

export type SensitiveFile = {
  filename: string;
  errors: string[];
};
