import { execa } from "execa";
import { Options } from "./types";

async function listAllFiles(): Promise<string[]> {
  const { stdout } = await execa("git", ["ls-files"]);
  return stdout.trim().split("\n");
}

async function changedFiles() {
  const [firstOutput, secondOutput] = await Promise.all([
    execa("git", ["diff", "--name-status", `--diff-filter=AMCD`]),
    // Get status especially for added files
    execa("git", ["status", "--porcelain"]),
  ]);

  const data = `${firstOutput.stdout}\n${secondOutput.stdout}`;
  const list = data
    .trim()
    .split("\n")
    .filter(filename => filename.length)
    .map(line => line.trim().split(/\s+/)[1]);

  return list;
}

export default async function (options: Options) {
  const job1 = options.all ? listAllFiles() : ([] as string[]);
  const job2 = changedFiles();
  const list = (await job1).concat(await job2);
  return Array.from(new Set(list));
}
