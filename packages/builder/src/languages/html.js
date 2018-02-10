// @flow
import type { NotResolvedDep, FinalAsset, FinalAssets } from "../types";
import type Builder from "../builder";
import type Module from "../module";
import Language from "../language";
import cloneAst from "./clone-ast";

const parse5 = require( "parse5" );

function attrsToObj( attrs ) {
  const attrsObj = {};
  for ( const { name, value } of attrs ) {
    attrsObj[ name ] = value;
  }
  return attrsObj;
}

function TreeAdapter() {
  this.__deps = [];
}

const defaultTreeAdapter = parse5.treeAdapters.default;
Object.assign( TreeAdapter.prototype, defaultTreeAdapter );

// TODO be able to transform inline javascript?
// TODO be able to inline a file?

TreeAdapter.prototype.createElement = function( tagName, namespaceURI, attrs ) {
  const node = defaultTreeAdapter.createElement( tagName, namespaceURI, attrs );

  if ( tagName === "script" ) {
    const attrsObj = attrsToObj( attrs );

    if ( attrsObj.type === "module" && "src" in attrsObj ) {
      this.__deps.push( {
        node,
        async: "async" in attrsObj && attrsObj.async !== "false",
        request: attrsObj.src,
        importType: "js"
      } );
      node.__importType = "js";
    }
  } else if ( tagName === "link" ) {
    const attrsObj = attrsToObj( attrs );

    if ( "href" in attrsObj && attrsObj.rel.split( /\s+/ ).includes( "stylesheet" ) ) {
      this.__deps.push( {
        node,
        async: false,
        request: attrsObj.href,
        importType: "css"
      } );
      node.__importType = "css";
    }
  }

  return node;
};

TreeAdapter.prototype.getAttr = function( element, attrName ) {
  const a = element.attrs.find( ( { name } ) => name === attrName ) || {};
  return a.value;
};

TreeAdapter.prototype.setAttr = function( element, attrName, value ) {
  const a = element.attrs.find( ( { name } ) => name === attrName );
  if ( a ) {
    a.value = value;
  } else {
    element.attrs.push( {
      name: attrName,
      value
    } );
  }
};

TreeAdapter.prototype.removeAttr = function( element, attrName ) {
  const index = element.attrs.findIndex( ( { name } ) => name === attrName );
  if ( index > -1 ) {
    element.attrs.splice( index, 1 );
  }
};

const NAMESPACE = "http://www.w3.org/1999/xhtml";

export default class HtmlLanguage extends Language {

  static TYPE = "html";

  +deps: NotResolvedDep[];
  +treeAdapter: TreeAdapter;
  +originalCode: string;
  +document: Object;

  constructor( options: Object, module: Module, builder: Builder ) {
    super( options, module, builder );

    this.deps = [];

    this.treeAdapter = new TreeAdapter();

    this.originalCode = module.data.toString();

    this.document = parse5.parse( this.originalCode, {
      treeAdapter: this.treeAdapter,
      locationInfo: true
    } );

    this.processDeps();
  }

  processDeps() {
    this.treeAdapter.__deps.forEach( s => {
      this.deps.push( {
        request: s.request,
        loc: {
          line: s.node.__location.line,
          column: s.node.__location.col - 1
        },
        async: s.async
      } );
    } );
  }

  async dependencies() {
    return {
      dependencies: this.deps,
      importedNames: [],
      exportedNames: []
    };
  }

  createTextScript( text: string ) {
    const script = this.treeAdapter.createElement( "script", NAMESPACE, [] );
    this.treeAdapter.insertText( script, text );
    return script;
  }

  createSrcScript( src: string ) {
    return this.treeAdapter.createElement( "script", NAMESPACE, [
      { name: "type", value: "text/javascript" },
      { name: "defer", value: "" },
      { name: "src", value: src }
    ] );
  }

  createHrefCss( href: string ) {
    return this.treeAdapter.createElement( "link", NAMESPACE, [
      { name: "href", value: href },
      { name: "rel", value: "stylesheet" }
    ] );
  }

  insertBefore( node: Object, ref: Object ) {
    this.treeAdapter.insertBefore( ref.parentNode, node, ref );
  }

  remove( node: Object ) {
    this.treeAdapter.detachNode( node );
  }

  async renderAsset( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets ) {
    if ( asset.srcs.length !== 1 ) {
      throw new Error( `Asset "${asset.normalized}" to be generated can only have 1 source.` );
    }
    return this.render( builder, asset, finalAssets );
  }

  async render( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets ) {

    if ( this.treeAdapter.__deps.length ) {

      // TODO preload

      const cloneStack = new Map();
      const document = cloneAst( this.document, cloneStack );

      const deps = this.treeAdapter.__deps.map( d => {
        return Object.assign( {}, d, { node: cloneStack.get( d.node ) } );
      } );

      const firstScriptDep = deps.find( d => d.importType === "js" );

      if ( asset.isEntry && firstScriptDep ) {
        this.insertBefore(
          this.createTextScript( await builder.createRuntime( {
            context: builder.context,
            fullPath: asset.path,
            publicPath: builder.publicPath,
            finalAssets
          } ) ),
          firstScriptDep.node
        );
      }

      for ( const { node, request, async, importType } of deps ) {
        const module = builder.getModuleForSure( this.id ).getModuleByRequest( builder, request );

        if ( !module ) {
          throw new Error( "Assertion error on HtmlLanguage: missing module" );
        }

        const assets = finalAssets.moduleToAssets.get( module.hashId ) || [];

        if ( importType === "css" ) {

          for ( let i = 0; i < assets.length; i++ ) {
            const { relativeDest } = assets[ i ];
            if ( i === assets.length - 1 ) {
              this.treeAdapter.setAttr( node, "href", builder.publicPath + relativeDest );
            } else {
              this.insertBefore( this.createHrefCss( builder.publicPath + relativeDest ), node );
            }
          }

        } else {

          this.treeAdapter.removeAttr( node, "defer" );
          this.treeAdapter.removeAttr( node, "async" );
          this.treeAdapter.removeAttr( node, "src" );
          this.treeAdapter.removeAttr( node, "type" );
          node.children = [];

          if ( async ) {

            this.treeAdapter.insertText( node, `
              var s=document.currentScript;
              __quase_builder__.i('${module.hashId}').then(function(){
                s.dispatchEvent(new Event('load'));
              },function(){
                s.dispatchEvent(new Event('error'));
              });
            `.replace( /(\n|\s\s)/g, "" ) );

          } else {

            this.treeAdapter.setAttr( node, "defer", "" );
            this.treeAdapter.setAttr( node, "src", `data:text/javascript,__quase_builder__.r('${module.hashId}');` );

            for ( const { relativeDest } of assets ) {
              this.insertBefore( this.createSrcScript( builder.publicPath + relativeDest ), node );
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

    return {
      data: this.originalCode
    };
  }

}
