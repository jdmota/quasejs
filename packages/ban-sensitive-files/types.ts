export type Options = Readonly<{
  folder: string;
  all: boolean;
  verbose: boolean;
}>;

export type CoreRule = Readonly<{
  part: "filename" | "extension" | "path";
  caption?: string | null | undefined;
  description?: string | null | undefined;
}>;

export type BanRule = CoreRule & PatternCheck;

export type ContentRule = CoreRule &
  PatternCheck &
  Readonly<{
    checks: readonly PatternCheck[];
  }>;

export type PatternCheck = Readonly<{
  type: "regex" | "match" | "contains";
  pattern: string;
}>;

export const PART_VALUES = ["filename", "extension", "path"] as const;

export const TYPE_VALUES = ["regex", "match", "contains"] as const;

export type FileReport =
  | Readonly<{
      kind: "ok";
      filename: string;
    }>
  | Readonly<{
      kind: "banned";
      filename: string;
      rule: BanRule;
    }>
  | Readonly<{
      kind: "sensitive";
      filename: string;
      rule: ContentRule;
      check: PatternCheck;
    }>;
