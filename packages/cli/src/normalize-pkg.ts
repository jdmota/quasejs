import { Pkg } from "./types";

// Adapted from https://github.com/npm/normalize-package-data

function handleNameField(data: any): string {
  if (!data.name || typeof data.name !== "string") {
    return "";
  }
  return data.name.trim();
}

function handleVersionField(data: any): string {
  if (!data.version || typeof data.version !== "string") {
    return "";
  }
  return data.version.trim();
}

function handleDescriptionField(data: any): string | undefined {
  if (!data.description || typeof data.description !== "string") {
    return;
  }
  return data.description;
}

function handleBinField(data: any): any {
  if (!data.bin) return;
  if (typeof data.bin === "string") {
    const b: any = {};
    const name = handleNameField(data);
    const match = name.match(/^@[^/]+[/](.*)$/);
    if (match) {
      b[match[1]] = data.bin;
    } else {
      b[name] = data.bin;
    }
    return b;
  }
  return data.bin;
}

export default function(pkg: any): Pkg {
  pkg = pkg || {};
  return {
    name: handleNameField(pkg),
    version: handleVersionField(pkg),
    description: handleDescriptionField(pkg),
    bin: handleBinField(pkg),
  };
}
