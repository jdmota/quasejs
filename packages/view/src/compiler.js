import TreeWalker from "./tree-walker";

const parse5 = require( "parse5" );

/* eslint-disable no-control-regex */
const lastAttrNameRegex =
  /[ \x09\x0a\x0c\x0d]([^\0-\x1F\x7F-\x9F \x09\x0a\x0c\x0d"'>=/]+)[ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*)$/;
const marker = `{{quase-view-${String( Math.random() ).slice( 2 )}}}`;
const nodeMarker = `<!--${marker}-->`;

function findTagClose( str ) {
  const close = str.lastIndexOf( ">" );
  const open = str.indexOf( "<", close + 1 );
  return open > -1 ? str.length : close;
}

function getHtml( strings, svg ) {
  const l = strings.length - 1;
  let html = "";
  let isTextBinding = true;
  for ( let i = 0; i < l; i++ ) {
    const s = strings[ i ];
    html += s;
    // If the previous string closed its tags, we're in a text position.
    // If it doesn't have any tags, then we use the previous text position
    // state.
    const closing = findTagClose( s );
    isTextBinding = closing > -1 ? closing < s.length : isTextBinding;
    html += isTextBinding ? nodeMarker : marker;
  }
  html += strings[ l ];
  return svg ? `<svg>${html}</svg>` : html;
}

const treeAdapter = parse5.treeAdapters.htmlparser2;

const reOn = /^on-/i;

function handleAttr( t, index, attrName, attrNameInPart, strings ) {
  if ( reOn.test( attrName ) ) {
    return t.arrayExpression(
      [
        t.stringLiteral( "event" ),
        t.numericLiteral( index ),
        t.stringLiteral( attrNameInPart.slice( 3 ) )
      ]
    );
  }
  if ( attrNameInPart.endsWith( "$" ) ) {
    return t.arrayExpression(
      [
        t.stringLiteral( "attr" ),
        t.numericLiteral( index ),
        t.stringLiteral( attrNameInPart.slice( 0, -1 ) ),
        t.arrayExpression( strings.map( s => t.stringLiteral( s ) ) )
      ]
    );
  }
  return t.arrayExpression(
    [
      t.stringLiteral( "prop" ),
      t.numericLiteral( index ),
      t.stringLiteral( attrNameInPart ),
      t.arrayExpression( strings.map( s => t.stringLiteral( s ) ) )
    ]
  );
}

function handleNode( t, index ) {
  return t.arrayExpression( [ t.stringLiteral( "node" ), t.numericLiteral( index ) ] );
}

export default function compile( strings, svg, t ) {

  const code = getHtml( strings, svg );
  const doc = parse5.parseFragment( code, { treeAdapter } );
  const parts = [];
  const walker = new TreeWalker( doc );

  let index = 0;
  let partIndex = 0;

  while ( walker.nextNode() ) {
    const node = walker.currentNode;

    if ( treeAdapter.isElementNode( node ) ) {

      for ( const attrName in node.attribs ) {
        const value = node.attribs[ attrName ];
        if ( value.indexOf( marker ) >= 0 ) {
          const attrNameInPart = lastAttrNameRegex.exec( strings[ partIndex ] )[ 1 ];
          const stringsForAttr = value.split( marker );
          delete node.attribs[ attrName ];
          parts.push( handleAttr( t, index, attrName, attrNameInPart, stringsForAttr ) );
          partIndex += stringsForAttr.length - 1;
        }
      }

    } else if ( treeAdapter.isCommentNode( node ) && node.data === marker ) {

      node.data = "{{}}";
      parts.push( handleNode( t, index ) );
      partIndex++;

    }

    index++;
  }

  const html = parse5.serialize( doc, { treeAdapter } );

  return {
    parts,
    html
  };
}

export function babelPlugin( { types: t } ) {
  return {
    visitor: {
      TaggedTemplateExpression( path ) {
        if ( path.node.tag.name !== "html" && path.node.tag.name !== "svg" ) {
          return;
        }
        const quaseViewTemplate = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( "Template" ) );
        const quaseViewTemplateResult = t.memberExpression( t.identifier( "QuaseView" ), t.identifier( "TemplateResult" ) );

        const { parts, html } = compile(
          path.node.quasi.quasis.map( q => q.value.cooked ),
          path.node.tag.name === "svg",
          t
        );

        path.replaceWith(
          t.newExpression(
            quaseViewTemplateResult,
            [
              t.newExpression(
                quaseViewTemplate,
                [ t.arrayExpression( parts ), t.stringLiteral( html ) ]
              ),
              t.arrayExpression( path.node.quasi.expressions )
            ]
          )
        );
      }
    }
  };
}
