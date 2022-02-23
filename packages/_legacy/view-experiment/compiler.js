import compileTemplate from "./template-compiler";
import { error, findIn, findAll } from "./utils";

const parse5 = require( "parse5" );
const babylon = require( "babylon" );
const generate = require( "babel-generator" ).default;

function findClassDeclarations( out, ast ) {
  if ( ast != null && typeof ast === "object" ) {
    if ( ast.type === "ClassDeclaration" ) {
      out.push( ast );
    } else {
      for ( const prop in ast ) {
        const value = ast[ prop ];
        if ( Array.isArray( value ) ) {
          for ( let i = 0; i < value.length; i++ ) {
            findClassDeclarations( out, value[ i ] );
          }
        } else {
          findClassDeclarations( out, value );
        }
      }
    }
  }
  return out;
}

function compileModule( module ) {

  const templates = findIn( module, node => node.nodeName === "template" );

  if ( templates.length === 0 ) {
    error( "No templates", module.__location );
  }

  if ( templates.length > 1 ) {
    error( "Only 1 template per module is supported", module.__location );
  }

  const scripts = findIn( module, node => node.nodeName === "script" );

  if ( scripts.length === 0 ) {
    error( "No script tag was found", module.__location );
  }

  let foundClass = false;

  const render = `_render${compileTemplate( templates[ 0 ].content )}`;

  scripts.forEach( script => {

    const text = script.childNodes[ 0 ];

    if ( text && text.nodeName === "#text" ) {

      let ast;

      try {
        ast = babylon.parse( text.value ).program;
      } catch ( e ) {
        error( e + "", text.__location );
      }

      const classDeclarations = findClassDeclarations( [], ast ).filter(
        ( { superClass } ) => superClass.type === "Identifier" && superClass.name === "QuaseView"
      );

      if ( classDeclarations.length === 0 ) {
        return;
      }

      if ( foundClass || classDeclarations.length > 1 ) {
        error( "Only 1 class declaration that extends QuaseView is allowed", text.__location );
      }

      foundClass = true;

      // Add _render() method
      const clazz = classDeclarations[ 0 ];
      const method = babylon.parse( `class abc{${render}}` ).program.body[ 0 ].body.body[ 0 ];
      clazz.body.body.push( method );

      text.value = generate( ast ).code;

    }

  } );

  if ( !foundClass ) {
    error( "No class declaration that extends QuaseView was found", module.__location );
  }

}

export default function compile( html ) {

  const doc = parse5.parse( html.toString(), {
    locationInfo: true
  } );

  findAll( doc, node => node.nodeName === "quase-view" ).forEach( compileModule );

  return parse5.serialize( doc );
}
