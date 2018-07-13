// @flow
import type { FinalAsset, FinalAssets, ToWrite, Plugin } from "../types";
import type Builder from "../builder";
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

class HtmlRenderer {

  +originalCode: string;
  +document: Object;
  +treeAdapter: TreeAdapter;

  constructor( data: string, ast: Object ) {
    this.originalCode = data;
    this.document = ast;
    this.treeAdapter = ast._treeAdapter;
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

  async render( asset: FinalAsset, finalAssets: FinalAssets, builder: Builder ): Promise<ToWrite> {

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
        const module = builder.getModuleForSure( asset.id ).getModuleByRequest( request );

        if ( !module ) {
          throw new Error( `Internal: missing module by request ${request} in ${asset.id}` );
        }

        const assets = finalAssets.moduleToAssets.get( module.hashId ) || [];

        if ( importType === "css" ) {

          for ( let i = 0; i < assets.length; i++ ) {
            const { relative } = assets[ i ];
            if ( i === assets.length - 1 ) {
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

            for ( const { relative } of assets ) {
              this.insertBefore( this.createSrcScript( builder.publicPath + relative ), node );
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

const PLUGIN_NAME = "quase_builder_html_plugin";

export default function htmlPlugin(): Plugin {
  return {
    name: PLUGIN_NAME,
    transform: {
      async html( { data, map, ast: prevAst } ) {

        const dataToString = data.toString();

        const deps = {
          dependencies: [],
          importedNames: [],
          exportedNames: []
        };

        const treeAdapter = new TreeAdapter();

        const newAst: Object = prevAst || parse5.parse( data.toString(), {
          treeAdapter,
          sourceCodeLocationInfo: true
        } );

        treeAdapter.__deps.forEach( s => {
          deps.dependencies.push( {
            request: s.request,
            loc: {
              line: s.node.sourceCodeLocation.startLine,
              column: s.node.sourceCodeLocation.startCol - 1
            },
            async: s.async
          } );
        } );

        newAst._treeAdapter = treeAdapter;
        newAst._deps = deps;

        return {
          data: dataToString,
          ast: newAst,
          map
        };
      }
    },
    dependencies: {
      html( { ast } ) {
        const deps = ast && ast._deps;
        if ( deps ) {
          return deps;
        }
        throw new Error( `${PLUGIN_NAME}: Could not find dependencies. Did another plugin change the AST?` );
      }
    },
    renderAsset: {
      async html( asset: FinalAsset, finalAssets: FinalAssets, builder: Builder ) {

        if ( asset.srcs.length !== 1 ) {
          throw new Error( `${PLUGIN_NAME}: Asset "${asset.id}" to be generated can only have 1 source.` );
        }

        const module = builder.getModuleForSure( asset.id );

        const { result: { data, ast } } = await module.transform( builder );

        if ( ast ) {
          const renderer = new HtmlRenderer( data.toString(), ast );
          return renderer.render( asset, finalAssets, builder );
        }

        return {
          data
        };
      }
    }
  };
}