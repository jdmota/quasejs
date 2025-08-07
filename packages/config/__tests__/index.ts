import path from "path";
import { getConfig } from "..";

const fixturesFolder = path.resolve(import.meta.dirname, "__fixtures__");

it("get config", async () => {
  let result = await getConfig({
    cwd: fixturesFolder,
    configFiles: ["quase-config.js"],
    failIfNotFound: true,
  });

  expect(result.config.default.iAmTheConfigFile).toBe("yes");
  expect(typeof result.location).toBe("string");

  result = await getConfig({
    cwd: fixturesFolder,
    configFiles: ["non-existent-file.js"],
  });

  expect(result.config).toBe(undefined);
  expect(result.location).toBe(undefined);

  result = await getConfig({
    cwd: fixturesFolder,
    configFiles: ["non-existent-file.js"],
    configKey: "my-key",
  });

  expect(result.config.configFromPkg).toBe("yes");
  expect(typeof result.location).toBe("string");
  expect(result.location!.endsWith("package.json")).toBe(true);

  result = await getConfig({
    cwd: fixturesFolder,
    configFiles: ["quase-config-2.mjs"],
    configKey: "my-key",
  });

  expect(result.config.default.iAmTheConfigFile2).toBe("yes");
  expect(result.config.configFromPkg).toBe(undefined);
  expect(typeof result.location).toBe("string");
  expect(result.location!.endsWith("quase-config-2.mjs")).toBe(true);

  await expect(
    getConfig({
      cwd: fixturesFolder,
      configFiles: ["non-existante-file.js"],
      failIfNotFound: true,
    })
  ).rejects.toThrow(/^Config file was not found/);

  result = await getConfig({
    cwd: fixturesFolder,
    configFiles: [],
    configKey: "",
  });

  expect(result.config).toBe(undefined);
  expect(result.location).toBe(undefined);

  result = await getConfig({
    cwd: fixturesFolder,
    configFiles: ["quase-config-3.js"],
  });

  expect(typeof result.config.default).toBe("function");
  expect(typeof result.location).toBe("string");
  expect(result.location!.endsWith("quase-config-3.js")).toBe(true);
});
