type Value<LabelKey extends string, IntlKey extends string> = {
  readonly type: "value";
  readonly label: LabelKey;
  readonly initial: string | null;
  readonly placeholder: IntlKey;
  readonly description: IntlKey;
  readonly kind: "text" | "number" | "date"; // TODO others
};

type Toggle<LabelKey extends string, IntlKey extends string> = {
  readonly type: "toggle";
  readonly label: LabelKey;
  readonly initial: boolean;
  readonly description: IntlKey;
  readonly kind: "checkbox" | "switch";
};

type Option<LabelKey extends string, IntlKey extends string> = {
  readonly key: string;
  readonly description: IntlKey;
};

type Options<LabelKey extends string, IntlKey extends string> = {
  readonly type: "options";
  readonly label: LabelKey;
  readonly initial: string | null;
  readonly options: readonly (Option<LabelKey, IntlKey> | FormSeparator)[];
  readonly description: IntlKey;
  readonly kind: "radio" | "select";
};

type Group<LabelKey extends string, IntlKey extends string> = {
  readonly type: "group";
  readonly children: readonly (
    | FormElement<LabelKey, IntlKey>
    | FormSeparator
  )[];
  readonly description: IntlKey | null;
};

type FormPage<LabelKey extends string, IntlKey extends string> = {
  readonly type: "page";
  readonly children: readonly (
    | FormElement<LabelKey, IntlKey>
    | FormSeparator
  )[];
  readonly description: IntlKey | null;
};

type FormElement<LabelKey extends string, IntlKey extends string> =
  | Value<LabelKey, IntlKey>
  | Toggle<LabelKey, IntlKey>
  | Options<LabelKey, IntlKey>
  | Group<LabelKey, IntlKey>;

export type FormElementOrPage<
  LabelKey extends string,
  IntlKey extends string,
> = FormElement<LabelKey, IntlKey> | FormPage<LabelKey, IntlKey>;

type FormSeparator = {
  readonly type: "separator";
};

type FormCreator<LabelKey extends string, IntlKey extends string> = {
  readonly sep: FormSeparator;
  readonly value: (
    opts: Omit<Value<LabelKey, IntlKey>, "type">
  ) => Value<LabelKey, IntlKey>;
  readonly toggle: (
    opts: Omit<Toggle<LabelKey, IntlKey>, "type">
  ) => Toggle<LabelKey, IntlKey>;
  readonly options: (
    opts: Omit<Options<LabelKey, IntlKey>, "type">
  ) => Options<LabelKey, IntlKey>;
  readonly group: (
    opts: Omit<Group<LabelKey, IntlKey>, "type">
  ) => Group<LabelKey, IntlKey>;
  readonly page: (
    opts: Omit<FormPage<LabelKey, IntlKey>, "type">
  ) => FormPage<LabelKey, IntlKey>;
};

const SEP: FormSeparator = {
  type: "separator",
};

export function makeFormCreator<
  LabelKey extends string,
  IntlKey extends string,
>(): FormCreator<LabelKey, IntlKey> {
  return {
    sep: SEP,
    value(opts) {
      return { type: "value", ...opts };
    },
    toggle(opts) {
      return { type: "toggle", ...opts };
    },
    options(opts) {
      return { type: "options", ...opts };
    },
    group(opts) {
      return { type: "group", ...opts };
    },
    page(opts) {
      return { type: "page", ...opts };
    },
  };
}
