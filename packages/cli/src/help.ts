import decamelize from "decamelize";
import trimNewlines from "trim-newlines";
import redent from "redent";
import { ArgsInfo } from "./types";
import { pad } from "./utils";

function generateHelpHelper({
  schema,
  commandSet,
  commandOpts,
  parentCommandOpts,
}: ArgsInfo) {
  const { usage } = commandOpts;
  const commandLines = [];
  let commandsLength = 0;

  const infoToShow =
    !commandSet.detail.set && commandSet.detail.last && parentCommandOpts
      ? parentCommandOpts
      : commandOpts;

  if (infoToShow.commands) {
    for (const key in infoToShow.commands) {
      const { description } = infoToShow.commands[key];

      if (description != null) {
        const line = [
          `  ${decamelize(key, "-")}`,
          description || "",
          key === infoToShow.defaultCommand ? `[default]` : "",
        ];

        commandLines.push(line);

        if (commandsLength < line[0].length) {
          commandsLength = line[0].length;
        }
      }
    }
  }

  let result = [];

  if (usage) {
    result.push(usage.replace(/\n*$/, "\n"));
  }

  if (commandLines.length) {
    result = result.concat(
      "Commands:",
      commandLines.map(line => {
        line[0] = pad(line[0], commandsLength);
        return line.filter(Boolean).join(" ");
      })
    );
  }

  if (commandLines.length) {
    result.push("");
  }

  if (schema.cli.help) {
    result.push(schema.cli.help);
  }

  return result.join("\n");
}

export function generateHelp(argsInfo: ArgsInfo) {
  const { commandOpts: opts } = argsInfo;

  const help = redent(
    opts.help
      ? trimNewlines(opts.help.replace(/\t+\n*$/, ""))
      : generateHelpHelper(argsInfo),
    2
  ).trimRight();

  return (
    (opts.description ? `\n  ${opts.description.replace(/\n*$/, "\n")}` : "") +
    (help ? `\n${help}\n` : "\n")
  );
}
