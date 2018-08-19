// @flow
import type { FinalAsset, FinalAssets, ToWrite, Plugin } from "../../types";
import type Builder from "../../builder";
import cloneAst from "./clone-ast";

const parse5 = require( "parse5" );
const defaultTreeAdapter = require( "parse5/lib/tree-adapters/default" );

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

Object.assign( TreeAdapter.prototype, defaultTreeAdapter );

TreeAdapter.prototype.createElement = function( tagName, namespaceURI, attrs ) {
  const node = defaultTreeAdapter.createElement( tagName, namespaceURI, attrs );

  if ( tagName === "script" ) {
    const attrsObj = attrsToObj( attrs );

    if ( attrsObj.type === "module" ) {
      if ( "src" in attrsObj ) {
        this.__deps.push( {
          node,
          async: "async" in attrsObj && attrsObj.async !== "false",
          request: attrsObj.src,
          importType: "js"
        } );
        node.__importType = "js";
      } else {
        this.__deps.push( {
          node,
          async: "async" in attrsObj && attrsObj.async !== "false",
          request: `${this.__deps.length}`,
          inner: true,
          importType: "js"
        } );
        node.__importType = "js";
      }
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

class HtmlRenderer {

  +document: Object;
  +treeAdapter: TreeAdapter;

  constructor( ast: Object ) {
    this.document = ast;
    this.treeAdapter = ast._treeAdapter;
  }

  createTextScript( text: string ) {
    const script = this.treeAdapter.createElement( "script", NAMESPACE, [] );
    this.treeAdapter.insertText( script, text );
    return script;
  }

  createSrcScript( src: string, noDefer: ?boolean ) {
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

  insertBefore( node: Object, ref: Object ) {
    this.treeAdapter.insertBefore( ref.parentNode, node, ref );
  }

  remove( node: Object ) {
    this.treeAdapter.detachNode( node );
  }

  async render( asset: FinalAsset, finalAssets: FinalAssets, builder: Builder ): Promise<ToWrite> {

    // TODO preload

    const cloneStack = new Map();
    const document = cloneAst( this.document, cloneStack );

    const deps = this.treeAdapter.__deps.map( d => {
      return Object.assign( {}, d, { node: cloneStack.get( d.node ) } );
    } );

    const firstScriptDep = deps.find( d => d.importType === "js" );
    const runtime = asset.runtime;

    if ( runtime && firstScriptDep ) {
      if ( builder.options.hmr ) {
        this.insertBefore(
          this.createSrcScript( builder.publicPath + runtime.relative, true ),
          firstScriptDep.node
        );
      } else {
        this.insertBefore(
          this.createTextScript( runtime.code ),
          firstScriptDep.node
        );
      }
    }

    for ( const { node, request, async, importType } of deps ) {
      const module = asset.module.getModuleByRequest( request );

      if ( !module ) {
        throw new Error( `Internal: missing module by request ${request} in ${asset.id}` );
      }

      const neededAssets = finalAssets.moduleToAssets.get( module ) || [];

      if ( importType === "css" ) {

        for ( let i = 0; i < neededAssets.length; i++ ) {
          const { relative } = neededAssets[ i ];
          if ( i === neededAssets.length - 1 ) {
            this.treeAdapter.setAttr( node, "href", builder.publicPath + relative );
          } else {
            this.insertBefore( this.createHrefCss( builder.publicPath + relative ), node );
          }
        }

      } else {

        this.treeAdapter.removeAttr( node, "defer" );
        this.treeAdapter.removeAttr( node, "async" );
        this.treeAdapter.removeAttr( node, "src" );
        this.treeAdapter.removeAttr( node, "type" );
        node.childNodes = [];

        const inlineAsset = asset.inlineAssets.find( a => a.module === module );

        if ( inlineAsset ) {

          const { data } = await builder.renderAsset( inlineAsset, finalAssets );

          if ( async ) {

            this.treeAdapter.setAttr( node, "async", "" );

          } else {

            this.treeAdapter.setAttr( node, "defer", "" );

            for ( const { relative } of neededAssets ) {
              this.insertBefore( this.createSrcScript( builder.publicPath + relative ), node );
            }

          }

          this.treeAdapter.insertText( node, `${data.toString()}\n__quase_builder__.r(${builder.wrapInJsString( module.hashId )});` );

        } else {

          if ( async ) {

            this.treeAdapter.insertText( node, `
                (function(){
                  var s=document.currentScript;
                  __quase_builder__.i(${builder.wrapInJsString( module.hashId )}).then(function(){
                    s.dispatchEvent(new Event('load'));
                  },function(){
                    s.dispatchEvent(new Event('error'));
                  });
                })();
              `.replace( /(\n|\s\s)/g, "" ) );

          } else {

            this.treeAdapter.setAttr( node, "defer", "" );
            this.treeAdapter.setAttr( node, "src", `data:text/javascript,__quase_builder__.r(${builder.wrapInJsString( module.hashId )});` );

            for ( const { relative } of neededAssets ) {
              this.insertBefore( this.createSrcScript( builder.publicPath + relative ), node );
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

const PLUGIN_NAME = "quase_builder_html_plugin";

export default function htmlPlugin(): Plugin {
  return {
    name: PLUGIN_NAME,
    parse: {
      html( data ) {
        const treeAdapter = new TreeAdapter();
        const deps = {
          dependencies: new Map(),
          innerDependencies: new Map(),
          importedNames: [],
          exportedNames: []
        };

        const ast = parse5.parse( data, {
          treeAdapter,
          sourceCodeLocationInfo: true
        } );

        ast._treeAdapter = treeAdapter;
        ast._deps = deps;

        return ast;
      }
    },
    transformAst: {
      async html( ast ) {

        const treeAdapter = ast._treeAdapter;
        const deps = ast._deps;

        if ( !treeAdapter || !deps ) {
          throw new Error( `${PLUGIN_NAME}: Could not metadata. Did another plugin change the AST?` );
        }

        treeAdapter.__deps.forEach( s => {
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

        return ast;
      }
    },
    dependencies: {
      html( ast ) {
        const deps = ast._deps;
        if ( deps ) {
          return deps;
        }
        throw new Error( `${PLUGIN_NAME}: Could not metadata. Did another plugin change the AST?` );
      }
    },
    renderAsset: {
      html( asset: FinalAsset, finalAssets: FinalAssets, builder: Builder ) {

        if ( asset.srcs.length !== 1 ) {
          throw new Error( `${PLUGIN_NAME}: Asset "${asset.id}" to be generated can only have 1 source.` );
        }

        const { ast } = asset.module.getTransformResult();

        if ( ast ) {
          const renderer = new HtmlRenderer( ast );
          return renderer.render( asset, finalAssets, builder );
        }

        throw new Error( `${PLUGIN_NAME}: Could not find AST` );
      }
    }
  };
}
