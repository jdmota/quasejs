import fsextra from "fs-extra";
import { never } from "../../../../util/miscellaneous";
import { functions } from "../functions";
import { sameValue, valueDesc } from "../values";
import { FileChange } from "./file-system";

type FileInfoJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

const fileInfoDef = valueDesc<FileInfoJSON, FileInfoJSON>(
  (a, b) =>
    a.path === b.path && a.type === b.type && a.recursive === b.recursive,
  a => a.path.length,
  val => val,
  val => val
);

export const fileWatch = functions.register({
  name: "func1",
  version: 1,
  inputDef: fileInfoDef,
  outputDef: sameValue<bigint>(),
  cellsDef: {},
  impl: async (ctx, input) => {
    if (this.registry.invalidationsAllowed()) {
      await this.fs._sub(this);
    }
    if (input.recursive) {
      return -1n;
    }
    await this.cacheableMixin.preExec();
    const { birthtimeNs, mtimeNs } = await fsextra.stat(input.path, {
      bigint: true,
    });
    switch (input.type) {
      case FileChange.ADD_OR_REMOVE:
        return birthtimeNs;
      case FileChange.CHANGE:
        return mtimeNs;
      default:
        never(input.type);
    }
  },
});
