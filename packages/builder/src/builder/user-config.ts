import { Transforms, FinalModule, UserConfigOpts, OptimizationOptions, ProvidedPluginsArr } from "../types";
import { defaultResolvers, defaultTransformers, defaultPackagers, jsTransformer, htmlTransformer, defaultCheckers } from "../plugins/default-plugins";

// Indicates how to transform and split the modules
export class UserConfig {

  cwd: string;
  optimization: OptimizationOptions;
  resolvers: ProvidedPluginsArr<string>;
  transformers: ProvidedPluginsArr<string>;
  checkers: ProvidedPluginsArr<string>;
  packagers: ProvidedPluginsArr<string>;

  constructor( opts: UserConfigOpts ) {
    this.cwd = opts.cwd;
    this.optimization = opts.optimization;
    this.resolvers = opts.resolvers.concat( defaultResolvers );
    this.transformers = opts.transformers.concat( defaultTransformers );
    this.checkers = opts.checkers.concat( defaultCheckers );
    this.packagers = opts.packagers.concat( defaultPackagers );
  }

  // TODO
  isSplitPoint( imported: FinalModule, importee: FinalModule ): boolean | null {
    return imported.type !== importee.type;
  }

  // TODO
  getTransformationsForPath( path: string ): Transforms {
    if ( /\.js$/.test( path ) ) {
      return [ [ /* babelTransformer,*/ jsTransformer ] ];
    }
    if ( /\.html$/.test( path ) ) {
      return [ [ htmlTransformer ] ];
    }
    return [];
  }

  getTransformationsForType( type: string ): Transforms {
    if ( type === "js" ) {
      return [ [ /* babelTransformer,*/ jsTransformer ] ];
    }
    return [];
  }

}
