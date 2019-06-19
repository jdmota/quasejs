import { DepsInfo, Transformer } from "../../types";
import { TreeAdapterProxy } from "../utils/html-tree-adapter";

const importLazy = require( "import-lazy" )( require );
const parse5 = importLazy( "parse5" );

const TRANSFORMER_NAME = "quase_builder_html_transformer";

export const transformer: Transformer = {

  name: TRANSFORMER_NAME,

  parse( _options, asset, ctx ) {
    // @ts-ignore
    const treeAdapter = new TreeAdapterProxy();
    const deps: DepsInfo = {
      dependencies: new Map(),
      innerDependencies: new Map(),
      importedNames: [],
      exportedNames: []
    };

    const ast = parse5.parse( ctx.dataToString( asset.data ), {
      treeAdapter,
      sourceCodeLocationInfo: true
    } );

    ast._depsExtraInfo = treeAdapter.__deps;
    ast._deps = deps;

    return {
      type: "parse5",
      version: "5",
      isDirty: false,
      program: ast
    };
  },

  async transform( _options, asset ) {

    if ( !asset.ast ) {
      return asset;
    }

    const depsExtraInfo = asset.ast.program._depsExtraInfo;
    const deps = asset.ast.program._deps;

    if ( !depsExtraInfo || !deps ) {
      throw new Error( `${TRANSFORMER_NAME}: Could not find metadata. Did another plugin change the AST?` );
    }

    depsExtraInfo.forEach( ( s: any ) => {
      if ( s.inner ) {
        if ( s.node.childNodes.length === 0 ) {
          return;
        }

        const text = s.node.childNodes[ 0 ];

        deps.innerDependencies.set( s.request, {
          data: text.value,
          type: s.importType,
          loc: {
            line: text.sourceCodeLocation.startLine,
            column: text.sourceCodeLocation.startCol - 1
          },
          async: s.async
        } );
      } else {
        if ( !deps.dependencies.has( s.request ) ) {
          deps.dependencies.set( s.request, {
            loc: {
              line: s.node.sourceCodeLocation.startLine,
              column: s.node.sourceCodeLocation.startCol - 1
            },
            async: s.async
          } );
        }
      }
    } );

    asset.depsInfo = deps;
    return asset;
  }

};

export default transformer;
