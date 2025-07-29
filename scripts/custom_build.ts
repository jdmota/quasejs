import path from "path";
import fs from "fs-extra";
import { rollup, type RollupBuild } from "rollup";
import swc from "@rollup/plugin-swc";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { parse } from "@swc/core";

const ROOT = path.resolve(import.meta.dirname, "..");
const extensions = [".ts", ".mjs", ".js", ".d.ts"];

function pretty(file: string) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

async function resolveModule(
  from: string,
  source: string
): Promise<string | false | null> {
  if (!source.startsWith("./") && !source.startsWith("../")) {
    return null;
  }
  const attempt = path.resolve(from, "..", source);
  if (await fs.exists(attempt)) {
    return attempt;
  }
  for (const ext of extensions) {
    if (await fs.exists(attempt + ext)) {
      return attempt + ext;
    }
  }
  return false;
}

type ProcessResult = Readonly<{ relativePath: string; code: string }>;

async function collectFiles(inputFiles: readonly string[], _outputDir: string) {
  const outputDir = path.resolve(ROOT, _outputDir);
  const jobs = new Map<string, Promise<ProcessResult>>();

  function processFile(file: string) {
    const job = jobs.get(file) ?? _processFile(file);
    jobs.set(file, job);
    return job;
  }

  async function _processFile(file: string): Promise<ProcessResult> {
    const relativePath = path.relative(path.resolve(ROOT, "packages"), file);
    if (relativePath.startsWith("..")) {
      throw new Error(`Reading outside of the 'packages' folder: ${file}`);
    }

    const code = await fs.readFile(file, "utf-8");
    const ast = await parse(code, {
      syntax: "typescript",
    });
    for (const node of ast.body) {
      if (
        node.type === "ImportDeclaration" ||
        node.type === "ExportAllDeclaration" ||
        node.type === "ExportNamedDeclaration"
      ) {
        const source = node.source?.value;
        if (source) {
          const resolved = await resolveModule(file, source);
          if (resolved) {
            processFile(resolved);
          } else if (resolved == false) {
            throw new Error(`Could not resolve ${source} from ${pretty(file)}`);
          }
        }
      }
    }

    if (file.endsWith(".js") || file.endsWith(".mjs")) {
      const dts = file.replace(/\.m?js$/, ".d.ts");
      if (await fs.exists(dts)) {
        processFile(dts);
      }
    }

    return { relativePath, code };
  }

  const fakeFrom = path.resolve(ROOT, "./packages/FROM.ts");
  for (const input of inputFiles) {
    const resolved = await resolveModule(fakeFrom, input);
    if (resolved) {
      processFile(resolved);
    } else {
      throw new Error(`Could not resolve input ${input}`);
    }
  }

  for (const [filename, job] of jobs) {
    const { relativePath, code } = await job;
    const dist = path.resolve(outputDir, relativePath);
    console.log(`${pretty(filename)} -> ${pretty(dist)}`);
    await fs.outputFile(dist, code);
  }

  const manifestFile = path.resolve(outputDir, "quasejs_build.json");
  await fs.writeJSON(manifestFile, {
    timestamp: d.toISOString(),
    input,
  });
}

async function build(input: string[], dir: string) {
  let bundle: RollupBuild | null = null;
  let buildFailed = false;
  try {
    bundle = await rollup({
      input,
      plugins: [
        nodeResolve({ extensions }),
        swc({
          swc: {
            jsc: { target: "esnext" },
          },
        }),
      ],
    });
    await bundle.write({ dir });
  } catch (error) {
    buildFailed = true;
    console.error(error);
  }
  if (bundle) {
    await bundle.close();
  }
  process.exitCode = buildFailed ? 1 : 0;
}

const input = [
  "./web-app-tools/async",
  "./web-app-tools/router/pathname",
  "./web-app-tools/router/router",
  "./web-app-tools/router/router.scroll",
  "./web-app-tools/onload",
  "./web-app-tools/simple-app",
  "./web-app-tools/ui",
]; /* ?? process.argv.slice(2) */

const d = new Date();
function n(n: number) {
  return n < 10 ? "0" + n : "" + n;
}

function timestamp() {
  return `${d.getFullYear()}${n(d.getMonth() + 1)}${n(d.getDate())}${n(d.getHours())}${n(d.getMinutes())}${n(d.getSeconds())}`;
}

collectFiles(input, `scripts/${timestamp()}`);
