import jsx from "@babel/plugin-syntax-jsx";
import {
  PART_ATTR, PART_PROP, PART_EVENT, PART_NODE,
  TEMPLATE, TEMPLATE_RESULT,
  partValue
} from "./spec";

/*
type Expression = {
  [key: string]: any
};

type StringLiteral = {
  value: string,
  extra: {
    rawValue: string,
    raw: string
  }
};

type JSXEmptyExpression = {};

type JSXText = {
  value: string,
  extra: {
    rawValue: string,
    raw: string
  }
};

type JSXExpressionContainer = {
  expression: JSXEmptyExpression | Expression
};

type JSXAttribute = {
  name: JSXIdentifier,
  value: StringLiteral | JSXExpressionContainer
};

type JSXOpeningElement = {
  name: JSXIdentifier,
  attributes: JSXAttribute[],
  selfClosing: boolean
};

type JSXElement = {
  openingElement: JSXOpeningElement,
  children: JSXChildren[]
};

type JSXFragment = {
  children: JSXChildren[]
};

type JSXChildren = JSXElement | JSXFragment | JSXText | JSXExpressionContainer;
*/

const escapeHTML = require( "he" ).encode;
const reOn = /^on[A-Z]/;

function handleAttr( result, t, attrName ) {
  let type;
  let string;
  if ( reOn.test( attrName ) ) {
    type = PART_EVENT;
    string = attrName.slice( 2 ).toLowerCase();
  } else if ( attrName.endsWith( "$" ) ) {
    type = PART_ATTR;
    string = attrName.slice( 0, -1 );
  } else {
    type = PART_PROP;
    string = attrName;
  }
  result.parts.push( t.numericLiteral( partValue( result.index, type ) ) );
  result.strings.push( t.stringLiteral( string ) );
}

function handleNode( result, t ) {
  result.parts.push(
    t.numericLiteral( partValue( result.index, PART_NODE ) )
  );
}

const visitor = {
  JSXElement( result, t, { openingElement, children } ) {

    if ( openingElement.selfClosing ) {
      result.html.push( `<${openingElement.name.name}` );
    } else {
      result.html.push( `<${openingElement.name.name}>` );
    }

    for ( const attr of openingElement.attributes ) {
      visitor.JSXAttribute( result, t, attr );
    }

    result.index++;

    if ( openingElement.selfClosing ) {
      result.html.push( `/>` );
    } else {

      for ( const child of children ) {
        switch ( child.type ) {
          case "JSXElement":
            visitor.JSXElement( result, t, child );
            break;
          case "JSXFragment":
            visitor.JSXFragment( result, t, child );
            break;
          case "JSXText":
            result.html.push( escapeHTML( child.value ) );
            break;
          case "JSXExpressionContainer":
            visitor.JSXExpressionContainer( result, t, child );
            break;
          default:
            throw new Error( `Unknown child of type ${child.type}` );
        }
      }

      result.html.push( `</${openingElement.name.name}>` );
    }

  },
  JSXFragment( result, t, { children } ) {

    for ( const child of children ) {
      switch ( child.type ) {
        case "JSXElement":
          visitor.JSXElement( result, t, child );
          break;
        case "JSXFragment":
          visitor.JSXFragment( result, t, child );
          break;
        case "JSXText":
          result.html.push( escapeHTML( child.value ) );
          break;
        case "JSXExpressionContainer":
          visitor.JSXExpressionContainer( result, t, child );
          break;
        default:
          throw new Error( `Unknown child of type ${child.type}` );
      }
    }

  },
  JSXAttribute( result, t, { name: { name }, value } ) {
    switch ( value.type ) {
      case "StringLiteral":
        result.html.push( `${name}="${escapeHTML( value.value )}"` );
        break;
      case "JSXExpressionContainer": {
        const { expression } = value;
        switch ( expression.type ) {
          case "JSXEmptyExpression":
            throw new Error( `Cannot use JSXEmptyExpression in JSXAttribute` );
          case "StringLiteral":
            result.html.push( `${name}="${escapeHTML( expression.value )}"` );
            break;
          default:
            handleAttr( result, t, name );
            result.expressions.push( expression );
        }
        break;
      }
      default:
        throw new Error( `Unknown attr value of type ${value.type}` );
    }
  },
  JSXExpressionContainer( result, t, { expression } ) {
    switch ( expression.type ) {
      case "JSXEmptyExpression":
        break;
      case "StringLiteral":
        result.html.push( escapeHTML( expression.value ) );
        break;
      default:
        handleNode( result, t );
        result.html.push( "<!---->" );
        result.expressions.push( expression );
        result.index++;
    }
  }
};

function mainVisitor( t, fn, path ) {

  const { node } = path;

  const quaseViewTemplate = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( TEMPLATE ) );
  const quaseViewTemplateResult = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( TEMPLATE_RESULT ) );

  const result = {
    html: [],
    parts: [],
    strings: [],
    expressions: [],
    index: 0
  };

  fn( result, t, node );

  const program = path.scope.getProgramParent().path;

  const templateUID = program.scope.generateUidIdentifier( "render" );

  const templateDeclaration = t.variableDeclaration( "const", [
    t.variableDeclarator(
      templateUID,
      t.newExpression(
        quaseViewTemplate,
        [
          t.arrayExpression( result.parts ),
          t.arrayExpression( result.strings ),
          t.stringLiteral( result.html.join( "" ) )
        ]
      )
    )
  ] );

  program.unshiftContainer( "body", templateDeclaration );

  path.replaceWith(
    t.newExpression(
      quaseViewTemplateResult,
      [
        templateUID,
        t.arrayExpression( result.expressions )
      ]
    )
  );

}

export default function( { types: t } ) {
  return {
    inherits: jsx,
    visitor: {
      JSXElement: path => mainVisitor( t, visitor.JSXElement, path ),
      JSXFragment: path => mainVisitor( t, visitor.JSXFragment, path )
    }
  };
}
