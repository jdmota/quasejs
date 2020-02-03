import { Builder } from "../builder/builder";
import { ModuleContext } from "../plugins/context";
import { PipelineComputation } from "./pipeline-computation";
import { ResolveComputation } from "./resolve-computation";

export type ModuleArg =
  | Readonly<{
      innerId: null;
      parentInner: null;
      parentGenerator: null;
      transforms: readonly string[];
      path: string;
    }>
  | Readonly<{
      // This module is inside other module
      innerId: string;
      parentInner: Module;
      parentGenerator: null;
      transforms: readonly string[];
      path: string;
    }>
  | Readonly<{
      // This module was transformed from other module
      innerId: null;
      parentInner: null;
      parentGenerator: Module;
      transforms: readonly string[];
      path: string;
    }>;

export type Module = {
  // Unique id
  readonly id: string;
  // Absolute file path
  readonly path: string;
  // Relative file path (to context)
  readonly relativePath: string;
  // Context
  readonly ctx: ModuleContext;
  // Builder
  readonly builder: Builder;
  // Computations
  pipeline: PipelineComputation;
  resolveDeps: ResolveComputation;
} & ModuleArg;

export type ModuleInfo = Readonly<{
  id: string;
  path: string;
  relativePath: string;
  transforms: readonly string[];
}>;

export class ModuleContextWithoutFS extends ModuleContext {
  registerFile(_: string, _2: { onlyExistance?: boolean } = {}) {
    throw new Error(
      "File system operations are not possible with this context"
    );
  }
}
