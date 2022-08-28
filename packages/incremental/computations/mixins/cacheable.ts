import { RawComputation } from "../raw";

export interface CacheableComputation<Res> {
  readonly cacheableComputation: CacheableComputationMixin<Res>;
  serialize(result: Res): Buffer;
  deserialize(result: Buffer): Res;
}

export class CacheableComputationMixin<Res> {
  public readonly source: RawComputation<any, Res> & CacheableComputation<Res>;

  constructor(source: RawComputation<any, Res> & CacheableComputation<Res>) {
    this.source = source;
  }
}

// TODO
