import { Computation, ComputationRegistry, CValue } from "../utils/computation-registry";

const FAKE_PROMISE = Promise.resolve( [ undefined, null ] as CValue<void> );

export class FileComputation extends Computation<void> {

  readonly path: string;

  constructor( registry: ComputationRegistry, path: string ) {
    super( registry );
    this.path = path;
    this.registry.markDone( this as Computation<void> );
  }

  run() {
    return FAKE_PROMISE;
  }

}
