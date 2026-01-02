import { IncrementalBackend, type IncrementalOpts } from "./runtime/backend";
import {
  type CellValueDescriptions,
  type IncrementalFunctionSchemaOpts,
  IncrementalFunctionCallDescription,
  IncrementalFunctionSchema,
} from "./descriptions/functions";

export class IncrementalLib {
  private readonly backend: IncrementalBackend;

  constructor(opts: IncrementalOpts) {
    this.backend = new IncrementalBackend(opts);
  }

  static register<Input, Output, CellDefs extends CellValueDescriptions>(
    opts: IncrementalFunctionSchemaOpts<Input, Output, CellDefs>
  ) {
    return IncrementalBackend.functions.register(opts);
  }

  async call<Input, Output, CellDefs extends CellValueDescriptions>(
    schema: IncrementalFunctionSchema<Input, Output, CellDefs>,
    input: Input
  ) {
    const desc = new IncrementalFunctionCallDescription(schema, input);
    const func = this.backend.make(desc);
    return func.outputCell.entryGet();
  }

  close() {
    return this.backend.close();
  }
}
