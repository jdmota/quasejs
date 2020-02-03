export class BuildCancelled extends Error {
  constructor() {
    super("Build cancelled");
  }
}
