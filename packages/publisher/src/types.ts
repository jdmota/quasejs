import History from "./history";

export type Pkg = {
  private?: boolean;
  name: string;
  version: string;
  repository?: { url?: string };
  scripts?: { [key: string]: string };
  publishConfig?: { registry?: string };
};

export type GitOptions = {
  root: string | undefined;
  branch: string;
  check: boolean;
  commitAndTag: boolean | "only-commit";
  message: string | undefined;
  tagPrefix: string | undefined;
  push: boolean;
  signCommit: boolean;
  signTag: boolean;
  commitHooks: boolean;
  pushHooks: boolean;
};

export type Options = {
  cwd: string;
  folder: string;
  relativeFolder: string;
  pkg: Pkg;
  rootPkg: Pkg | undefined;
  pkgPath: string;
  pkgNodeModules: string;
  pkgRelativePath: string;

  yarn: boolean;
  hasNpmLockfile: boolean | undefined;

  version: string;
  tag: string | undefined;

  preview: boolean;
  publish: boolean;
  access: string;
  contents: string | undefined;

  git: GitOptions;

  tasks: { [key: string]: any };
  history: History;
};

export type ProvidedGitOptions = {
  branch?: string;
  check?: boolean;
  commitAndTag?: boolean | "only-commit";
  message?: string | undefined;
  tagPrefix?: string | undefined;
  push?: boolean;
  signCommit?: boolean;
  signTag?: boolean;
  commitHooks?: boolean;
  pushHooks?: boolean;
};

export type ProvidedOptions = {
  preview: boolean;
  publish: boolean;
  cwd: string;
  folder: string;
  version: string | undefined;
  tag: string | undefined;
  access: string | undefined;
  contents: string | undefined;
  yarn: boolean | undefined;
  git: boolean | ProvidedGitOptions;
  tasks: { [key: string]: any };
};
