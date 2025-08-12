import fs from "fs";
import path from "path";
import ora, { type Ora } from "ora";
import { Logger, LoggerVerboseLevel } from "../util/logger";
import { prettifyPath } from "../util/path-url";
import { timestamp } from "../util/tmp";
import {
  checkDirty,
  checkStashes,
  checkSubmodules,
  checkUnpushed,
  getDotGitDir,
} from "../git/git";

// Inspired in https://github.com/brandon-rhodes/uncommitted/blob/master/uncommitted/command.py

const DEFAULT_GIT_DIRTY_IGNORE: ReadonlySet<string> = new Set([
  ".yarn/build-state.yml",
  ".yarn/install-state.gz",
  ".yarn/unplugged/",
  ".yarn/sdks/",
  "node_modules/",
]);

export class GatherFiles {
  public readonly logger: Logger;
  private spinner: Ora;
  private foundUntracked: boolean;
  private interrupted: boolean;

  constructor(
    private readonly cwd: string,
    private readonly gitDirtyIgnore: ReadonlySet<string>
  ) {
    this.logger = new Logger("", {
      colors: false,
      streams: [],
      renderPrefix: () => "",
    });
    this.spinner = ora();
    this.foundUntracked = false;
    this.interrupted = false;
  }

  interrupt() {
    this.interrupted = true;
  }

  private async checkGit(gitDir: string) {
    if (this.interrupted) return;

    const absoluteFolder = path.resolve(gitDir, "..");

    const dirty = (
      await checkDirty(absoluteFolder, {
        untrackedFiles: "normal",
        showIgnored: true,
      })
    ).filter(p => !this.gitDirtyIgnore.has(p.path));

    if (this.interrupted) return;
    const unpushed = await checkUnpushed(absoluteFolder);

    if (this.interrupted) return;
    const stashes = await checkStashes(absoluteFolder);

    if (this.interrupted) return;
    const submodules = await checkSubmodules(absoluteFolder);
    // TODO deal with submodules

    if (
      dirty.length ||
      unpushed.length ||
      stashes.length ||
      submodules.length
    ) {
      this.foundUntracked = true;

      this.logger.info(`Git folder: ${prettifyPath(absoluteFolder)}`);

      for (const { path } of dirty) {
        this.logger.info(`  ${path}`);
      }

      for (const path of unpushed) {
        this.logger.info(`  ${path}`);
      }

      for (const path of stashes) {
        this.logger.info(`  ${path}`);
      }

      for (const path of submodules) {
        this.logger.info(`  ${path}`);
      }
    }
  }

  private async checkNonGit(absoluteFolder: string) {
    if (this.interrupted) return;
    const dir = await fs.promises.opendir(absoluteFolder);

    for await (const dirent of dir) {
      if (this.interrupted) return;

      const absolute = path.join(absoluteFolder, dirent.name);
      if (dirent.isDirectory()) {
        await this.check(absolute, false);
      } else {
        this.foundUntracked = true;
        this.logger.info(`File: ${prettifyPath(absolute)}`);
      }
    }
  }

  private async check(absoluteFolder: string, recursive: boolean) {
    this.spinner.text = `Checking: ${prettifyPath(absoluteFolder)}\n`;

    const gitDir = await getDotGitDir(absoluteFolder);

    if (gitDir) {
      await this.checkGit(gitDir);
    } else if (recursive) {
      await this.checkNonGit(absoluteFolder);
    } else {
      this.foundUntracked = true;
      this.logger.info(`Non-git folder: ${prettifyPath(absoluteFolder)}`);
    }
  }

  async analyze(folders: readonly string[]) {
    this.spinner.start();

    this.logger.info(`CWD: ${this.cwd}`);

    for (const folder of folders) {
      const absolute = path.resolve(this.cwd, folder);
      await this.check(absolute, true);
    }

    if (this.interrupted) {
      this.spinner.fail(`Interrupted`);
    } else if (this.foundUntracked) {
      this.spinner.fail(
        `Found untracked files or unpushed changes. See the log file.`
      );
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

  const gatherFiles = new GatherFiles(process.cwd(), DEFAULT_GIT_DIRTY_IGNORE);

  gatherFiles.logger.setStream(
    fs.createWriteStream(`ignored-found-${timestamp()}.txt`),
    LoggerVerboseLevel.ALL
  );

  process.once("SIGINT", () => {
    console.log("Interrupting...");
    gatherFiles.interrupt();
  });

  await gatherFiles.analyze(folders);
}

if (import.meta.main) {
  bin();
}
