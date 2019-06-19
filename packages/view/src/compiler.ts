// @ts-ignore
import jsx from "@babel/plugin-syntax-jsx";
import {
  PART_ATTR, PART_PROP, PART_EVENT, PART_NODE,
  TEMPLATE, TEMPLATE_RESULT,
  partValue
} from "./spec";

type BabelTypes = any;
type BabelPath = any;

type Expression = {
  type: "unknown";
  [key: string]: unknown;
};

type NumericLiteral = {
  type: "NumericLiteral";
  value: number;
};

type StringLiteral = {
  type: "StringLiteral";
  value: string;
  extra: {
    rawValue: string;
    raw: string;
  };
};

type JSXEmptyExpression = {
  type: "JSXEmptyExpression";
};

type JSXIdentifier = {
  type: "JSXIdentifier";
  name: string;
};

type JSXText = {
  type: "JSXText";
  value: string;
  extra: {
    rawValue: string;
    raw: string;
  };
};

type JSXExpressionContainer = {
  type: "JSXExpressionContainer";
  expression: JSXEmptyExpression | StringLiteral | Expression;
};

type JSXAttribute = {
  type: "JSXAttribute";
  name: JSXIdentifier;
  value: StringLiteral | JSXExpressionContainer;
};

type JSXOpeningElement = {
  type: "JSXOpeningElement";
  name: JSXIdentifier;
  attributes: JSXAttribute[];
  selfClosing: boolean;
};

type JSXElement = {
  type: "JSXElement";
  openingElement: JSXOpeningElement;
  children: JSXChildren[];
};

type JSXFragment = {
  type: "JSXFragment";
  children: JSXChildren[];
};

type JSXChildren = JSXElement | JSXFragment | JSXText | JSXExpressionContainer;

const escapeHTML = require( "he" ).encode;
const reOn = /^on[A-Z]/;

function handleAttr( result: Result, t: BabelTypes, firstAttr: boolean, attrName: string ) {
  let type: number;
  let string: string;
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
  result.parts.push( t.numericLiteral( partValue( firstAttr, type ) ) );
  result.strings.push( t.stringLiteral( string ) );
}

function handleNode( result: Result, t: BabelTypes ) {
  result.parts.push(
    t.numericLiteral( partValue( true, PART_NODE ) )
  );
}

const visitor = {
  JSXElement( result: Result, t: BabelTypes, { openingElement, children }: JSXElement ) {
    const hasParts = visitor.hasAttrParts( openingElement );
    if ( hasParts ) {
      result.html.push( `<!---->` );
    }

    if ( openingElement.selfClosing ) {
      result.html.push( `<${openingElement.name.name}` );
    } else {
      result.html.push( `<${openingElement.name.name}>` );
    }

    let firstAttr = true;
    for ( const attr of openingElement.attributes ) {
      visitor.JSXAttribute( result, t, attr, firstAttr );
      firstAttr = false;
    }

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
            throw new Error( `Unknown child of type ${( child as any ).type}` );
        }
      }

      result.html.push( `</${openingElement.name.name}>` );
    }

  },
  JSXFragment( result: Result, t: BabelTypes, { children }: JSXFragment ) {

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
          throw new Error( `Unknown child of type ${( child as any ).type}` );
      }
    }

  },
  hasAttrParts( openingElement: JSXOpeningElement ) {
    for ( const { value } of openingElement.attributes ) {
      switch ( value.type ) {
        case "StringLiteral":
          break;
        case "JSXExpressionContainer": {
          const { expression } = value;
          switch ( expression.type ) {
            case "JSXEmptyExpression":
              throw new Error( `Cannot use JSXEmptyExpression in JSXAttribute` );
            case "StringLiteral":
              break;
            default:
              return true;
          }
          break;
        }
        default:
          throw new Error( `Unknown attr value of type ${( value as any ).type}` );
      }
    }
    return false;
  },
  JSXAttribute( result: Result, t: BabelTypes, { name: { name }, value }: JSXAttribute, firstAttr: boolean ) {
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
            handleAttr( result, t, firstAttr, name );
            result.expressions.push( expression );
        }
        break;
      }
      default:
        throw new Error( `Unknown attr value of type ${( value as any ).type}` );
    }
  },
  JSXExpressionContainer( result: Result, t: BabelTypes, { expression }: JSXExpressionContainer ) {
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
    }
  }
};

type Result = {
  html: string[];
  parts: NumericLiteral[];
  strings: StringLiteral[];
  expressions: Expression[];
};

type Fn =
  ( ( r: Result, t: BabelTypes, n: JSXElement ) => void ) |
  ( ( r: Result, t: BabelTypes, n: JSXFragment ) => void );

function mainVisitor(
  t: BabelTypes,
  fn: Fn,
  path: BabelPath
) {

  const { node } = path;

  const quaseViewTemplate = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( TEMPLATE ) );
  const quaseViewTemplateResult = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( TEMPLATE_RESULT ) );

  const result: Result = {
    html: [],
    parts: [],
    strings: [],
    expressions: []
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

export default function( { types: t }: { types: BabelTypes } ) {
  return {
    inherits: jsx,
    visitor: {
      JSXElement: ( path: BabelPath ) => mainVisitor( t, visitor.JSXElement, path ),
      JSXFragment: ( path: BabelPath ) => mainVisitor( t, visitor.JSXFragment, path )
    }
  };
}
