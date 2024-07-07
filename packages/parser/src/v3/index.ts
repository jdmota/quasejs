import { parse } from "@babel/parser";
import type {
  Statement,
  Expression,
  BlockStatement,
  Program,
  IfStatement,
} from "@babel/types";
import { never } from "../../../util/miscellaneous";

class CFGNode<Code, Decision> {
  readonly code: Code;
  readonly inEdges: Set<CFGEdge<Code, Decision>>;
  readonly outEdges: Set<CFGEdge<Code, Decision>>;

  constructor(code: Code) {
    this.code = code;
    this.inEdges = new Set();
    this.outEdges = new Set();
  }
}

class CFGEdge<Code, Decision> {
  readonly start: CFGNode<Code, Decision>;
  readonly decision: Decision;
  readonly dest: CFGNode<Code, Decision>;

  constructor(
    start: CFGNode<Code, Decision>,
    decision: Decision,
    dest: CFGNode<Code, Decision>
  ) {
    this.start = start;
    this.decision = decision;
    this.dest = dest;
  }

  connect() {
    this.start.outEdges.add(this);
    this.dest.inEdges.add(this);
  }
}

// Inspiration https://github.com/julianjensen/ast-flow-graph/blob/master/src/visitors.js

function flatBlock(block: Program | BlockStatement): readonly Statement[] {
  return block.body.flatMap(s =>
    s.type === "BlockStatement" ? flatBlock(s) : s
  );
}

function astToCfg(code: string) {
  const ast = parse(code, { allowReturnOutsideFunction: true });
  const program = ast.program as Program;
  new JSAstToCfg().Program(program);
}

type Pair = [CFGNode<Expression, any>, CFGNode<Expression, any>];

class JSAstToCfg {
  statementSequence(seq: readonly Statement[]) {
    return seq
      .map(s => this.Statement(s))
      .reduce(([accStart, accEnd], [nodeStart, nodeEnd]) => {
        new CFGEdge(accEnd, null, nodeStart).connect();
        return [accStart, nodeEnd];
      });
  }

  BlockStatement(block: BlockStatement) {
    return this.statementSequence(flatBlock(block));
  }

  Program(program: Program) {
    return this.statementSequence(flatBlock(program));
  }

  Expression(expr: Expression): Pair {
    const node = new CFGNode(expr);
    return [node, node];
  }

  IfStatement(statement: IfStatement): Pair {}

  Statement(statement: Statement): Pair {
    switch (statement.type) {
      case "BlockStatement":
        return this.BlockStatement(statement);
      case "ExpressionStatement":
        return this.Expression(statement.expression);
      case "IfStatement":
        return this.IfStatement(statement);
      default:
        never(statement);
    }
  }
}
