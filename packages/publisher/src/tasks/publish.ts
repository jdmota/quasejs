import colorette from "colorette";
import { execPromise } from "../util/util";
import History from "../history";
import { Options } from "../types";

// Adapted from https://github.com/sindresorhus/np

const listrInput = require("listr-input");
const { throwError, from } = require("rxjs");
const { catchError } = require("rxjs/operators");

type PublishOptions = {
  history: History;
  folder: string;
  version: string;
  tag: string | undefined;
  access: string | undefined;
  contents: string | undefined;
  yarn: boolean | undefined;
  otp?: string;
};

const publish = (opts: PublishOptions) => {
  const args = ["publish"];

  if (opts.contents) {
    args.push(opts.contents);
  }

  if (opts.yarn) {
    // This will not run "version" again
    // https://github.com/yarnpkg/yarn/pull/3103
    args.push("--new-version", opts.version);
  }

  if (opts.tag) {
    args.push("--tag", opts.tag);
  }

  if (opts.access) {
    args.push("--access", opts.access);
  }

  if (opts.otp) {
    args.push("--otp", opts.otp);
  }

  return execPromise(opts.yarn ? "yarn" : "npm", args, {
    cwd: opts.folder,
    history: opts.history,
  });
};

const handleError = (
  task: any,
  opts: PublishOptions,
  err: Error & { stderr: string },
  message?: string
) => {
  if (
    err.stderr.includes("one-time pass") ||
    err.message.includes("user TTY")
  ) {
    const title = task.title;
    task.title = `${title} ${colorette.yellow("(waiting for input…)")}`;

    return listrInput(message || "Enter OTP:", {
      done: (otp: string) => {
        task.title = title;

        return publish({
          history: opts.history,
          folder: opts.folder,
          tag: opts.tag,
          version: opts.version,
          yarn: opts.yarn,
          access: opts.access,
          contents: opts.contents,
          otp,
        });
      },
    }).pipe(
      catchError((err: Error & { stderr: string }) =>
        handleError(task, opts, err, "OTP was incorrect, try again:")
      )
    );
  }

  return throwError(err);
};

export default function(task: any, opts: Options) {
  return from(
    publish({
      history: opts.history,
      folder: opts.folder,
      tag: opts.tag,
      version: opts.version,
      yarn: opts.yarn,
      access: opts.access,
      contents: opts.contents,
    })
  ).pipe(
    catchError((err: Error & { stderr: string }) =>
      handleError(task, opts, err)
    )
  );
}
