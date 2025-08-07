import { prettifyPath } from "../../util/path-url";
import { run } from "..";
import type { FileReport } from "../types";

function cleanReport(report: FileReport): FileReport {
  return {
    ...report,
    filename: prettifyPath(report.filename),
  };
}

it("banned files", async () => {
  const results = [];

  for await (const report of run({
    folder: "packages/ban-sensitive-files",
    all: true,
    verbose: true,
  })) {
    if (report.kind !== "ok") {
      results.push(cleanReport(report));
    }
  }

  expect(results).toMatchSnapshot();
});
