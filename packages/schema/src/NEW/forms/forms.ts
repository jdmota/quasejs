export function makeFormCreator<
  LabelKey extends string,
  IntlKey extends string,
>() {
  type Value = {
    readonly type: "value";
    readonly label: LabelKey;
    readonly initial: string | null;
    readonly placeholder: IntlKey;
    readonly description: IntlKey;
    readonly kind: "text" | "number" | "date"; // TODO others
  };

  type Toggle = {
    readonly type: "toggle";
    readonly label: LabelKey;
    readonly initial: boolean;
    readonly description: IntlKey;
    readonly kind: "checkbox" | "switch";
  };

  type Option = {
    readonly key: string;
    readonly description: IntlKey;
  };

  type Options = {
    readonly type: "options";
    readonly label: LabelKey;
    readonly initial: string | null;
    readonly options: readonly (Option | FormSeparator)[];
    readonly description: IntlKey;
    readonly kind: "radio" | "select";
  };

  type Group = {
    readonly type: "group";
    readonly children: readonly (FormElement | FormSeparator)[];
    readonly description: IntlKey | null;
  };

  type FormPage = {
    readonly type: "page";
    readonly children: readonly (FormElement | FormSeparator)[];
    readonly description: IntlKey | null;
  };

  type FormElement = Text | Toggle | Options | Group;

  type FormSeparator = {
    readonly type: "separator";
  };

  return {
    sep: {
      type: "separator",
    } satisfies FormSeparator,
    value(opts: Omit<Value, "type">): Value {
      return { type: "value", ...opts };
    },
    toggle(opts: Omit<Toggle, "type">): Toggle {
      return { type: "toggle", ...opts };
    },
    options(opts: Omit<Options, "type">): Options {
      return { type: "options", ...opts };
    },
    group(opts: Omit<Group, "type">): Group {
      return { type: "group", ...opts };
    },
    page(opts: Omit<Group, "type">): FormPage {
      return { type: "page", ...opts };
    },
  } as const;
}
