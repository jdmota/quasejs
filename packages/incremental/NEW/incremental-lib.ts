import { type IncrementalOpts, IncrementalBackend } from "./runtime/backend";
import {
  type CellValueDescriptions,
  type IncrementalFunctionSchemaOpts,
  IncrementalFunctionCallDescription,
  IncrementalFunctionSchema,
} from "./descriptions/functions";
import type { ResultOfComputation } from "./descriptions/computations";

export type ComputationController<T> = {
  readonly interrupt: () => Promise<void>;
  readonly finish: () => Promise<T>;
  peekErrors(): {
    readonly deterministic: unknown[];
    readonly nonDeterministic: unknown[];
  };
};

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
    const func = this.backend.getFunction(desc, true);
    return func.outputCell.entryGet();
  }

  close() {
    return this.backend.close();
  }

  controller(): ComputationController<ResultOfComputation<C>> {
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
  }
}
