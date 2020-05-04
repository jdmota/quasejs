import fs from "fs";
import path from "path";
import makeDir from "make-dir";
import tool from "./tool";

/* eslint no-console: 0 */
export default function (args: string[]) {
  if (args.length !== 2) {
    console.error("Usage: quase-parser-generator <grammar file> <output>");
    return;
  }

  const grammarFile = path.resolve(args[0]);
  const outputFile = path.resolve(args[1]);

  const grammarText = fs.readFileSync(grammarFile, "utf8");

  const options = {
    typescript: path.extname(outputFile) === ".ts",
  };

  const { code, conflicts } = tool(grammarText, options);

  for (const conflict of conflicts) {
    console.log(conflict);
  }

  makeDir.sync(path.dirname(outputFile));
  fs.writeFileSync(outputFile, code);
  console.log("Done!");
}
