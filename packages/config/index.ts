import { findUp } from "find-up";
import { packageConfig, packageJsonPath } from "package-config";

type Options = Readonly<{
  cwd?: string;
  configFiles?: string[];
  configKey?: string;
  failIfNotFound?: boolean;
}>;

export async function getConfig(opts: Options = {}) {
  const { cwd, configFiles, configKey, failIfNotFound } = opts;
  let config: any;
  let location: string | undefined;

  if (configFiles && configFiles.length) {
    const loc = await findUp(configFiles, { cwd });

    if (loc) {
      config = await import(loc);
      location = loc;
    } else if (failIfNotFound) {
      throw new Error(`Config file was not found: ${configFiles}`);
    }
  }

  if (!config && configKey) {
    config = await packageConfig(configKey, {
      cwd,
      skipOnFalse: true,
    });
    location = packageJsonPath(config);
  }

  return {
    config,
    location,
  } as const;
}
