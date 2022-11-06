type IntlKey = {
  readonly value: string;
};

type Text = {
  readonly type: "text";
  readonly label: string;
  readonly initial: string;
  readonly placeholder: IntlKey;
  readonly description: IntlKey;
};

type Checkbox = {
  readonly type: "checkbox";
  readonly label: string;
  readonly initial: boolean;
  readonly description: IntlKey;
};

type Option = {
  readonly key: string;
  readonly description: IntlKey;
};

type Options = {
  readonly type: "options";
  readonly label: string;
  readonly initial: string;
  readonly options: readonly Option[];
  readonly description: IntlKey;
};

type Group = {
  readonly type: "group";
  readonly label: string;
  readonly children: readonly FormElement[];
  readonly description: IntlKey | null;
};

type FormElement = Text | Checkbox | Options | Group;

export const formCreator = {
  intl(value: string): IntlKey {
    return { value };
  },
  text(opts: Omit<Text, "type">): Text {
    return { type: "text", ...opts };
  },
  checkbox(opts: Omit<Checkbox, "type">): Checkbox {
    return { type: "checkbox", ...opts };
  },
  options(opts: Omit<Options, "type">): Options {
    return { type: "options", ...opts };
  },
  group(opts: Omit<Group, "type">): Group {
    return { type: "group", ...opts };
  },
};
