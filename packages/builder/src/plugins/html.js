import cloneAst from "./clone-ast";
import LanguageModule from "./language";

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
        src: attrsObj.src,
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
        src: attrsObj.href,
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

const INTERNAL = "__builderHtmlLoader";
const NAMESPACE = "http://www.w3.org/1999/xhtml";

class HtmlModule extends LanguageModule {

  constructor( id, code ) {
    super( id );

    this.treeAdapter = new TreeAdapter();

    this.originalCode = code;

    this.document = parse5.parse( code, {
      treeAdapter: this.treeAdapter,
      locationInfo: true
    } );

    this.getDeps();
  }

  getInternalBySource( source ) {
    return super.getInternalBySource( source, INTERNAL );
  }

  getDeps() {
    this.treeAdapter.__deps.forEach( s => {
      this.addDep( {
        src: s.src,
        loc: {
          line: s.node.__location.line,
          column: s.node.__location.col - 1
        },
        splitPoint: s.splitPoint,
        async: s.async
      } );
    } );
  }

  createTextScript( text ) {
    const script = this.treeAdapter.createElement( "script", NAMESPACE, [] );
    this.treeAdapter.insertText( script, text );
    return script;
  }

  createSrcScript( src ) {
    return this.treeAdapter.createElement( "script", NAMESPACE, [ { name: "src", value: src } ] );
  }

  createHrefCss( href ) {
    return this.treeAdapter.createElement( "link", NAMESPACE, [ { name: "href", value: href }, { name: "rel", value: "stylesheet" } ] );
  }

  insertBefore( node, ref ) {
    this.treeAdapter.insertBefore( ref.parentNode, node, ref );
  }

  remove( node ) {
    this.treeAdapter.detachNode( node );
  }

  async render( builder, asset, finalAssets, usedHelpers ) {

    if ( this.treeAdapter.__deps.length ) {

      const cloneStack = new Map();
      const document = cloneAst( this.document, cloneStack );

      const deps = this.treeAdapter.__deps.map( d => {
        return Object.assign( {}, d, { node: cloneStack.get( d.node ) } );
      } );

      const firstScriptDep = deps.find( d => d.importType === "js" );

      if ( asset.isEntry && firstScriptDep ) {
        this.insertBefore(
          this.createTextScript( await builder.createRuntime( { finalAssets, usedHelpers } ) ),
          firstScriptDep.node
        );
      }

      const syncDeps = new Set();

      for ( const { node, src, async, importType } of deps ) {
        const module = this.getModuleBySource( src );

        if ( importType === "css" ) {

          for ( const { id, relativeDest } of finalAssets.moduleToAssets.get( module.hashId ) ) {
            if ( id !== this.id && !syncDeps.has( id ) ) {
              syncDeps.add( relativeDest );
              this.insertBefore( this.createHrefCss( relativeDest ), node );
            }
          }

          const hrefIdx = node.attrs.findIndex( ( { name } ) => name === "href" );
          node.attrs.splice( hrefIdx, 1 );

        } else {

          if ( !async ) {
            for ( const { id, relativeDest } of finalAssets.moduleToAssets.get( module.hashId ) ) {
              if ( id !== this.id && !syncDeps.has( id ) ) {
                syncDeps.add( relativeDest );
                this.insertBefore( this.createSrcScript( relativeDest ), node );
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

      return parse5.serialize( document, {
        treeAdapter: this.treeAdapter
      } );
    }

    return this.originalCode;
  }

}

export default function() {
  return {
    async transform( { type, code }, id ) {
      if ( type !== "html" ) {
        return;
      }
      const htmlModule = new HtmlModule( id, code );
      return {
        type: "html",
        code,
        deps: htmlModule.deps,
        [ INTERNAL ]: htmlModule
      };
    },

    async render( builder, asset, finalAssets, usedHelpers ) {

      const htmlModule = builder.getModule( asset.id ).getLastOutput( INTERNAL );

      if ( !htmlModule ) {
        return;
      }
      htmlModule.builder = builder;

      return {
        code: await htmlModule.render( builder, asset, finalAssets, usedHelpers )
      };
    }
  };
}
