import { ProvidedPluginsArr, Plugin } from "../types";
import {
  defaultResolversMap,
  defaultTransformersMap,
  defaultPackagersMap,
  defaultCheckersMap,
} from "./default-plugins";
import { getOnePlugin } from "@quase/get-plugins";

function isObject(obj: unknown): boolean {
  return typeof obj === "object" && obj != null;
}

function typeOf(obj: unknown) {
  return obj === null ? "null" : typeof obj;
}

function getDefaultPlugin(plugin: string) {
  if (defaultCheckersMap[plugin]) {
    return defaultCheckersMap[plugin];
  }
  if (defaultResolversMap[plugin]) {
    return defaultResolversMap[plugin];
  }
  if (defaultTransformersMap[plugin]) {
    return defaultTransformersMap[plugin];
  }
  if (defaultPackagersMap[plugin]) {
    return defaultPackagersMap[plugin];
  }
  return plugin;
}

function getPlugins(provided: ProvidedPluginsArr<string>, cwd: string) {
  const plugins = [];
  for (const p of provided) {
    if (p) {
      if (typeof p === "string") {
        plugins.push(getOnePlugin(getDefaultPlugin(p), cwd));
      } else {
        plugins.push(getOnePlugin(p, cwd));
      }
    }
  }
  return plugins;
}

function isNotNull<T>(x: Plugin<T> | null): x is Plugin<T> {
  return x != null;
}

export class PluginRegistry<
  T extends { name?: string; options?(flags: any): any }
> {
  private plugins: Plugin<T>[];
  private pluginsMap: Map<string, Plugin<T>>;

  constructor() {
    this.plugins = [];
    this.pluginsMap = new Map();
  }

  // TODO lazy options calculation?
  async init(provided: ProvidedPluginsArr<string>, cwd: string) {
    const map: Map<string, Plugin<T>> = new Map();

    const plugins = getPlugins(provided, cwd);

    const promises = plugins.map(({ name, plugin, options }) => {
      if (!isObject(plugin)) {
        throw new Error(
          `Expected ${
            name ? name + " " : ""
          }plugin to be an object instead got ${typeOf(plugin)}`
        );
      }
      return this.handle(map, name as string, plugin, options);
    });

    this.plugins = (await Promise.all(promises)).filter(isNotNull);
    this.pluginsMap = map;
  }

  get(name: string) {
    return this.pluginsMap.get(name);
  }

  list() {
    return this.plugins;
  }

  private async handle(
    map: Map<string, Plugin<T>>,
    _name: string,
    plugin: T,
    _flags: any
  ): Promise<Plugin<T> | null> {
    const flags = _flags || {};
    const name = plugin.name || _name;

    if (map.has(name)) {
      return null;
    }

    const options = plugin.options
      ? (await plugin.options(flags)) || flags
      : flags;
    const obj: Plugin<T> = {
      name,
      plugin,
      options,
    };
    map.set(name, obj);
    return obj;
  }
}
