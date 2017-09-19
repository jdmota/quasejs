import parseExpressionTemplate from "./parse-expression-template";
import { error } from "./utils";

class Path {
  constructor() {
    this.arr = [ "START" ];
    this.childCounts = [];
  }
  down() {
    this.childCounts.push( 0 );
  }
  next() {
    const last = this.childCounts.length - 1;
    if ( this.childCounts[ last ] === 0 ) {
      this.arr.push( ".firstChild" );
    } else {
      this.arr.push( ".nextSibling" );
    }
    this.childCounts[ last ]++;
  }
  up() {
    this.arr.length = this.arr.length - this.childCounts.pop();
  }
  clone() {
    const p = new Path();
    p.arr = this.arr.slice();
    p.childCounts = this.childCounts.slice();
    return p;
  }
  toString() {
    return this.arr.join( "" );
  }
}

function traverse( node, visitor, path ) {
  path = path || new Path();
  visitor( node, path );
  if ( node.childNodes ) {
    path.down();
    for ( const child of node.childNodes ) {
      path.next();
      traverse( child, visitor, path );
    }
    path.up();
  }
}

function createUniqueId( vars ) {
  let i = 0;
  let id = "_" + i;
  while ( vars[ id ] ) {
    i++;
    id = "_" + i;
  }
  vars[ id ] = true;
  return id;
}

function pathToString( path, helpers ) {
  return path.toString().replace( /^START/, helpers.instance );
}

function parseExpression( helpers, path, isAttr, name, value ) {

  const parts = parseExpressionTemplate( value );

  if ( parts.length <= 1 ) {
    return;
  }

  return {
    isAttr,
    name,
    parts,
    path: pathToString( path, helpers ),
    js() {

      const parts = this.parts;
      let js = "";

      for ( let i = 0; i < parts.length; i++ ) {
        const part = parts[ i ];

        if ( part ) {
          if ( js ) {
            js += "+";
          }
          if ( i % 2 === 0 ) { // Literal
            js += "'" + part.replace( /'/g, "\\'" ).replace( /\n/g, "\\n" ) + "'";
          } else { // Binding
            js += part;
          }
        }
      }

      return js;
    }
  };
}

function createUpdateStatement( helpers, localVars, isAttr, name, index, js ) { // TODO escape name? to fit into string
  const id = createUniqueId( localVars );
  const nodeId = createUniqueId( localVars );
  const declaration = !name || isAttr ? `var ${id}=${helpers.toString}(${js});` : `var ${id}=${js};`;
  const node = `var ${nodeId}=${helpers.instance}._instances[${index}];`;
  const check = name ?
    ( isAttr ? `${nodeId}.getAttribute('${name}')!==${id}` : `${nodeId}['${name}']!==${id}` ) :
    `${nodeId}.nodeValue!==${id}`;
  const statement = name ?
    ( isAttr ? `if(${id}==null){${nodeId}.removeAttribute('${name}');}else{${nodeId}.setAttribute('${name}',${id});}` : `${nodeId}['${name}']=${id};` ) :
    `${nodeId}.nodeValue=${id};`;
  return `${declaration}${node}if(${check})${statement}`;
}

function validId( id ) {
  return !!id; // TODO
}

function compileTemplate( templateContent, args ) {

  const allExpressions = [];
  const instances = [];
  const statements = [];
  const localVars = args ? Object.assign( Object.create( null ), args ) : Object.create( null );
  const stringArguments = args ? Object.keys( args ).join( "," ) : "";

  const helpers = {
    instance: createUniqueId( localVars ),
    toString: createUniqueId( localVars )
  };

  function getInstanceIdx( pathStr ) {
    const lastIdx = instances.length - 1;
    return lastIdx < 0 || instances[ lastIdx ] !== pathStr ? instances.push( pathStr ) - 1 : lastIdx;
  }

  traverse( templateContent, ( node, path ) => {

    const type = node.nodeName.toLowerCase();
    const attrs = node.attrs || [];

    if ( type === "style" || type === "script" ) {
      return;
    }

    if ( type === "#text" ) {

      allExpressions.push( parseExpression(
        helpers,
        path,
        false,
        undefined,
        node.value,
        node.__location
      ) );

    } else if ( type === "template" ) {

      const propAttr = attrs.find( a => a.name === "prop" );
      const prop = ( propAttr && propAttr.value ) || "render";

      if ( !validId( prop ) ) {
        error( `'${prop}' is not a valid property identifier`, node.__location );
      }

      const argAttr = attrs.find( a => a.name === "args" );
      const templateArgs = argAttr ? argAttr.value.split( "," ).map( s => s.trim() ) : [];
      const newArgs = Object.create( null );

      for ( const a of templateArgs ) {
        if ( a ) {
          if ( !validId( a ) ) {
            error( `'${a}' is not a valid identifier`, node.__location ); // TODO accept ( a, { b, c } )
          }
          newArgs[ a ] = true;
        }
      }

      const parentPath = path.clone();
      parentPath.up();

      const i = getInstanceIdx( pathToString( parentPath, helpers ) );
      const nodeId = createUniqueId( localVars );

      // TODO
      statements.push(
        `var ${nodeId}=${helpers.instance}._instances[${i}];${nodeId}.${prop} = function${compileTemplate( node.content, newArgs )};`
      );

    } else {

      for ( const attr of attrs ) {
        allExpressions.push( parseExpression(
          helpers,
          path,
          /\$$/.test( attr.name ),
          attr.name.replace( /\$$/, "" ),
          attr.value,
          node.__location
        ) );
      }

    }

  } );

  for ( const exp of allExpressions ) {
    if ( exp ) {
      statements.push(
        createUpdateStatement( helpers, localVars, exp.isAttr, exp.name, getInstanceIdx( exp.path ), exp.js() )
      );
    }
  }

  if ( !instances.length ) {
    return "(){}";
  }

  const init = `if(!${helpers.instance}._instances)${helpers.instance}._instances=[${instances.join( "," )}];`; // TODO dedupe

  return `(${helpers.instance},${helpers.toString}${stringArguments ? "," + stringArguments : ""}){${init}${statements.join( "" )}}`;
}

export default compileTemplate;
