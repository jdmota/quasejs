import { FinalAsset, ToWrite, Packager } from "../../types";
import { chunkInit } from "../../runtime/create-runtime";
import { BuilderUtil } from "../context";
import { TreeAdapter } from "../utils/html-tree-adapter";
import cloneAst from "../utils/clone-ast";
import { get } from "../../utils/get";

const importLazy = require( "import-lazy" )( require );
const parse5 = importLazy( "parse5" );

const NAMESPACE = "http://www.w3.org/1999/xhtml";

class HtmlRenderer {

  document: any;
  depsExtraInfo: any;
  treeAdapter: any;

  constructor( ast: any ) {
    this.document = ast;
    this.depsExtraInfo = ast._depsExtraInfo;
    // @ts-ignore
    this.treeAdapter = new TreeAdapter();
  }

  createTextScript( text: string ) {
    const script = this.treeAdapter.createElement( "script", NAMESPACE, [] );
    this.treeAdapter.insertText( script, text );
    return script;
  }

  createSrcScript( src: string, noDefer?: boolean ) {
    return this.treeAdapter.createElement( "script", NAMESPACE, [
      { name: "type", value: "text/javascript" },
      { name: "src", value: src },
      noDefer ? null : { name: "defer", value: "" }
    ].filter( Boolean ) );
  }

  createHrefCss( href: string ) {
    return this.treeAdapter.createElement( "link", NAMESPACE, [
      { name: "href", value: href },
      { name: "rel", value: "stylesheet" }
    ] );
  }

  insertBefore( node: any, ref: any ) {
    this.treeAdapter.insertBefore( ref.parentNode, node, ref );
  }

  remove( node: any ) {
    this.treeAdapter.detachNode( node );
  }

  async render(
    asset: FinalAsset,
    inlineAssets: Map<FinalAsset, ToWrite>,
    hashIds: ReadonlyMap<string, string>,
    ctx: BuilderUtil
  ): Promise<ToWrite> {

    // TODO preload

    const cloneStack = new Map();
    const document = cloneAst( this.document, cloneStack );

    const deps = this.depsExtraInfo.map( ( d: any ) => {
      return Object.assign( {}, d, { node: cloneStack.get( d.node ) } );
    } );

    const firstScriptDep = deps.find( ( d: any ) => d.importType === "js" );
    const runtimeCode = asset.runtime.code;

    if ( runtimeCode && firstScriptDep ) {
      this.insertBefore(
        this.createTextScript( runtimeCode ),
        firstScriptDep.node
      );
    }

    // Runtime info
    if ( asset.runtime.manifest ) {
      const code = `${chunkInit}.p({},${JSON.stringify( asset.runtime.manifest )})`;
      this.insertBefore(
        this.createTextScript( code ),
        firstScriptDep.node
      );
    }

    for ( const { node, request, async, importType, inner } of deps ) {
      const resolvedDep = inner ?
        asset.module.innerDependencies.get( request ) :
        asset.module.dependencies.get( request );

      if ( !resolvedDep ) {
        throw new Error( `Internal: missing module by request ${request} in ${asset.module.id}` );
      }

      const neededAssets = asset.manifest.moduleToAssets.get( get( hashIds, resolvedDep.id ) ) || [];

      if ( importType === "css" ) {

        for ( let i = 0; i < neededAssets.length; i++ ) {
          const relativeDest = neededAssets[ i ];
          if ( i === neededAssets.length - 1 ) {
            this.treeAdapter.setAttr( node, "href", ctx.builderOptions.publicPath + relativeDest );
          } else {
            this.insertBefore( this.createHrefCss( ctx.builderOptions.publicPath + relativeDest ), node );
          }
        }

      } else {

        this.treeAdapter.removeAttr( node, "defer" );
        this.treeAdapter.removeAttr( node, "async" );
        this.treeAdapter.removeAttr( node, "src" );
        this.treeAdapter.removeAttr( node, "type" );
        node.childNodes = [];

        const inlineAsset = asset.inlineAssets.find(
          a => a.module.id === resolvedDep.id
        );

        if ( inlineAsset ) {

          const toWrite = inlineAssets.get( inlineAsset );
          if ( !toWrite ) {
            throw new Error( "Assertion error" );
          }
          const { data } = toWrite;

          if ( async ) {

            this.treeAdapter.setAttr( node, "async", "" );

          } else {

            this.treeAdapter.setAttr( node, "defer", "" );

            for ( const relativeDest of neededAssets ) {
              this.insertBefore( this.createSrcScript( ctx.builderOptions.publicPath + relativeDest ), node );
            }

          }

          this.treeAdapter.insertText( node, `${ctx.dataToString( data )}\n__quase_builder__.r(${ctx.wrapInJsString( get( hashIds, resolvedDep.id ) )});` );

        } else {

          if ( async ) {

            this.treeAdapter.insertText( node, `
                (function(){
                  var s=document.currentScript;
                  __quase_builder__.i(${ctx.wrapInJsString( get( hashIds, resolvedDep.id ) )}).then(function(){
                    s.dispatchEvent(new Event('load'));
                  },function(){
                    s.dispatchEvent(new Event('error'));
                  });
                })();
              `.replace( /(\n|\s\s)/g, "" ) );

          } else {

            this.treeAdapter.setAttr( node, "defer", "" );
            this.treeAdapter.setAttr( node, "src", `data:text/javascript,__quase_builder__.r(${ctx.wrapInJsString( get( hashIds, resolvedDep.id ) )});` );

            for ( const relativeDest of neededAssets ) {
              this.insertBefore( this.createSrcScript( ctx.builderOptions.publicPath + relativeDest ), node );
            }

          }

        }

      }

    }

    return {
      data: parse5.serialize( document, {
        treeAdapter: this.treeAdapter
      } )
    };
  }

}

const PACKAGER_NAME = "quase_builder_html_packager";

export const packager: Packager = {

  pack(
    _options,
    asset: FinalAsset,
    inlineAssets: Map<FinalAsset, ToWrite>,
    hashIds: ReadonlyMap<string, string>,
    ctx: BuilderUtil
  ) {

    if ( asset.module.type !== "html" ) {
      return null;
    }

    if ( asset.srcs.size !== 1 ) {
      throw new Error( `${PACKAGER_NAME}: Asset "${asset.module.id}" to be generated can only have 1 source.` );
    }

    const { ast } = ctx.deserializeAsset( asset.module.asset );

    if ( ast ) {
      const renderer = new HtmlRenderer( ast.program );
      return renderer.render( asset, inlineAssets, hashIds, ctx );
    }

    throw new Error( `${PACKAGER_NAME}: Could not find AST` );
  }
};

export default packager;
