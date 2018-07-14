import jsx from "@babel/plugin-syntax-jsx";
import {
  PART_ATTR, PART_PROP, PART_EVENT, PART_NODE,
  TEMPLATE, TEMPLATE_RESULT
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
  children: ( JSXElement | JSXText | JSXExpressionContainer )[]
};
*/

const escapeHTML = require( "he" ).encode;
const reOn = /^on[A-Z]/;

function handleAttr( t, index, attrName ) {
  if ( reOn.test( attrName ) ) {
    return t.arrayExpression( [
      t.numericLiteral( PART_EVENT ),
      t.numericLiteral( index ),
      t.stringLiteral( attrName.slice( 2 ).toLowerCase() )
    ] );
  }
  if ( attrName.endsWith( "$" ) ) {
    return t.arrayExpression( [
      t.numericLiteral( PART_ATTR ),
      t.numericLiteral( index ),
      t.stringLiteral( attrName.slice( 0, -1 ) )
    ] );
  }
  return t.arrayExpression( [
    t.numericLiteral( PART_PROP ),
    t.numericLiteral( index ),
    t.stringLiteral( attrName )
  ] );
}

function handleNode( t, index ) {
  return t.arrayExpression( [
    t.numericLiteral( PART_NODE ),
    t.numericLiteral( index )
  ] );
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
            result.parts.push( handleAttr( t, result.index, name ) );
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
        result.html.push( "<!--{{}}-->" );
        result.parts.push( handleNode( t, result.index ) );
        result.expressions.push( expression );
        result.index++;
    }
  }
};

export default function( { types: t } ) {
  return {
    inherits: jsx,
    visitor: {
      JSXElement( path ) {

        const { node } = path;

        const quaseViewTemplate = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( TEMPLATE ) );
        const quaseViewTemplateResult = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( TEMPLATE_RESULT ) );

        const result = {
          html: [],
          parts: [],
          expressions: [],
          index: 0
        };

        visitor.JSXElement( result, t, node );

        path.replaceWith(
          t.newExpression(
            quaseViewTemplateResult,
            [
              t.newExpression(
                quaseViewTemplate,
                [ t.arrayExpression( result.parts ), t.stringLiteral( result.html.join( "" ) ) ]
              ),
              t.arrayExpression( result.expressions )
            ]
          )
        );

      }
    }
  };
}
