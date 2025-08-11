import fs from "fs";
import path from "path";
import ora, { type Ora } from "ora";
import slash from "slash";
import {
  checkDirty,
  checkStashes,
  checkSubmodules,
  checkUnpushed,
  getDotGitDir,
} from "../git/git";

// Inspired in https://github.com/brandon-rhodes/uncommitted/blob/master/uncommitted/command.py

function joinLines(lines: readonly string[]): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + "\n";
}

export class GatherFiles {
  private readonly cwd: string;
  private spinner: Ora;
  private foundUntracked: boolean;
  private interrupt: boolean;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.spinner = ora();
    this.spinner.prefixText = "";
    this.foundUntracked = false;

    this.interrupt = false;
    process.once("SIGINT", () => {
      console.log("Interrupting...");
      this.interrupt = true;
    });
  }

  private async checkGit(absoluteFolder: string, relativeFolder: string) {
    if (this.interrupt) return;
    const dirty = await checkDirty(absoluteFolder, {
      untrackedFiles: "normal",
      showIgnored: true,
    });

    if (this.interrupt) return;
    const unpushed = await checkUnpushed(absoluteFolder);

    if (this.interrupt) return;
    const stashes = await checkStashes(absoluteFolder);

    if (this.interrupt) return;
    const submodules = await checkSubmodules(absoluteFolder);
    // TODO deal with submodules

    if (
      dirty.length ||
      unpushed.length ||
      stashes.length ||
      submodules.length
    ) {
      this.foundUntracked = true;
    }

    this.spinner.prefixText +=
      joinLines(dirty.map(d => d.path)) +
      joinLines(unpushed) +
      joinLines(stashes) +
      joinLines(submodules);
  }

  private async checkNonGit(absoluteFolder: string, relativeFolder: string) {
    if (this.interrupt) return;
    const dir = await fs.promises.opendir(absoluteFolder);

    for await (const dirent of dir) {
      if (this.interrupt) return;

      const absolute = path.join(absoluteFolder, dirent.name);
      const relative = relativeFolder + "/" + dirent.name;
      if (dirent.isDirectory()) {
        await this.check(absolute, relative, false);
      } else {
        this.spinner.prefixText += `${relative}\n`;
        this.foundUntracked = true;
      }
    }
  }

  private async check(
    absoluteFolder: string,
    relativeFolder: string,
    recursive: boolean
  ) {
    this.spinner.text = `Checking: ${relativeFolder}\n`;

    const gitDir = await getDotGitDir(absoluteFolder);

    if (gitDir) {
      await this.checkGit(absoluteFolder, relativeFolder);
    } else if (recursive) {
      await this.checkNonGit(absoluteFolder, relativeFolder);
    } else {
      this.spinner.prefixText += `${relativeFolder}/\n`;
      this.foundUntracked = true;
    }
  }

  async analyze(folders: readonly string[]) {
    this.spinner.start();

    for (const folder of folders) {
      const absolute = path.resolve(this.cwd, folder);
      const relative = slash(path.relative(this.cwd, absolute)) || ".";
      await this.check(absolute, relative, true);
    }

    this.spinner.prefixText += "\n";

    if (this.interrupt) {
      this.spinner.fail(`Interrupted`);
    } else if (this.foundUntracked) {
      this.spinner.fail(`Found untracked files or unpushed changes`);
    } else {
      this.spinner.succeed(`No untracked files!`);
    }
  }
}

export async function bin() {
  console.log();

  const folders = process.argv.slice(2);
  if (folders.length === 0) {
    folders.push(".");
  }

  await new GatherFiles(process.cwd()).analyze(folders);
}

if (import.meta.main) {
  bin();
}
