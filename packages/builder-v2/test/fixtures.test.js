import { formatError } from "../dist/utils/error";
import { Builder } from "../dist/builder/builder";
import transformConfig from "./transform-config";
import { cleanText, compareFolders } from "./expect";

const fs = require("fs-extra");
const path = require("path");

/* eslint no-console: 0, no-new-func: 0 */

describe("builder", () => {
  const FIXTURES = path.resolve("packages/builder/test/fixtures");
  const folders = fs.readdirSync(FIXTURES);

  folders.forEach(folder => {
    if (folder === "__dev__") {
      return;
    }

    it(`Fixture: ${folder}`, async () => {
      jest.setTimeout(120000);

      let builder;
      let assetsNum = 0;
      const warnings = [];

      const fixturePath = path.resolve(FIXTURES, folder);
      const expectedPath = path.resolve(fixturePath, "expected");
      const actualPath = path.resolve(fixturePath, "actual");

      const emptyActualP = fs.emptyDir(actualPath);

      let config;
      try {
        config = require(path.resolve(fixturePath, "config.js"));
      } catch (err) {
        config = {};
      }

      config.cwd = fixturePath;
      config.entries = config.entries || ["index.js"];
      config.context = config.context || "files";
      config.dest = config.dest || "actual";

      const expectedOut = config._out;
      delete config._out;

      const expectedError = config._error;
      delete config._error;

      const expectedWarn = config._warn;
      delete config._warn;

      config = transformConfig(config, fixturePath);

      builder = new Builder(config);
      builder.on("warning", w => {
        warnings.push(w);
      });

      async function success() {
        if (expectedError) {
          expect(() => {}).toThrow(expectedError);
        } else {
          await compareFolders(actualPath, expectedPath);

          if (expectedOut) {
            for (let i = 0; i < config.entries; i++) {
              const entry = config.entries[i];
              const dest = path.resolve(builder.options.dest, entry);

              console.log = jest.fn();
              global.__quase_builder__ = undefined;
              require(dest);

              expect(
                console.log.mock.calls.map(args => args.join(" ")).join("\n")
              ).toEqual(expectedOut[i] || "");
            }
          }
        }
        end();
      }

      function failure(err) {
        if (expectedOut || !expectedError) {
          throw err;
        } else {
          const { message, stack } = formatError(err);
          expect(
            cleanText(`${message}${stack && err.codeFrame ? `\n${stack}` : ""}`)
          ).toMatchSnapshot("error");
          expect(assetsNum).toBe(0);
        }
        end();
      }

      function end() {
        if (expectedWarn) {
          expect(warnings.join("|")).toMatchSnapshot("warnings");
        } else {
          expect(warnings).toHaveLength(0);
        }
      }

      await emptyActualP;

      try {
        await builder.runBuild();
      } catch (err) {
        return failure(err);
      } finally {
        builder.stop();
      }

      return success();
    });
  });
});
