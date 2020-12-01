import { DState } from "../automaton/state";
import { DFA } from "../optimizer/abstract-optimizer";

function genAutomaton({ states, start, acceptingSet }: DFA<DState>): string {
  let code = "";

  // Optimize the initial states that are always reached
  let initialState = states[1];
  const ignore = new Set();
  ignore.add(states[0]);

  while (
    ((initialState.id === 1 && initialState.inTransitions === 0) ||
      (initialState.id > 1 && initialState.inTransitions === 1)) &&
    initialState.transitionAmount() === 1 &&
    !acceptingSet.has(initialState)
  ) {
    ignore.add(initialState);

    const [transition, dest] = getFirst(initialState);
    code += genTransition(transition);
    initialState = dest;
  }

  // Generate each state
  const cases = [];
  for (const state of states) {
    if (ignore.has(state)) {
      continue;
    }
    cases.push({
      state,
      body: genStateManyTransitions(state, rule),
    });
  }

  if (cases.length === 1) {
    const { body } = cases[0];

    if (body.replace(/\n|\s/g, "") !== "{$$loop=false;}") {
      code += `let $$state=${initialState.id},$$loop=true;`;
      code += `while($$loop){\n`;
      code += body;
      code += `}`;
    }
  } else {
    code += `let $$state=${initialState.id},$$loop=true;`;
    code += `while($$loop){switch($$state){\n`;

    for (const { state, body } of cases) {
      code += `case ${state.id}:\n`;
      code += body;
      code += `break;\n`;
    }

    code += `}`;
    code += `}`;
  }

  return code;
}

export function generateTokenizer(automaton: DFA<DState>) {
  return `
    const newLineRe = /\\r\\n?|\\n/g;

    function readToken(prevPos, prevLineStart, prevCurrLine) {
      let pos = prevPos;
      let lineStart = prevLineStart;
      let currLine = prevCurrLine;
      let id = -1;

      ${genAutomaton(automaton)}

      if (id===-1) {
        throw this.unexpected();
      }

      const image=this.input.slice(prevPos,pos);
      const splitted=image.split(newLineRe);
      const newLines=splitted.length-1;
      if (newLines>0) {
        lineStart=pos-splitted[newLines].length;
        currLine+=newLines;
      }
      return {
        token: {
          id,
          label: this.labels[id],
          image
        },
        state: {
          pos,
          lineStart,
          currLine
        }
      };
    }
  `;
}
