import type { AnySchema } from "../schema-type";

/*
type BaseFieldType = Readonly<{
  label: string;
  condition: (data: unknown, siblingData: unknown) => boolean;
  render: () => unknown;
}>;

export type DataFieldType = BaseFieldType &
  Readonly<{
    _type: "data_field";
    name: string;
    schema: SchemaType;
    defaultValue: unknown;
  }>;

export type PresentationFieldType = BaseFieldType &
  Readonly<{
    _type: "presentation_field";
  }>;

export type FieldType = DataFieldType | PresentationFieldType;
*/

export type CommonDataFieldOptions = Readonly<{
  name: string;
  label?: string | undefined;
  schema: AnySchema;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}>;

export abstract class FieldType {}

export abstract class DataFieldType extends FieldType {
  constructor(public readonly opts: CommonDataFieldOptions) {
    super();
  }
}

export abstract class PresentationFieldType extends FieldType {
  constructor() {
    super();
  }
}

export class NumberField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new NumberField(opts);
  }

  readonly _tag = "NumberField";
}

export class TextField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new TextField(opts);
  }

  readonly _tag = "TextField";
}

export class TextareaField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new TextareaField(opts);
  }

  readonly _tag = "TextareaField";
}

export class AutocompleteField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new AutocompleteField(opts);
  }

  readonly _tag = "AutocompleteField";
}

export class CheckboxField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new CheckboxField(opts);
  }

  readonly _tag = "CheckboxField";
}

export class ToggleField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new ToggleField(opts);
  }

  readonly _tag = "ToggleField";
}

export class SwitchField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new SwitchField(opts);
  }

  readonly _tag = "SwitchField";
}

export class RadioGroupField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new RadioGroupField(opts);
  }

  readonly _tag = "RadioGroupField";
}

export class SelectField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new SelectField(opts);
  }

  readonly _tag = "SelectField";
}

export class SliderField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new SliderField(opts);
  }

  readonly _tag = "SliderField";
}

export class DateTimeField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new DateTimeField(opts);
  }

  readonly _tag = "DateTimeField";
}

export class ArrayField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new ArrayField(opts);
  }

  readonly _tag = "ArrayField";
}

export class UploadField extends DataFieldType {
  static build(opts: CommonDataFieldOptions) {
    return new UploadField(opts);
  }

  readonly _tag = "UploadField";
}

export class GroupField extends PresentationFieldType {
  static build(opts: {}) {
    return new GroupField();
  }

  readonly _tag = "GroupField";
}

export class TabsField extends PresentationFieldType {
  static build(opts: {}) {
    return new TabsField();
  }

  readonly _tag = "TabsField";
}

export class PagesField extends PresentationFieldType {
  static build(opts: {}) {
    return new PagesField();
  }

  readonly _tag = "PagesField";
}

export const fields = {
  // Data fields
  number: NumberField.build,
  text: TextField.build,
  textarea: TextareaField.build,
  autocomplete: AutocompleteField.build,
  checkbox: CheckboxField.build,
  toggle: ToggleField.build,
  switch: SwitchField.build,
  radioGroup: RadioGroupField.build,
  select: SelectField.build,
  slider: SelectField.build,
  dateTime: DateTimeField.build,
  array: ArrayField.build,
  upload: UploadField.build,
  // Presentation fields
  group: GroupField.build,
  tabs: TabsField.build,
  pages: PagesField.build,
  // Others
  other: <T>(field: T) => field,
} as const;
