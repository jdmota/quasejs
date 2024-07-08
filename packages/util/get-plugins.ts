import { resolve } from "node:path";
import { Obj } from "./miscellaneous";

type ProvidedPlugins<P> = readonly (P | [string, Obj] | null | undefined)[];

const relative = /^(\.|\.\.)(\/|\\)/;

export async function importPlugin<P>(name: string, cwd: string): Promise<P> {
  const plugin = relative.test(name)
    ? await import(resolve(cwd, name))
    : await import(name);
  return plugin;
}

export async function getOnePlugin<P>(
  name: string,
  options: Obj,
  cwd: string
): Promise<P> {
  const plugin = await importPlugin(name, cwd);

  if (typeof plugin !== "function") {
    throw new Error(`Plugin ${name} is not a function`);
  }

  if (plugin.length !== 1) {
    throw new Error(`Plugin ${name} should be a function with one argument`);
  }

  return plugin(options);
}

export async function getPlugins<P>(
  provided: ProvidedPlugins<P>,
  cwd: string
): Promise<readonly P[]> {
  return Promise.all(
    provided
      .filter(p => p != null)
      .map(p => (Array.isArray(p) ? getOnePlugin<P>(p[0], p[1], cwd) : p))
  );
}
