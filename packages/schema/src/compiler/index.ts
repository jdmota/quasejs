// @ts-ignore
import Parser from "../parser";
import { Schema } from "./common";
import { Compiler } from "./validate-merge";
import { CliCompiler } from "./yarn-opts";

export default function schemaCompiler( text: string ) {
  const ast = new Parser( text ).parse() as Schema;
  return `/* eslint-disable */({
    validateAndMerge: ${new Compiler().start( ast )},
    cli: ${new CliCompiler().start( ast )}
  })`;
}
