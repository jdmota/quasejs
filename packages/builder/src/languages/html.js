// @flow
import type { Data, NotResolvedDep, FinalAsset, FinalAssets } from "../types";
import type Builder from "../builder";
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
        splitPoint: true,
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
        splitPoint: true,
        importType: "css"
      } );
      node.__importType = "css";
    }
  }

  return node;
};

TreeAdapter.prototype.getAttrList = function( element ) {
  if ( element.__importType === "js" ) {
    return element.attrs.filter( a => a.name !== "type" );
  }
  return element.attrs;
};

const NAMESPACE = "http://www.w3.org/1999/xhtml";

export default class HtmlLanguage extends Language {

  static TYPE = "html";

  +deps: NotResolvedDep[];
  +treeAdapter: TreeAdapter;
  +originalCode: string;
  +document: Object;

  constructor( id: string, data: Data, options: Object ) {
    super( id, data, options );

    this.deps = [];

    this.treeAdapter = new TreeAdapter();

    this.originalCode = data.toString();

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
        splitPoint: s.splitPoint,
        async: s.async
      } );
    } );
  }

  async dependencies() {
    return this.deps;
  }

  createTextScript( text: string ) {
    const script = this.treeAdapter.createElement( "script", NAMESPACE, [] );
    this.treeAdapter.insertText( script, text );
    return script;
  }

  createSrcScript( src: string ) {
    return this.treeAdapter.createElement( "script", NAMESPACE, [ { name: "src", value: src } ] );
  }

  createHrefCss( href: string ) {
    return this.treeAdapter.createElement( "link", NAMESPACE, [ { name: "href", value: href }, { name: "rel", value: "stylesheet" } ] );
  }

  insertBefore( node: Object, ref: Object ) {
    this.treeAdapter.insertBefore( ref.parentNode, node, ref );
  }

  remove( node: Object ) {
    this.treeAdapter.detachNode( node );
  }

  async renderAsset( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets, usedHelpers: Set<string> ) {
    if ( asset.srcs.length !== 1 ) {
      throw new Error( `Asset "${asset.normalized}" to be generated can only have 1 source.` );
    }
    return this.render( builder, asset, finalAssets, usedHelpers );
  }

  async render( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets, usedHelpers: Set<string> ) {

    if ( this.treeAdapter.__deps.length ) {

      // TODO leave the script tags but somehow handle onload event

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
            finalAssets,
            usedHelpers
          } ) ),
          firstScriptDep.node
        );
      }

      const syncDeps = new Set();

      for ( const { node, request, async, importType } of deps ) {
        const module = builder.getModuleForSure( this.id ).getModuleByRequest( builder, request );

        if ( !module ) {
          throw new Error( "Assertion error on HtmlLanguage: missing module" );
        }

        const assets = finalAssets.moduleToAssets.get( module.hashId ) || [];

        if ( importType === "css" ) {

          for ( const { id, relativeDest } of assets ) {
            if ( id !== this.id && !syncDeps.has( id ) ) {
              syncDeps.add( relativeDest );
              this.insertBefore( this.createHrefCss( builder.publicPath + relativeDest ), node );
            }
          }

          const hrefIdx = node.attrs.findIndex( ( { name } ) => name === "href" );
          node.attrs.splice( hrefIdx, 1 );

        } else {

          if ( !async ) {
            for ( const { id, relativeDest } of assets ) {
              if ( id !== this.id && !syncDeps.has( id ) ) {
                syncDeps.add( relativeDest );
                this.insertBefore( this.createSrcScript( builder.publicPath + relativeDest ), node );
              }
            }
          }

          this.insertBefore(
            this.createTextScript( `__quase_builder__.${async ? "i" : "r"}('${module.hashId}');` ),
            node
          );

          const srcIdx = node.attrs.findIndex( ( { name } ) => name === "src" );
          node.attrs.splice( srcIdx, 1 );
          if ( node.children ) {
            node.children.length = 0;
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
