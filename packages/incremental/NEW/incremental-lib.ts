import { type IncrementalOpts, IncrementalBackend } from "./runtime/backend";
import {
  type CellsTypes,
  type IncrementalFunctionSchemaOpts,
  IncrementalFunctionCallDescription,
  IncrementalFunctionSchema,
} from "./descriptions/functions";
import type { ResultOfComputation } from "./descriptions/computations";
import type { IncrementalRootAPI } from "./runtime/root";

export type ComputationController<T> = {
  readonly interrupt: () => Promise<void>;
  readonly finish: () => Promise<T>;
  peekErrors(): {
    readonly deterministic: unknown[];
    readonly nonDeterministic: unknown[];
  };
};

export class IncrementalLib<RootCells extends CellsTypes> {
  private readonly backend: IncrementalBackend<RootCells>;
  public readonly rootCells: IncrementalRootAPI<RootCells>;

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
    const desc = new IncrementalFunctionCallDescription(schema, input);
    const func = this.backend.getComputation(desc, true);
    return func.outputCell.entryGet();
  }

  close() {
    return this.backend.close();
  }

  /* controller(): ComputationController<ResultOfComputation<C>> {
    const backend = this;
    let interrupted = false;
    let finishing = false;

    return {
      async interrupt() {
        if (interrupted) throw new Error("Already interrupted");
        interrupted = true;
        backend.disableExternalInvalidations();
        backend.disableInvalidations();
        await backend.cleanupRun(computation, true);
      },
      async finish() {
        if (interrupted) throw new Error("Already interrupted");
        if (finishing) throw new Error("Already finishing");
        finishing = true;
        backend.disableExternalInvalidations();
        backend.invalidateSettledUnstable();
        await backend.wait();
        // If there are settled unstable computations (those that returned non-deterministic errors)
        // there might be another round of invalidations
        // so only disable general invalidations after waiting
        backend.disableInvalidations();
        const result = await backend.run(computation);
        await backend.cleanupRun(computation, false);
        return result.result;
      },
      peekErrors() {
        return backend.peekErrors();
      },
    };
  } */
}
