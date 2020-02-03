import colorette from "colorette";
import {
  linkifyIssues,
  linkifyCommit,
  linkifyCompare,
  info,
  execStdout,
} from "./util/util";
import { Options } from "./types";
import * as version from "./util/version";
import * as npm from "./util/npm";
import * as git from "./util/git";

// Adapted from https://github.com/sindresorhus/np

const prettyVersionDiff = require("pretty-version-diff");
const githubUrlFromGit = require("github-url-from-git");
const inquirer = require("inquirer");

/* eslint-disable no-console */

type Answers = {
  version?: string | undefined;
  tag?: string | undefined;
  access?: string | undefined;
  confirm?: boolean | undefined;
};

function getRepositoryUrl({
  repository,
}: {
  repository?: { url?: string } | null;
}) {
  let url = repository && repository.url;
  if (!url) {
    return;
  }
  url = url.replace(/^\/+$/, "").replace(/\/tree[^]*$/, "");
  return githubUrlFromGit(url, { extraBaseUrls: ["gitlab.com"] });
}

async function printCommitLog(opts: Options) {
  if (!opts.git.tagPrefix) {
    return;
  }

  console.log();

  // Show commits
  const repositoryUrl = getRepositoryUrl(opts.pkg);
  const tagPattern = opts.git.tagPrefix
    .replace(git.versionRe, "*")
    .replace(git.nameRe, opts.pkg.name)
    .replace(/\*?$/g, "*");
  let latestHash;
  try {
    latestHash = await execStdout("git", [
      "rev-list",
      `--tags=${tagPattern}`,
      "--max-count=1",
    ]);
  } catch (e) {
    // Ignore
  }
  if (latestHash) {
    const result = await git.commitLogFromRevision(
      latestHash,
      opts.relativeFolder
    );

    if (result) {
      const history = result.split("\n");
      const historyText = history
        .map((commit: string) => {
          const splitIndex = commit.lastIndexOf(" ");
          const commitMessage = linkifyIssues(
            repositoryUrl,
            commit.substring(0, splitIndex)
          );
          const commitId = linkifyCommit(
            repositoryUrl,
            commit.substring(splitIndex + 1)
          );
          return `- ${commitMessage}  ${commitId}`;
        })
        .join("\n");

      info(`Commits since latest release:\n${historyText}\n`);
      info(
        `Showing ${history.length} commits. For maybe more:\n${linkifyCompare(
          repositoryUrl,
          latestHash,
          opts.git.branch
        )}`
      );
    } else {
      const answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `No commits found since ${latestHash}, continue?`,
          default: false,
        },
      ]);

      if (!answers.confirm) {
        process.exit(0);
      }
    }
  } else {
    info(`No previous git tags found with pattern ${tagPattern}`);
  }
}

export default async function(opts: Options) {
  const pkg = opts.pkg;
  const oldVersion = pkg.version;

  await printCommitLog(opts);

  console.log(
    `\nPublish a new version of ${colorette.bold(
      colorette.magenta(pkg.name)
    )} ${colorette.dim(`(current: ${oldVersion})`)}\n`
  );

  const filter = (input: string) =>
    version.isValidVersionInput(input)
      ? version.getNewVersion(oldVersion, input)
      : input;

  const prompts = [
    {
      type: "list",
      name: "version",
      message: "Select semver increment or specify new version",
      filter,
      when: () => !opts.version,
      pageSize: version.SEMVER_INCREMENTS.length + 2,
      choices: version.SEMVER_INCREMENTS.map(inc => ({
        name: `${inc}    ${prettyVersionDiff(oldVersion, inc)}`,
        value: inc,
      })).concat([
        new inquirer.Separator(),
        {
          name: "Other (specify)",
          value: null,
        },
      ]),
    },
    {
      type: "input",
      name: "version",
      message: "Version",
      filter,
      when: (answers: Answers) => !opts.version && !answers.version,
      validate: (input: string) => {
        if (!version.isValidVersionInput(input)) {
          return "Please specify a valid semver, for example, `1.2.3`. See http://semver.org";
        }

        if (!version.isVersionGreater(oldVersion, input)) {
          return `Version must be greater than ${oldVersion}`;
        }

        return true;
      },
    },
    {
      type: "list",
      name: "tag",
      message: "How should this pre-release version be tagged in npm?",
      when: (answers: Answers) =>
        !pkg.private &&
        version.isPrereleaseVersion(answers.version || opts.version) &&
        !opts.tag,
      choices: async () => {
        const existingPrereleaseTags = await npm.prereleaseTags(pkg.name);

        return [
          ...existingPrereleaseTags,
          new inquirer.Separator(),
          {
            name: "Other (specify)",
            value: null,
          },
        ];
      },
    },
    {
      type: "input",
      name: "tag",
      message: "Tag",
      when: (answers: Answers) =>
        !pkg.private &&
        version.isPrereleaseVersion(answers.version || opts.version) &&
        !opts.tag &&
        !answers.tag,
      validate: (input: string) => {
        if (input.length === 0) {
          return "Please specify a tag, for example, `next`.";
        }

        if (input.toLowerCase() === "latest") {
          return "It's not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.";
        }

        return true;
      },
    },
    {
      type: "list",
      name: "access",
      message: "This scoped repo was not published. What should be its access?",
      when: async () =>
        opts.publish &&
        !opts.access &&
        !pkg.private &&
        /^@/.test(pkg.name) &&
        !(await npm.isPackageNameAvailable(pkg)),
      choices: () => [
        {
          name: "Restricted",
          value: "restricted",
        },
        {
          name: "Public",
          value: "public",
        },
      ],
    },
    {
      type: "confirm",
      name: "confirm",
      message: (answers: Answers) => {
        const access = answers.access || opts.access;
        const tag = answers.tag || opts.tag;
        const tagPart = tag ? ` and tag this release in npm as ${tag}` : "";

        return `Will bump from ${colorette.cyan(
          oldVersion
        )} to ${colorette.cyan(
          answers.version + tagPart
        )}. Access: ${access}. Continue?`;
      },
    },
  ];

  return inquirer.prompt(prompts).then((answers: Answers) => {
    if (answers.confirm) {
      opts.version = answers.version || opts.version;
      opts.tag = answers.tag || opts.tag;
      opts.access = answers.access || opts.access;
      return true;
    }
    return false; // Abort
  });
}
