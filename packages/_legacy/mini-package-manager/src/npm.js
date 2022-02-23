// @flow

// Keep this updated with https://github.com/npm/npm/blob/latest/lib/config/cmd-list.js
// Last update: https://github.com/npm/npm/blob/8c77dde74a9d8f9007667cd1/lib/config/cmd-list.js

const commands = {
  audit: true,
  dedupe: true,
  ci: true,
  install: true,
  "install-ci-test": [ "install", "ci" ],
  "install-test": [ "install", "test" ],
  link: true,
  ls: true,
  outdated: true,
  prune: true,
  uninstall: true,
  update: true,
};

const shorthands = {
  un: "uninstall",
  list: "ls",
  ln: "link",
  i: "install",
  it: "install-test",
  cit: "install-ci-test",
  up: "update",
  ddp: "dedupe"
};

const affordances = {
  la: "ls",
  ll: "ls",
  ic: "ci",
  isntall: "install",
  "find-dupes": "dedupe",
  upgrade: "update",
  udpate: "update",
  add: "install",
  unlink: "uninstall",
  remove: "uninstall",
  rm: "uninstall",
  r: "uninstall",
  sit: "cit"
};

export function normalize( command: string ): boolean | string[] {
  command = affordances[ command ] || command;
  command = shorthands[ command ] || command;
  return commands[ command ] || false;
}

export const before = [
  "package.json",
  ".npmrc",
  ".yarnrc"
];

export const after = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "shrinkwrap.yaml",
  "package.json",
  ".npmrc",
  ".yarnrc"
];
