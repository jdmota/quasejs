import findUp from "find-up";
import pkgConf from "pkg-conf";

export function loadConfigFrom(location: string, arg: unknown): unknown {
  const e = require(location);
  const x = e && e.__esModule ? e.default : e;
  return typeof x === "function" ? x(arg) : x;
}

type Options = {
  cwd?: string;
  configFiles?: string | string[];
  arg?: unknown;
  configKey?: string;
  failIfNotFound?: boolean;
};

export async function getConfig(opts: Options = {}) {
  const { cwd, configFiles, arg, configKey, failIfNotFound } = opts;
  let config: any;
  let location: string | undefined;

  if (configFiles && configFiles.length) {
    const loc = await findUp(configFiles, { cwd });

    if (loc) {
      config = await loadConfigFrom(loc, arg);
      location = loc;
    } else if (failIfNotFound) {
      throw new Error(`Config file was not found: ${configFiles.toString()}`);
    }
  }

  if (!config && configKey) {
    config = await pkgConf(configKey, { cwd, skipOnFalse: true });
    location = pkgConf.filepath(config) || undefined;

    if (location == null) {
      config = undefined;
      location = undefined;
    }
  }

  return {
    config,
    location,
  };
}
