import { Command, Option } from "clipanion";

// TODO use schema
// TODO use https://github.com/sindresorhus/import-local
// TODO use https://github.com/sindresorhus/update-notifier

export class HelloCommand extends Command {
  name = Option.String();

  async execute() {
    this.context.stdout.write(`Hello ${this.name}!\n`);
  }
}
