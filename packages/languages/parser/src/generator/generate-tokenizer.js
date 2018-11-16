import regexpsToAutomaton from "./regexps-to-automaton";
import { nfaToDfa, minimize } from "./minimize-automaton";

function lexer( terminals ) {
  const spec = Object.entries( terminals ).map(
    ( [ label, re ] ) => ( { label, regexp: typeof re === "string" ? new RegExp( re ) : re } )
  );

  const nfa = regexpsToAutomaton( spec );
  const dfa = nfaToDfa( nfa );
  const { table } = minimize( dfa );

  const finals = {};
  for ( let state = 1; state < table.length; state++ ) {
    for ( const symbol of Object.keys( table[ state ] ) ) {
      if ( symbol.length > 1 && symbol[ 0 ] === "_" ) {
        const label = symbol.slice( 1 );

        if ( state === 1 ) {
          throw new Error( `The regular expression for ${label} is allowing for empty tokens` );
        }

        delete table[ state ][ symbol ];
        if ( finals[ state ] ) {
          if ( nfa.labelToOrder.get( finals[ state ] ) > nfa.labelToOrder.get( label ) ) {
            finals[ state ] = label;
          }
        } else {
          finals[ state ] = label;
        }
      }
    }
  }

  // Remove last state (which as no useful info)
  table.pop();

  return {
    table,
    finals
  };
}

const readToken = `readToken() {
  const { input, table, finals } = this;
  const length = input.length;
  const prevPos = this.pos;

  let state = 1;
  let i = this.pos;

  while ( i < length ) {
    const char = input.charCodeAt( i );
    const nextState = table[ state ][ char ];
    if ( nextState ) {
      state = nextState;
      i++;
    } else {
      break;
    }
  }

  const label = finals[ state ];
  if ( label ) {
    const image=input.slice(prevPos,i);
    const splitted=image.split(${/\r\n?|\n/g.toString()});
    const newLines=splitted.length-1;
    this.pos=i;
    if (newLines>0) {
      this._lineStart=this.pos-splitted[newLines].length;
      this._curLine+=newLines;
    }
    return {
      label,
      image
    };
  }
  return this.unexpectedChar();
}`;

export const reservedLabels = new Set( [ "initial", "eof" ] );

export default function( terminals ) {
  const { table, finals } = lexer( terminals );

  return `
  class Tokenizer extends Q.Tokenizer{
    constructor(input){
      super(input);
      this.table=${JSON.stringify( table )};
      this.finals=${JSON.stringify( finals )};
    }
    initial(){return{label:"initial"};}
    eof(){return{label:"eof"};}
    ${readToken}
  }`;
}
