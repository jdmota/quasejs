import createAutomaton from "./create-automaton";
import { nfaToDfa, minimize } from "./minimize-automaton";
import Grammar from "../grammar";

function lexer( grammar: Grammar ) {
  const nfa = createAutomaton( grammar );
  const dfa = nfaToDfa( nfa );
  const { states } = minimize( dfa );

  const { nodeToId, transitionToNode } = nfa;
  const labels = [];
  const finals: { [key: number]: number } = {};

  let serialized = "[null,";

  // Ignore last state. It has no useful info.
  for ( let state = 1; state < states.length - 1; state++ ) {

    serialized += `${state === 1 ? "" : ","}c=>`;

    for ( const [ range, to ] of states[ state ] ) {
      if ( range.from < 0 ) {
        const node = transitionToNode.get( range.from );
        if ( node == null ) {
          throw new Error( "Assertion error" );
        }

        const id = nodeToId.get( node ) as number;
        const label = node.type === "LexerRule" ? node.name : node.raw;
        labels[ id ] = label;

        if ( state === 1 ) {
          throw new Error( `${label} is allowing for empty tokens` );
        }

        if ( finals[ state ] == null ) {
          finals[ state ] = id;
        } else {
          if ( finals[ state ] > id ) {
            finals[ state ] = id;
          }
        }
      } else if ( range.from === range.to ) {
        serialized += `c==${range.from}?${to}:`;
      } else {
        serialized += `${range.from}<=c&&c<=${range.to}?${to}:`;
      }
    }

    serialized += "0";
  }

  serialized += "]";

  return {
    serialized,
    finals,
    labels
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt
// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
const readToken = `
codePointAt(index) {
  const first = this.input.charCodeAt(index);
  const size = this.input.length;
  if (
    first >= 0xD800 && first <= 0xDBFF &&
    size > index + 1
  ) {
    const second = this.input.charCodeAt(index + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) {
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
    }
  }
  return first;
}

readToken() {
  const { input, table, finals, labels } = this;
  const length = input.length;
  const prevPos = this.pos;

  let state = 1;
  let i = this.pos;

  while ( i < length ) {
    const char = this.codePointAt( i );
    const nextState = table[ state ]( char );
    if ( nextState ) {
      state = nextState;
      if ( char > 0xffff ) {
        i += 2;
      } else {
        i++;
      }
    } else {
      break;
    }
  }

  const id = finals[state];
  if ( id == null ) {
    this.unexpectedChar();
  }
  const image=input.slice(prevPos,i);
  const splitted=image.split(${/\r\n?|\n/g.toString()});
  const newLines=splitted.length-1;
  this.pos=i;
  if (newLines>0) {
    this._lineStart=this.pos-splitted[newLines].length;
    this._curLine+=newLines;
  }
  return {
    label: id,
    labelText: this.labels[id],
    image
  };
}`;

export default function( grammar: Grammar ) {
  const { serialized, finals, labels } = lexer( grammar );

  return `
  class Tokenizer extends Q.Tokenizer{
    constructor(input){
      super(input);
      this.table=${serialized};
      this.finals=${JSON.stringify( finals )};
      this.labels=${JSON.stringify( labels )};
    }
    initial(){return{label:"initial"};}
    eof(){return{label:"eof"};}
    ${readToken}
  }`;
}
