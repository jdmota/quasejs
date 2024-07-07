import path from "path";
import { fileURLToPath } from "url";
import { getConfig } from "../src";

const dirname = path.dirname(fileURLToPath(import.meta.url));

it("get config", async () => {
  let result = await getConfig({
    cwd: dirname,
    configFiles: ["quase-config.js"],
    failIfNotFound: true,
  });

  expect(result.config.default.iAmTheConfigFile).toBe("yes");
  expect(typeof result.location).toBe("string");

  result = await getConfig({
    cwd: dirname,
    configFiles: ["non-existent-file.js"],
  });

  expect(result.config).toBe(undefined);
  expect(result.location).toBe(undefined);

  result = await getConfig({
    cwd: dirname,
    configFiles: ["non-existent-file.js"],
    configKey: "my-key",
  });

  expect(result.config.configFromPkg).toBe("yes");
  expect(typeof result.location).toBe("string");
  expect(result.location!.endsWith("package.json")).toBe(true);

  result = await getConfig({
    cwd: dirname,
    configFiles: ["quase-config-2.js"],
    configKey: "my-key",
  });

  expect(result.config.default.iAmTheConfigFile2).toBe("yes");
  expect(result.config.configFromPkg).toBe(undefined);
  expect(typeof result.location).toBe("string");
  expect(result.location!.endsWith("quase-config-2.js")).toBe(true);

  await expect(
    getConfig({
      cwd: dirname,
      configFiles: ["non-existante-file.js"],
      failIfNotFound: true,
    })
  ).rejects.toThrow(/^Config file was not found/);

  result = await getConfig({
    cwd: dirname,
    configFiles: [],
    configKey: "",
  });

  expect(result.config).toBe(undefined);
  expect(result.location).toBe(undefined);

  result = await getConfig({
    cwd: dirname,
    configFiles: ["quase-config-3.js"],
  });

  expect(typeof result.config.default).toBe("function");
  expect(typeof result.location).toBe("string");
  expect(result.location!.endsWith("quase-config-3.js")).toBe(true);
});
