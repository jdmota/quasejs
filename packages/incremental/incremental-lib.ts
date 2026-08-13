import { type IncrementalOpts, IncrementalBackend } from "./runtime/backend";
import {
  type CellsTypes,
  type IncrementalFunctionSchemaOpts,
  IncrementalFunctionCallDescription,
  IncrementalFunctionSchema,
} from "./descriptions/functions";
import type { IncrementalRootAPI } from "./runtime/root";

export class IncrementalLib<RootCells extends CellsTypes> {
  private readonly backend: IncrementalBackend<RootCells>;
  public readonly rootCells: IncrementalRootAPI<RootCells>;
  private interrupted = false;
  private finishing = false;

  constructor(opts: IncrementalOpts) {
    this.backend = new IncrementalBackend(opts);
    this.rootCells = this.backend.rootCellOwner.publicApi;
  }

  static register<Input, Output, Cells extends CellsTypes>(
    opts: IncrementalFunctionSchemaOpts<Input, Output, Cells>
  ) {
    return IncrementalBackend.functions.register(opts);
  }

  async call<Input, Output, Cells extends CellsTypes>(
    schema: IncrementalFunctionSchema<Input, Output, Cells>,
    input: Input
  ) {
    await this.backend.load();
    const desc = new IncrementalFunctionCallDescription(schema, input);
    const func = this.backend.getComputation(desc, true);
    return func.outputCell.entryGet();
  }

  async interrupt() {
    if (this.interrupted) throw new Error("Already interrupted");
    this.interrupted = true;
    this.backend.disableExternalInvalidations();
    this.backend.disableInvalidations();
    await this.backend.cleanupRun(true);
  }

  async finish<Input, Output, Cells extends CellsTypes>(
    schema: IncrementalFunctionSchema<Input, Output, Cells>,
    input: Input
  ) {
    if (this.interrupted) throw new Error("Already interrupted");
    if (this.finishing) throw new Error("Already finishing");
    this.finishing = true;
    this.backend.disableExternalInvalidations();
    this.backend.disableInvalidations();
    const result = await this.call(schema, input);
    await this.backend.cleanupRun(false);
    return result;
  }

  peekErrors() {
    return this.backend.peekErrors();
  }
}
