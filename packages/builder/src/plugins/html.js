import { relativeURL } from "../id";
import cloneAst from "./clone-ast";
import LanguageModule from "./language";

const path = require( "path" );
const parse5 = require( "parse5" );

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
    const attrsObj = {};
    for ( const { name, value } of attrs ) {
      attrsObj[ name ] = value;
    }

    if ( attrsObj.type === "module" && "src" in attrsObj ) {
      this.__deps.push( {
        node,
        async: "async" in attrsObj && attrsObj.async !== "false",
        src: attrsObj.src,
        splitPoint: true
      } );
      node.__import = true;
    }
  }

  return node;
};

TreeAdapter.prototype.getAttrList = function( element ) {
  if ( element.__import ) {
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

  insertBefore( node, ref ) {
    this.treeAdapter.insertBefore( ref.parentNode, node, ref );
  }

  async render( builder, { moduleToFiles } ) {

    if ( this.treeAdapter.__deps.length ) {

      const cloneStack = new Map();
      const document = cloneAst( this.document, cloneStack );

      for ( const dep of this.treeAdapter.__deps ) {
        dep.node = cloneStack.get( dep.node );
      }

      const firstScript = this.treeAdapter.__deps[ 0 ].node;

      if ( builder.isEntry( this.id ) ) {
        this.insertBefore(
          this.createTextScript( await builder.getRuntime() ),
          firstScript
        );
      }

      const deps = new Set();

      for ( const { node, src } of this.treeAdapter.__deps ) {
        const module = this.getModuleBySource( src );
        deps.add( module.id );

        const prevOnloadAttr = node.attrs.find( ( { name } ) => name === "onload" ) || {};
        const prevOnload = prevOnloadAttr.value ? prevOnloadAttr.value.replace( /;?$/, ";" ) : "";

        if ( prevOnload ) {
          prevOnloadAttr.value = `${prevOnload}__quase_builder__.r('${module.normalizedId}');`;
        } else {
          node.attrs.push( {
            name: "onload",
            value: `__quase_builder__.r('${module.normalizedId}');`
          } );
        }
      }

      const moreScripts = new Set();

      for ( const file of moduleToFiles[ this.id ] ) {
        if ( file !== this.id && !deps.has( file ) ) {
          moreScripts.add( relativeURL( file, this.id ) );
        }
      }

      for ( const src of moreScripts ) {
        this.insertBefore( this.createSrcScript( src ), firstScript );
      }

      return parse5.serialize( document, {
        treeAdapter: this.treeAdapter
      } );
    }

    return this.originalCode;
  }

}

export function plugin() {
  return async( { code, type }, id ) => {
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
  };
}

export function resolver() {
  return async( { type, src }, id, builder ) => {
    if ( type !== "html" ) {
      return;
    }
    const resolved = path.resolve( path.dirname( id ), src );
    const isFile = await builder.fileSystem.isFile( resolved );
    return isFile && resolved;
  };
}

export function renderer() {
  return async( builder, finalModules ) => {
    const out = [];

    for ( const finalModule of finalModules.modules ) {
      if ( finalModule.built ) {
        continue;
      }

      const { id, dest } = finalModule;
      const htmlModule = builder.getModule( id ).getLastOutput( INTERNAL );

      if ( !htmlModule ) {
        continue;
      }
      htmlModule.builder = builder;

      finalModule.built = true;

      out.push( {
        dest,
        code: await htmlModule.render( builder, finalModules )
      } );
    }

    return out;
  };
}
