import { IncrementalBackend, type IncrementalOpts } from "./backend";
import {
  IncrementalFunctionCallDescription,
  IncrementalFunctionSchema,
  type CellValueDescriptions,
  type IncrementalFunctionSchemaOpts,
} from "./functions";

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
}
