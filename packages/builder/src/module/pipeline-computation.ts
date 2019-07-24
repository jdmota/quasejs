import { TransformableAsset } from "../types";
import { Module } from "./module";
import { Builder } from "../builder/builder";
import { ComputationRegistry, Computation, CValue } from "../utils/computation-registry";
import { deserialize, serialize } from "../utils/serialization";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

type Processed = Readonly<{
  asset: SharedArrayBuffer;
  id: number;
}>;

export class PipelineComputation extends Computation<Processed> {

  private module: Module;
  private builder: Builder;
  private id: number;

  constructor( registry: ComputationRegistry, module: Module ) {
    super( registry );
    this.module = module;
    this.builder = module.builder;
    this.id = 0;
  }

  protected async run( _: Processed | null, isRunning: () => void ): Promise<CValue<Processed>> {

    const id = this.id++;
    const { module } = this;

    let asset: SharedArrayBuffer | null;

    // For inline dependency module
    if ( module.parentInner ) {

      const [ parentResult, error ] = await this.getDep( module.parentInner.pipeline );
      isRunning();

      if ( error ) {
        return [ null, error ];
      }

      const parentAsset = deserialize<TransformableAsset>( parentResult!.asset );
      const { depsInfo: parentDeps } = parentAsset;
      const result =
        parentDeps && parentDeps.innerDependencies ?
          parentDeps.innerDependencies.get( module.innerId ) :
          undefined;

      if ( !result ) {
        return [ null, new Error( `Internal: Could not get inner dependency content` ) ];
      }

      if ( this.builder.options.optimization.sourceMaps ) {
        // TODO
        asset = serialize( {
          type: result.type,
          data: result.data,
          ast: null,
          map: null,
          depsInfo: null,
          meta: null
        } );
      } else {
        asset = serialize( {
          type: result.type,
          data: result.data,
          ast: null,
          map: null,
          depsInfo: null,
          meta: null
        } );
      }

    // For modules generated from other module
    } else if ( module.parentGenerator ) {

      const [ parentResult, error ] = await this.getDep( module.parentGenerator.pipeline );
      isRunning();

      if ( error ) {
        return [ null, error ];
      }

      asset = parentResult!.asset;

    // Original module from disk
    } else {
      asset = null;
    }

    let result;

    try {
      const o = await this.builder.pluginsRunner.pipeline( asset, this.module.ctx );
      isRunning();

      this.builder.subscribeFiles( o.files, this );
      result = o.result;
    } catch ( error ) {
      return [ null, error ];
    }

    return [ {
      asset: result,
      id
    }, null ];
  }

}
