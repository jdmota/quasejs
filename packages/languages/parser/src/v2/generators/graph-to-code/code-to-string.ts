import { never } from "../../utils";
import { CodeBlock } from "./cfg-to-code";

export class CodeToString {
  render(indent: string, block: CodeBlock) {
    switch (block.type) {
      case "expect_block":
        return `expect(${block.transition});`;
      case "seq_block":
        return block.blocks.map(b => this.render(indent, b)).join("\n");
      case "switch_block":
        return [
          `${indent}switch(current()){`,
          ...block.choices.map(
            ([t, d]) =>
              `${indent}  case ${t}:\n${this.render(`${indent}    `, d)}`
          ),
          `${indent}  default:\n${indent}    unexpected();`,
          `${indent}}`,
        ].join("\n");
      case "scope_block":
        return [
          `${indent}${block.label}:do{`,
          this.render(indent + "  ", block.block),
          `${indent}}while(0);`,
        ].join("\n");
      case "loop_block":
        return [
          `${indent}${block.label}:while(1){`,
          this.render(indent + "  ", block.block),
          `${indent}}`,
        ].join("\n");
      case "continue_block":
        return `${indent}continue ${block.label};`;
      case "break_case_block":
        return `${indent}break;`;
      case "break_scope_block":
        return `${indent}break ${block.label};`;
      case "empty_block":
        return "";
      default:
        never(block);
    }
  }
}
