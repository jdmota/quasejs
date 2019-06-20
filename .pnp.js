#!/usr/bin/env node

/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores, null, $$SETUP_STATIC_TABLES */

// Used for the resolveUnqualified part of the resolution (ie resolving folder/index.js & file extensions)
// Deconstructed so that they aren't affected by any fs monkeypatching occuring later during the execution
const {statSync, lstatSync, readlinkSync, readFileSync, existsSync, realpathSync} = require('fs');

const Module = require('module');
const path = require('path');
const StringDecoder = require('string_decoder');

const ignorePattern = null ? new RegExp(null) : null;

const pnpFile = path.resolve(__dirname, __filename);
const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

const topLevelLocator = {name: null, reference: null};
const blacklistedLocator = {name: NaN, reference: NaN};

// Used for compatibility purposes - cf setupCompatibilityLayer
const patchedModules = [];
const fallbackLocators = [topLevelLocator];

// Matches backslashes of Windows paths
const backwardSlashRegExp = /\\/g;

// Matches if the path must point to a directory (ie ends with /)
const isDirRegExp = /\/$/;

// Matches if the path starts with a valid path qualifier (./, ../, /)
// eslint-disable-next-line no-unused-vars
const isStrictRegExp = /^\.{0,2}\//;

// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?![a-zA-Z]:[\\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;

// Keep a reference around ("module" is a common name in this context, so better rename it to something more significant)
const pnpModule = module;

/**
 * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
 * a way to "reset" the environment temporarily)
 */

let enableNativeHooks = true;

/**
 * Simple helper function that assign an error code to an error, so that it can more easily be caught and used
 * by third-parties.
 */

function makeError(code, message, data = {}) {
  const error = new Error(message);
  return Object.assign(error, {code, data});
}

/**
 * Ensures that the returned locator isn't a blacklisted one.
 *
 * Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only
 * happens with peer dependencies, which effectively have different sets of dependencies depending on their parents.
 *
 * In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a
 * symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will
 * blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path
 * will always have the same set of dependencies, provided the symlinks are correctly preserved.
 *
 * Unfortunately, some tools do not preserve them, and when it happens PnP isn't able anymore to deduce the set of
 * dependencies based on the path of the file that makes the require calls. But since we've blacklisted those paths,
 * we're able to print a more helpful error message that points out that a third-party package is doing something
 * incompatible!
 */

// eslint-disable-next-line no-unused-vars
function blacklistCheck(locator) {
  if (locator === blacklistedLocator) {
    throw makeError(
      `BLACKLISTED`,
      [
        `A package has been resolved through a blacklisted path - this is usually caused by one of your tools calling`,
        `"realpath" on the return value of "require.resolve". Since the returned values use symlinks to disambiguate`,
        `peer dependencies, they must be passed untransformed to "require".`,
      ].join(` `)
    );
  }

  return locator;
}

let packageInformationStores = new Map([
  ["@quase/builder", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "./packages/builder/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/core", "7.4.0"],
        ["@babel/generator", "7.3.2"],
        ["@babel/helpers", "7.4.2"],
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/template", "7.2.2"],
        ["@quase/cli", "0.4.0-0"],
        ["@quase/get-plugins", "0.1.0-0"],
        ["@quase/source-map", "0.2.0-0"],
        ["babel-preset-minify", "0.5.0"],
        ["colorette", "1.0.8"],
        ["fs-extra", "7.0.1"],
        ["fswatcher-child", "1.1.1"],
        ["graphviz", "0.0.9"],
        ["import-lazy", "4.0.0"],
        ["ora", "3.4.0"],
        ["parse5", "5.1.0"],
        ["pretty-bytes", "5.2.0"],
        ["resolve", "1.11.0"],
        ["slash", "3.0.0"],
        ["strip-ansi", "5.2.0"],
        ["ws", "7.0.0"],
        ["@babel/preset-env", "7.4.2"],
        ["@babel/preset-typescript", "pnp:ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5"],
        ["@babel/plugin-external-helpers", "7.2.0"],
        ["@babel/plugin-proposal-class-properties", "7.4.0"],
        ["@babel/plugin-proposal-object-rest-spread", "7.4.3"],
        ["@babel/plugin-transform-runtime", "7.4.0"],
        ["@quase/schema", "0.1.0-0"],
        ["klaw", "3.0.0"],
        ["rollup", "1.10.0"],
        ["sw-precache", "5.2.1"],
      ]),
    }],
  ])],
  ["@babel/code-frame", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-code-frame-7.0.0-06e2ab19bdb535385559aabb5ba59729482800f8/node_modules/@babel/code-frame/"),
      packageDependencies: new Map([
        ["@babel/highlight", "7.0.0"],
        ["@babel/code-frame", "7.0.0"],
      ]),
    }],
  ])],
  ["@babel/highlight", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-highlight-7.0.0-f710c38c8d458e6dd9a201afb637fcb781ce99e4/node_modules/@babel/highlight/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["esutils", "2.0.2"],
        ["js-tokens", "4.0.0"],
        ["@babel/highlight", "7.0.0"],
      ]),
    }],
  ])],
  ["chalk", new Map([
    ["2.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chalk-2.4.2-cd42541677a54333cf541a49108c1432b44c9424/node_modules/chalk/"),
      packageDependencies: new Map([
        ["ansi-styles", "3.2.1"],
        ["escape-string-regexp", "1.0.5"],
        ["supports-color", "5.5.0"],
        ["chalk", "2.4.2"],
      ]),
    }],
    ["1.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chalk-1.1.3-a8115c55e4a702fe4d150abd3872822a7e09fc98/node_modules/chalk/"),
      packageDependencies: new Map([
        ["ansi-styles", "2.2.1"],
        ["escape-string-regexp", "1.0.5"],
        ["has-ansi", "2.0.0"],
        ["strip-ansi", "3.0.1"],
        ["supports-color", "2.0.0"],
        ["chalk", "1.1.3"],
      ]),
    }],
  ])],
  ["ansi-styles", new Map([
    ["3.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-styles-3.2.1-41fbb20243e50b12be0f04b8dedbf07520ce841d/node_modules/ansi-styles/"),
      packageDependencies: new Map([
        ["color-convert", "1.9.3"],
        ["ansi-styles", "3.2.1"],
      ]),
    }],
    ["2.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-styles-2.2.1-b432dd3358b634cf75e1e4664368240533c1ddbe/node_modules/ansi-styles/"),
      packageDependencies: new Map([
        ["ansi-styles", "2.2.1"],
      ]),
    }],
  ])],
  ["color-convert", new Map([
    ["1.9.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-color-convert-1.9.3-bb71850690e1f136567de629d2d5471deda4c1e8/node_modules/color-convert/"),
      packageDependencies: new Map([
        ["color-name", "1.1.3"],
        ["color-convert", "1.9.3"],
      ]),
    }],
  ])],
  ["color-name", new Map([
    ["1.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-color-name-1.1.3-a7d0558bd89c42f795dd42328f740831ca53bc25/node_modules/color-name/"),
      packageDependencies: new Map([
        ["color-name", "1.1.3"],
      ]),
    }],
  ])],
  ["escape-string-regexp", new Map([
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-escape-string-regexp-1.0.5-1b61c0562190a8dff6ae3bb2cf0200ca130b86d4/node_modules/escape-string-regexp/"),
      packageDependencies: new Map([
        ["escape-string-regexp", "1.0.5"],
      ]),
    }],
  ])],
  ["supports-color", new Map([
    ["5.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-supports-color-5.5.0-e2e69a44ac8772f78a1ec0b35b689df6530efc8f/node_modules/supports-color/"),
      packageDependencies: new Map([
        ["has-flag", "3.0.0"],
        ["supports-color", "5.5.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-supports-color-2.0.0-535d045ce6b6363fa40117084629995e9df324c7/node_modules/supports-color/"),
      packageDependencies: new Map([
        ["supports-color", "2.0.0"],
      ]),
    }],
    ["6.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-supports-color-6.1.0-0764abc69c63d5ac842dd4867e8d025e880df8f3/node_modules/supports-color/"),
      packageDependencies: new Map([
        ["has-flag", "3.0.0"],
        ["supports-color", "6.1.0"],
      ]),
    }],
  ])],
  ["has-flag", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-flag-3.0.0-b5d454dc2199ae225699f3467e5a07f3b955bafd/node_modules/has-flag/"),
      packageDependencies: new Map([
        ["has-flag", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-flag-2.0.0-e8207af1cc7b30d446cc70b734b5e8be18f88d51/node_modules/has-flag/"),
      packageDependencies: new Map([
        ["has-flag", "2.0.0"],
      ]),
    }],
  ])],
  ["esutils", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-esutils-2.0.2-0abf4f1caa5bcb1f7a9d8acc6dea4faaa04bac9b/node_modules/esutils/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
      ]),
    }],
  ])],
  ["js-tokens", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-js-tokens-4.0.0-19203fb59991df98e3a287050d4647cdeaf32499/node_modules/js-tokens/"),
      packageDependencies: new Map([
        ["js-tokens", "4.0.0"],
      ]),
    }],
  ])],
  ["@babel/core", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-core-7.4.0-248fd6874b7d755010bfe61f557461d4f446d9e9/node_modules/@babel/core/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/generator", "7.4.0"],
        ["@babel/helpers", "7.4.2"],
        ["@babel/parser", "7.4.2"],
        ["@babel/template", "7.4.0"],
        ["@babel/traverse", "7.4.0"],
        ["@babel/types", "7.4.0"],
        ["convert-source-map", "1.6.0"],
        ["debug", "4.1.1"],
        ["json5", "2.1.0"],
        ["lodash", "4.17.11"],
        ["resolve", "1.10.0"],
        ["semver", "5.6.0"],
        ["source-map", "0.5.7"],
        ["@babel/core", "7.4.0"],
      ]),
    }],
    ["7.4.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-core-7.4.5-081f97e8ffca65a9b4b0fdc7e274e703f000c06a/node_modules/@babel/core/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/generator", "7.4.4"],
        ["@babel/helpers", "7.4.4"],
        ["@babel/parser", "7.4.5"],
        ["@babel/template", "7.4.4"],
        ["@babel/traverse", "7.4.5"],
        ["@babel/types", "7.4.4"],
        ["convert-source-map", "1.6.0"],
        ["debug", "4.1.1"],
        ["json5", "2.1.0"],
        ["lodash", "4.17.11"],
        ["resolve", "1.10.0"],
        ["semver", "5.6.0"],
        ["source-map", "0.5.7"],
        ["@babel/core", "7.4.5"],
      ]),
    }],
    ["7.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-core-7.2.2-07adba6dde27bb5ad8d8672f15fde3e08184a687/node_modules/@babel/core/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/generator", "7.3.2"],
        ["@babel/helpers", "7.3.1"],
        ["@babel/parser", "7.3.2"],
        ["@babel/template", "7.2.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["convert-source-map", "1.6.0"],
        ["debug", "4.1.1"],
        ["json5", "2.1.0"],
        ["lodash", "4.17.11"],
        ["resolve", "1.10.0"],
        ["semver", "5.6.0"],
        ["source-map", "0.5.7"],
        ["@babel/core", "7.2.2"],
      ]),
    }],
  ])],
  ["@babel/generator", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-generator-7.4.0-c230e79589ae7a729fd4631b9ded4dc220418196/node_modules/@babel/generator/"),
      packageDependencies: new Map([
        ["@babel/types", "7.4.0"],
        ["jsesc", "2.5.2"],
        ["lodash", "4.17.11"],
        ["source-map", "0.5.7"],
        ["trim-right", "1.0.1"],
        ["@babel/generator", "7.4.0"],
      ]),
    }],
    ["7.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-generator-7.3.2-fff31a7b2f2f3dad23ef8e01be45b0d5c2fc0132/node_modules/@babel/generator/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["jsesc", "2.5.2"],
        ["lodash", "4.17.11"],
        ["source-map", "0.5.7"],
        ["trim-right", "1.0.1"],
        ["@babel/generator", "7.3.2"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-generator-7.4.4-174a215eb843fc392c7edcaabeaa873de6e8f041/node_modules/@babel/generator/"),
      packageDependencies: new Map([
        ["@babel/types", "7.4.4"],
        ["jsesc", "2.5.2"],
        ["lodash", "4.17.11"],
        ["source-map", "0.5.7"],
        ["trim-right", "1.0.1"],
        ["@babel/generator", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/types", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-types-7.4.0-670724f77d24cce6cc7d8cf64599d511d164894c/node_modules/@babel/types/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
        ["lodash", "4.17.11"],
        ["to-fast-properties", "2.0.0"],
        ["@babel/types", "7.4.0"],
      ]),
    }],
    ["7.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-types-7.3.2-424f5be4be633fff33fb83ab8d67e4a8290f5a2f/node_modules/@babel/types/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
        ["lodash", "4.17.11"],
        ["to-fast-properties", "2.0.0"],
        ["@babel/types", "7.3.2"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-types-7.4.4-8db9e9a629bb7c29370009b4b779ed93fe57d5f0/node_modules/@babel/types/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
        ["lodash", "4.17.11"],
        ["to-fast-properties", "2.0.0"],
        ["@babel/types", "7.4.4"],
      ]),
    }],
  ])],
  ["lodash", new Map([
    ["4.17.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-4.17.11-b39ea6229ef607ecd89e2c8df12536891cac9b8d/node_modules/lodash/"),
      packageDependencies: new Map([
        ["lodash", "4.17.11"],
      ]),
    }],
  ])],
  ["to-fast-properties", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-to-fast-properties-2.0.0-dc5e698cbd079265bc73e0377681a4e4e83f616e/node_modules/to-fast-properties/"),
      packageDependencies: new Map([
        ["to-fast-properties", "2.0.0"],
      ]),
    }],
  ])],
  ["jsesc", new Map([
    ["2.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsesc-2.5.2-80564d2e483dacf6e8ef209650a67df3f0c283a4/node_modules/jsesc/"),
      packageDependencies: new Map([
        ["jsesc", "2.5.2"],
      ]),
    }],
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsesc-0.5.0-e7dee66e35d6fc16f710fe91d5cf69f70f08911d/node_modules/jsesc/"),
      packageDependencies: new Map([
        ["jsesc", "0.5.0"],
      ]),
    }],
  ])],
  ["source-map", new Map([
    ["0.5.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-source-map-0.5.7-8a039d2d1021d22d1ea14c80d8ea468ba2ef3fcc/node_modules/source-map/"),
      packageDependencies: new Map([
        ["source-map", "0.5.7"],
      ]),
    }],
    ["0.8.0-beta.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-source-map-0.8.0-beta.0-d4c1bb42c3f7ee925f005927ba10709e0d1d1f11/node_modules/source-map/"),
      packageDependencies: new Map([
        ["whatwg-url", "7.0.0"],
        ["source-map", "0.8.0-beta.0"],
      ]),
    }],
    ["0.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-source-map-0.6.1-74722af32e9614e9c287a8d0bbde48b5e2f1a263/node_modules/source-map/"),
      packageDependencies: new Map([
        ["source-map", "0.6.1"],
      ]),
    }],
  ])],
  ["trim-right", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-trim-right-1.0.1-cb2e1203067e0c8de1f614094b9fe45704ea6003/node_modules/trim-right/"),
      packageDependencies: new Map([
        ["trim-right", "1.0.1"],
      ]),
    }],
  ])],
  ["@babel/helpers", new Map([
    ["7.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helpers-7.4.2-3bdfa46a552ca77ef5a0f8551be5f0845ae989be/node_modules/@babel/helpers/"),
      packageDependencies: new Map([
        ["@babel/template", "7.4.0"],
        ["@babel/traverse", "7.4.0"],
        ["@babel/types", "7.4.0"],
        ["@babel/helpers", "7.4.2"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helpers-7.4.4-868b0ef59c1dd4e78744562d5ce1b59c89f2f2a5/node_modules/@babel/helpers/"),
      packageDependencies: new Map([
        ["@babel/template", "7.4.4"],
        ["@babel/traverse", "7.4.5"],
        ["@babel/types", "7.4.4"],
        ["@babel/helpers", "7.4.4"],
      ]),
    }],
    ["7.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helpers-7.3.1-949eec9ea4b45d3210feb7dc1c22db664c9e44b9/node_modules/@babel/helpers/"),
      packageDependencies: new Map([
        ["@babel/template", "7.2.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["@babel/helpers", "7.3.1"],
      ]),
    }],
  ])],
  ["@babel/template", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-template-7.4.0-12474e9c077bae585c5d835a95c0b0b790c25c8b/node_modules/@babel/template/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/parser", "7.4.2"],
        ["@babel/types", "7.4.0"],
        ["@babel/template", "7.4.0"],
      ]),
    }],
    ["7.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-template-7.2.2-005b3fdf0ed96e88041330379e0da9a708eb2907/node_modules/@babel/template/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/parser", "7.3.2"],
        ["@babel/types", "7.3.2"],
        ["@babel/template", "7.2.2"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-template-7.4.4-f4b88d1225689a08f5bc3a17483545be9e4ed237/node_modules/@babel/template/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/parser", "7.4.5"],
        ["@babel/types", "7.4.4"],
        ["@babel/template", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/parser", new Map([
    ["7.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-parser-7.4.2-b4521a400cb5a871eab3890787b4bc1326d38d91/node_modules/@babel/parser/"),
      packageDependencies: new Map([
        ["@babel/parser", "7.4.2"],
      ]),
    }],
    ["7.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-parser-7.3.2-95cdeddfc3992a6ca2a1315191c1679ca32c55cd/node_modules/@babel/parser/"),
      packageDependencies: new Map([
        ["@babel/parser", "7.3.2"],
      ]),
    }],
    ["7.4.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-parser-7.4.5-04af8d5d5a2b044a2a1bffacc1e5e6673544e872/node_modules/@babel/parser/"),
      packageDependencies: new Map([
        ["@babel/parser", "7.4.5"],
      ]),
    }],
  ])],
  ["@babel/traverse", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-traverse-7.4.0-14006967dd1d2b3494cdd650c686db9daf0ddada/node_modules/@babel/traverse/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/generator", "7.4.0"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-split-export-declaration", "7.4.0"],
        ["@babel/parser", "7.4.2"],
        ["@babel/types", "7.4.0"],
        ["debug", "4.1.1"],
        ["globals", "11.10.0"],
        ["lodash", "4.17.11"],
        ["@babel/traverse", "7.4.0"],
      ]),
    }],
    ["7.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-traverse-7.2.3-7ff50cefa9c7c0bd2d81231fdac122f3957748d8/node_modules/@babel/traverse/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/generator", "7.3.2"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-split-export-declaration", "7.0.0"],
        ["@babel/parser", "7.3.2"],
        ["@babel/types", "7.3.2"],
        ["debug", "4.1.1"],
        ["globals", "11.10.0"],
        ["lodash", "4.17.11"],
        ["@babel/traverse", "7.2.3"],
      ]),
    }],
    ["7.4.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-traverse-7.4.5-4e92d1728fd2f1897dafdd321efbff92156c3216/node_modules/@babel/traverse/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@babel/generator", "7.4.4"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-split-export-declaration", "7.4.4"],
        ["@babel/parser", "7.4.5"],
        ["@babel/types", "7.4.4"],
        ["debug", "4.1.1"],
        ["globals", "11.10.0"],
        ["lodash", "4.17.11"],
        ["@babel/traverse", "7.4.5"],
      ]),
    }],
  ])],
  ["@babel/helper-function-name", new Map([
    ["7.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-function-name-7.1.0-a0ceb01685f73355d4360c1247f582bfafc8ff53/node_modules/@babel/helper-function-name/"),
      packageDependencies: new Map([
        ["@babel/helper-get-function-arity", "7.0.0"],
        ["@babel/template", "7.2.2"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-function-name", "7.1.0"],
      ]),
    }],
  ])],
  ["@babel/helper-get-function-arity", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-get-function-arity-7.0.0-83572d4320e2a4657263734113c42868b64e49c3/node_modules/@babel/helper-get-function-arity/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@babel/helper-get-function-arity", "7.0.0"],
      ]),
    }],
  ])],
  ["@babel/helper-split-export-declaration", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-split-export-declaration-7.4.0-571bfd52701f492920d63b7f735030e9a3e10b55/node_modules/@babel/helper-split-export-declaration/"),
      packageDependencies: new Map([
        ["@babel/types", "7.4.0"],
        ["@babel/helper-split-export-declaration", "7.4.0"],
      ]),
    }],
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-split-export-declaration-7.0.0-3aae285c0311c2ab095d997b8c9a94cad547d813/node_modules/@babel/helper-split-export-declaration/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@babel/helper-split-export-declaration", "7.0.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-split-export-declaration-7.4.4-ff94894a340be78f53f06af038b205c49d993677/node_modules/@babel/helper-split-export-declaration/"),
      packageDependencies: new Map([
        ["@babel/types", "7.4.4"],
        ["@babel/helper-split-export-declaration", "7.4.4"],
      ]),
    }],
  ])],
  ["debug", new Map([
    ["4.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-debug-4.1.1-3b72260255109c6b589cee050f1d516139664791/node_modules/debug/"),
      packageDependencies: new Map([
        ["ms", "2.1.1"],
        ["debug", "4.1.1"],
      ]),
    }],
    ["2.6.9", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-debug-2.6.9-5d128515df134ff327e90a4c93f4e077a536341f/node_modules/debug/"),
      packageDependencies: new Map([
        ["ms", "2.0.0"],
        ["debug", "2.6.9"],
      ]),
    }],
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-debug-3.1.0-5bb5a0672628b64149566ba16819e61518c67261/node_modules/debug/"),
      packageDependencies: new Map([
        ["ms", "2.0.0"],
        ["debug", "3.1.0"],
      ]),
    }],
    ["3.2.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-debug-3.2.6-e83d17de16d8a7efb7717edbe5fb10135eee629b/node_modules/debug/"),
      packageDependencies: new Map([
        ["ms", "2.1.1"],
        ["debug", "3.2.6"],
      ]),
    }],
  ])],
  ["ms", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ms-2.1.1-30a5864eb3ebb0a66f2ebe6d727af06a09d86e0a/node_modules/ms/"),
      packageDependencies: new Map([
        ["ms", "2.1.1"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ms-2.0.0-5608aeadfc00be6c2901df5f9861788de0d597c8/node_modules/ms/"),
      packageDependencies: new Map([
        ["ms", "2.0.0"],
      ]),
    }],
  ])],
  ["globals", new Map([
    ["11.10.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-globals-11.10.0-1e09776dffda5e01816b3bb4077c8b59c24eaa50/node_modules/globals/"),
      packageDependencies: new Map([
        ["globals", "11.10.0"],
      ]),
    }],
  ])],
  ["convert-source-map", new Map([
    ["1.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-convert-source-map-1.6.0-51b537a8c43e0f04dec1993bffcdd504e758ac20/node_modules/convert-source-map/"),
      packageDependencies: new Map([
        ["safe-buffer", "5.1.2"],
        ["convert-source-map", "1.6.0"],
      ]),
    }],
  ])],
  ["safe-buffer", new Map([
    ["5.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-safe-buffer-5.1.2-991ec69d296e0313747d59bdfd2b745c35f8828d/node_modules/safe-buffer/"),
      packageDependencies: new Map([
        ["safe-buffer", "5.1.2"],
      ]),
    }],
  ])],
  ["json5", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json5-2.1.0-e7a0c62c48285c628d20a10b85c89bb807c32850/node_modules/json5/"),
      packageDependencies: new Map([
        ["minimist", "1.2.0"],
        ["json5", "2.1.0"],
      ]),
    }],
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json5-1.0.1-779fb0018604fa854eacbf6252180d83543e3dbe/node_modules/json5/"),
      packageDependencies: new Map([
        ["minimist", "1.2.0"],
        ["json5", "1.0.1"],
      ]),
    }],
  ])],
  ["minimist", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-minimist-1.2.0-a35008b20f41383eec1fb914f4cd5df79a264284/node_modules/minimist/"),
      packageDependencies: new Map([
        ["minimist", "1.2.0"],
      ]),
    }],
    ["0.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-minimist-0.0.8-857fcabfc3397d2625b8228262e86aa7a011b05d/node_modules/minimist/"),
      packageDependencies: new Map([
        ["minimist", "0.0.8"],
      ]),
    }],
    ["0.0.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-minimist-0.0.10-de3f98543dbf96082be48ad1a0c7cda836301dcf/node_modules/minimist/"),
      packageDependencies: new Map([
        ["minimist", "0.0.10"],
      ]),
    }],
  ])],
  ["resolve", new Map([
    ["1.10.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-1.10.0-3bdaaeaf45cc07f375656dfd2e54ed0810b101ba/node_modules/resolve/"),
      packageDependencies: new Map([
        ["path-parse", "1.0.6"],
        ["resolve", "1.10.0"],
      ]),
    }],
    ["1.11.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-1.11.0-4014870ba296176b86343d50b60f3b50609ce232/node_modules/resolve/"),
      packageDependencies: new Map([
        ["path-parse", "1.0.6"],
        ["resolve", "1.11.0"],
      ]),
    }],
    ["1.1.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-1.1.7-203114d82ad2c5ed9e8e0411b3932875e889e97b/node_modules/resolve/"),
      packageDependencies: new Map([
        ["resolve", "1.1.7"],
      ]),
    }],
  ])],
  ["path-parse", new Map([
    ["1.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-parse-1.0.6-d62dbb5679405d72c4737ec58600e9ddcf06d24c/node_modules/path-parse/"),
      packageDependencies: new Map([
        ["path-parse", "1.0.6"],
      ]),
    }],
  ])],
  ["semver", new Map([
    ["5.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-semver-5.6.0-7e74256fbaa49c75aa7c7a205cc22799cac80004/node_modules/semver/"),
      packageDependencies: new Map([
        ["semver", "5.6.0"],
      ]),
    }],
    ["5.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-semver-5.7.0-790a7cf6fea5459bac96110b29b60412dc8ff96b/node_modules/semver/"),
      packageDependencies: new Map([
        ["semver", "5.7.0"],
      ]),
    }],
    ["6.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-semver-6.1.1-53f53da9b30b2103cd4f15eab3a18ecbcb210c9b/node_modules/semver/"),
      packageDependencies: new Map([
        ["semver", "6.1.1"],
      ]),
    }],
    ["5.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-semver-5.5.0-dc4bbc7a6ca9d916dee5d43516f0092b58f7b8ab/node_modules/semver/"),
      packageDependencies: new Map([
        ["semver", "5.5.0"],
      ]),
    }],
  ])],
  ["@babel/helper-module-imports", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-module-imports-7.0.0-96081b7111e486da4d2cd971ad1a4fe216cc2e3d/node_modules/@babel/helper-module-imports/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@babel/helper-module-imports", "7.0.0"],
      ]),
    }],
  ])],
  ["@quase/cli", new Map([
    ["0.4.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/cli/"),
      packageDependencies: new Map([
        ["@quase/config", "0.2.0-0"],
        ["@quase/schema", "0.1.0-0"],
        ["camelcase", "5.2.0"],
        ["camelcase-keys", "5.0.0"],
        ["decamelize", "3.1.1"],
        ["has-yarn", "2.0.0"],
        ["import-local", "2.0.0"],
        ["is-installed-globally", "0.1.0"],
        ["read-pkg-up", "4.0.0"],
        ["redent", "2.0.0"],
        ["trim-newlines", "2.0.0"],
        ["turbocolor", "2.6.1"],
        ["yargs-parser", "13.0.0"],
        ["boxen", "3.0.0"],
        ["update-notifier", "2.5.0"],
      ]),
    }],
  ])],
  ["@quase/config", new Map([
    ["0.2.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/config/"),
      packageDependencies: new Map([
        ["find-up", "3.0.0"],
        ["pkg-conf", "3.0.0"],
      ]),
    }],
  ])],
  ["find-up", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-find-up-3.0.0-49169f1d7993430646da61ecc5ae355c21c97b73/node_modules/find-up/"),
      packageDependencies: new Map([
        ["locate-path", "3.0.0"],
        ["find-up", "3.0.0"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-find-up-2.1.0-45d1b7e506c717ddd482775a2b77920a3c0c57a7/node_modules/find-up/"),
      packageDependencies: new Map([
        ["locate-path", "2.0.0"],
        ["find-up", "2.1.0"],
      ]),
    }],
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-find-up-1.1.2-6b2e9822b1a2ce0a60ab64d610eccad53cb24d0f/node_modules/find-up/"),
      packageDependencies: new Map([
        ["path-exists", "2.1.0"],
        ["pinkie-promise", "2.0.1"],
        ["find-up", "1.1.2"],
      ]),
    }],
  ])],
  ["locate-path", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-locate-path-3.0.0-dbec3b3ab759758071b58fe59fc41871af21400e/node_modules/locate-path/"),
      packageDependencies: new Map([
        ["p-locate", "3.0.0"],
        ["path-exists", "3.0.0"],
        ["locate-path", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-locate-path-2.0.0-2b568b265eec944c6d9c0de9c3dbbbca0354cd8e/node_modules/locate-path/"),
      packageDependencies: new Map([
        ["p-locate", "2.0.0"],
        ["path-exists", "3.0.0"],
        ["locate-path", "2.0.0"],
      ]),
    }],
  ])],
  ["p-locate", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-locate-3.0.0-322d69a05c0264b25997d9f40cd8a891ab0064a4/node_modules/p-locate/"),
      packageDependencies: new Map([
        ["p-limit", "2.1.0"],
        ["p-locate", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-locate-2.0.0-20a0103b222a70c8fd39cc2e580680f3dde5ec43/node_modules/p-locate/"),
      packageDependencies: new Map([
        ["p-limit", "1.3.0"],
        ["p-locate", "2.0.0"],
      ]),
    }],
  ])],
  ["p-limit", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-limit-2.1.0-1d5a0d20fb12707c758a655f6bbc4386b5930d68/node_modules/p-limit/"),
      packageDependencies: new Map([
        ["p-try", "2.0.0"],
        ["p-limit", "2.1.0"],
      ]),
    }],
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-limit-1.3.0-b86bd5f0c25690911c7590fcbfc2010d54b3ccb8/node_modules/p-limit/"),
      packageDependencies: new Map([
        ["p-try", "1.0.0"],
        ["p-limit", "1.3.0"],
      ]),
    }],
  ])],
  ["p-try", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-try-2.0.0-85080bb87c64688fa47996fe8f7dfbe8211760b1/node_modules/p-try/"),
      packageDependencies: new Map([
        ["p-try", "2.0.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-try-1.0.0-cbc79cdbaf8fd4228e13f621f2b1a237c1b207b3/node_modules/p-try/"),
      packageDependencies: new Map([
        ["p-try", "1.0.0"],
      ]),
    }],
  ])],
  ["path-exists", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-exists-3.0.0-ce0ebeaa5f78cb18925ea7d810d7b59b010fd515/node_modules/path-exists/"),
      packageDependencies: new Map([
        ["path-exists", "3.0.0"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-exists-2.1.0-0feb6c64f0fc518d9a754dd5efb62c7022761f4b/node_modules/path-exists/"),
      packageDependencies: new Map([
        ["pinkie-promise", "2.0.1"],
        ["path-exists", "2.1.0"],
      ]),
    }],
  ])],
  ["pkg-conf", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pkg-conf-3.0.0-41f836458fb83b080e08e62b2d63a68aa8c436df/node_modules/pkg-conf/"),
      packageDependencies: new Map([
        ["find-up", "3.0.0"],
        ["load-json-file", "5.2.0"],
        ["pkg-conf", "3.0.0"],
      ]),
    }],
  ])],
  ["load-json-file", new Map([
    ["5.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-5.2.0-1553627a18bf7b08cd7ec232d63981239085a578/node_modules/load-json-file/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["parse-json", "4.0.0"],
        ["pify", "3.0.0"],
        ["strip-bom", "3.0.0"],
        ["load-json-file", "5.2.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-4.0.0-2f5f45ab91e33216234fd53adab668eb4ec0993b/node_modules/load-json-file/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["parse-json", "4.0.0"],
        ["pify", "3.0.0"],
        ["strip-bom", "3.0.0"],
        ["load-json-file", "4.0.0"],
      ]),
    }],
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-1.1.0-956905708d58b4bab4c2261b04f59f31c99374c0/node_modules/load-json-file/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["parse-json", "2.2.0"],
        ["pify", "2.3.0"],
        ["pinkie-promise", "2.0.1"],
        ["strip-bom", "2.0.0"],
        ["load-json-file", "1.1.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-2.0.0-7947e42149af80d696cbf797bcaabcfe1fe29ca8/node_modules/load-json-file/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["parse-json", "2.2.0"],
        ["pify", "2.3.0"],
        ["strip-bom", "3.0.0"],
        ["load-json-file", "2.0.0"],
      ]),
    }],
  ])],
  ["graceful-fs", new Map([
    ["4.1.15", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-graceful-fs-4.1.15-ffb703e1066e8a0eeaa4c8b80ba9253eeefbfb00/node_modules/graceful-fs/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
      ]),
    }],
  ])],
  ["parse-json", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parse-json-4.0.0-be35f5425be1f7f6c747184f98a788cb99477ee0/node_modules/parse-json/"),
      packageDependencies: new Map([
        ["error-ex", "1.3.2"],
        ["json-parse-better-errors", "1.0.2"],
        ["parse-json", "4.0.0"],
      ]),
    }],
    ["2.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parse-json-2.2.0-f480f40434ef80741f8469099f8dea18f55a4dc9/node_modules/parse-json/"),
      packageDependencies: new Map([
        ["error-ex", "1.3.2"],
        ["parse-json", "2.2.0"],
      ]),
    }],
  ])],
  ["error-ex", new Map([
    ["1.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-error-ex-1.3.2-b4ac40648107fdcdcfae242f428bea8a14d4f1bf/node_modules/error-ex/"),
      packageDependencies: new Map([
        ["is-arrayish", "0.2.1"],
        ["error-ex", "1.3.2"],
      ]),
    }],
  ])],
  ["is-arrayish", new Map([
    ["0.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-arrayish-0.2.1-77c99840527aa8ecb1a8ba697b80645a7a926a9d/node_modules/is-arrayish/"),
      packageDependencies: new Map([
        ["is-arrayish", "0.2.1"],
      ]),
    }],
  ])],
  ["json-parse-better-errors", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json-parse-better-errors-1.0.2-bb867cfb3450e69107c131d1c514bab3dc8bcaa9/node_modules/json-parse-better-errors/"),
      packageDependencies: new Map([
        ["json-parse-better-errors", "1.0.2"],
      ]),
    }],
  ])],
  ["pify", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pify-3.0.0-e5a4acd2c101fdf3d9a4d07f0dbc4db49dd28176/node_modules/pify/"),
      packageDependencies: new Map([
        ["pify", "3.0.0"],
      ]),
    }],
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pify-2.3.0-ed141a6ac043a849ea588498e7dca8b15330e90c/node_modules/pify/"),
      packageDependencies: new Map([
        ["pify", "2.3.0"],
      ]),
    }],
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pify-4.0.1-4b2cd25c50d598735c50292224fd8c6df41e3231/node_modules/pify/"),
      packageDependencies: new Map([
        ["pify", "4.0.1"],
      ]),
    }],
  ])],
  ["strip-bom", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-bom-3.0.0-2334c18e9c759f7bdd56fdef7e9ae3d588e68ed3/node_modules/strip-bom/"),
      packageDependencies: new Map([
        ["strip-bom", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-bom-2.0.0-6219a85616520491f35788bdbf1447a99c7e6b0e/node_modules/strip-bom/"),
      packageDependencies: new Map([
        ["is-utf8", "0.2.1"],
        ["strip-bom", "2.0.0"],
      ]),
    }],
  ])],
  ["@quase/schema", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/schema/"),
      packageDependencies: new Map([
        ["@quase/parser", "0.1.0-0"],
        ["@sindresorhus/is", "0.15.0"],
        ["decamelize", "3.1.1"],
        ["leven", "2.1.0"],
        ["turbocolor", "2.6.1"],
        ["strip-ansi", "5.2.0"],
      ]),
    }],
  ])],
  ["@quase/parser", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/languages/parser/"),
      packageDependencies: new Map([
        ["make-dir", "1.3.0"],
        ["regexp-tree", "0.0.86"],
      ]),
    }],
  ])],
  ["make-dir", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-make-dir-1.3.0-79c1033b80515bd6d24ec9933e860ca75ee27f0c/node_modules/make-dir/"),
      packageDependencies: new Map([
        ["pify", "3.0.0"],
        ["make-dir", "1.3.0"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-make-dir-2.1.0-5f0310e18b8be898cc07009295a30ae41e91e6f5/node_modules/make-dir/"),
      packageDependencies: new Map([
        ["pify", "4.0.1"],
        ["semver", "5.6.0"],
        ["make-dir", "2.1.0"],
      ]),
    }],
  ])],
  ["regexp-tree", new Map([
    ["0.0.86", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regexp-tree-0.0.86-ea4e26220eebad25313d6f4f19c23535cec86745/node_modules/regexp-tree/"),
      packageDependencies: new Map([
        ["cli-table3", "0.5.1"],
        ["colors", "1.3.3"],
        ["yargs", "10.1.2"],
        ["regexp-tree", "0.0.86"],
      ]),
    }],
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regexp-tree-0.1.1-27b455f9b138ca2e84c090e9aff1ffe2a04d97fa/node_modules/regexp-tree/"),
      packageDependencies: new Map([
        ["cli-table3", "0.5.1"],
        ["colors", "1.3.3"],
        ["yargs", "12.0.5"],
        ["regexp-tree", "0.1.1"],
      ]),
    }],
    ["0.1.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regexp-tree-0.1.10-d837816a039c7af8a8d64d7a7c3cf6a1d93450bc/node_modules/regexp-tree/"),
      packageDependencies: new Map([
        ["regexp-tree", "0.1.10"],
      ]),
    }],
  ])],
  ["cli-table3", new Map([
    ["0.5.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-table3-0.5.1-0252372d94dfc40dbd8df06005f48f31f656f202/node_modules/cli-table3/"),
      packageDependencies: new Map([
        ["object-assign", "4.1.1"],
        ["string-width", "2.1.1"],
        ["colors", "1.3.3"],
        ["cli-table3", "0.5.1"],
      ]),
    }],
  ])],
  ["object-assign", new Map([
    ["4.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-object-assign-4.1.1-2109adc7965887cfc05cbbd442cac8bfbb360863/node_modules/object-assign/"),
      packageDependencies: new Map([
        ["object-assign", "4.1.1"],
      ]),
    }],
  ])],
  ["string-width", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-string-width-2.1.1-ab93f27a8dc13d28cac815c462143a6d9012ae9e/node_modules/string-width/"),
      packageDependencies: new Map([
        ["is-fullwidth-code-point", "2.0.0"],
        ["strip-ansi", "4.0.0"],
        ["string-width", "2.1.1"],
      ]),
    }],
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-string-width-1.0.2-118bdf5b8cdc51a2a7e70d211e07e2b0b9b107d3/node_modules/string-width/"),
      packageDependencies: new Map([
        ["code-point-at", "1.1.0"],
        ["is-fullwidth-code-point", "1.0.0"],
        ["strip-ansi", "3.0.1"],
        ["string-width", "1.0.2"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-string-width-3.0.0-5a1690a57cc78211fffd9bf24bbe24d090604eb1/node_modules/string-width/"),
      packageDependencies: new Map([
        ["emoji-regex", "7.0.3"],
        ["is-fullwidth-code-point", "2.0.0"],
        ["strip-ansi", "5.0.0"],
        ["string-width", "3.0.0"],
      ]),
    }],
  ])],
  ["is-fullwidth-code-point", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-fullwidth-code-point-2.0.0-a3b30a5c4f199183167aaab93beefae3ddfb654f/node_modules/is-fullwidth-code-point/"),
      packageDependencies: new Map([
        ["is-fullwidth-code-point", "2.0.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-fullwidth-code-point-1.0.0-ef9e31386f031a7f0d643af82fde50c457ef00cb/node_modules/is-fullwidth-code-point/"),
      packageDependencies: new Map([
        ["number-is-nan", "1.0.1"],
        ["is-fullwidth-code-point", "1.0.0"],
      ]),
    }],
  ])],
  ["strip-ansi", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-4.0.0-a8479022eb1ac368a871389b635262c505ee368f/node_modules/strip-ansi/"),
      packageDependencies: new Map([
        ["ansi-regex", "3.0.0"],
        ["strip-ansi", "4.0.0"],
      ]),
    }],
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-3.0.1-6a385fb8853d952d5ff05d0e8aaf94278dc63dcf/node_modules/strip-ansi/"),
      packageDependencies: new Map([
        ["ansi-regex", "2.1.1"],
        ["strip-ansi", "3.0.1"],
      ]),
    }],
    ["5.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-5.2.0-8c9a536feb6afc962bdfa5b104a5091c1ad9c0ae/node_modules/strip-ansi/"),
      packageDependencies: new Map([
        ["ansi-regex", "4.1.0"],
        ["strip-ansi", "5.2.0"],
      ]),
    }],
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-5.0.0-f78f68b5d0866c20b2c9b8c61b5298508dc8756f/node_modules/strip-ansi/"),
      packageDependencies: new Map([
        ["ansi-regex", "4.0.0"],
        ["strip-ansi", "5.0.0"],
      ]),
    }],
  ])],
  ["ansi-regex", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-3.0.0-ed0317c322064f79466c02966bddb605ab37d998/node_modules/ansi-regex/"),
      packageDependencies: new Map([
        ["ansi-regex", "3.0.0"],
      ]),
    }],
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-2.1.1-c3b33ab5ee360d86e0e628f0468ae7ef27d654df/node_modules/ansi-regex/"),
      packageDependencies: new Map([
        ["ansi-regex", "2.1.1"],
      ]),
    }],
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-4.1.0-8b9f8f08cf1acb843756a839ca8c7e3168c51997/node_modules/ansi-regex/"),
      packageDependencies: new Map([
        ["ansi-regex", "4.1.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-4.0.0-70de791edf021404c3fd615aa89118ae0432e5a9/node_modules/ansi-regex/"),
      packageDependencies: new Map([
        ["ansi-regex", "4.0.0"],
      ]),
    }],
  ])],
  ["colors", new Map([
    ["1.3.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-colors-1.3.3-39e005d546afe01e01f9c4ca8fa50f686a01205d/node_modules/colors/"),
      packageDependencies: new Map([
        ["colors", "1.3.3"],
      ]),
    }],
  ])],
  ["yargs", new Map([
    ["10.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yargs-10.1.2-454d074c2b16a51a43e2fb7807e4f9de69ccb5c5/node_modules/yargs/"),
      packageDependencies: new Map([
        ["cliui", "4.1.0"],
        ["decamelize", "1.2.0"],
        ["find-up", "2.1.0"],
        ["get-caller-file", "1.0.3"],
        ["os-locale", "2.1.0"],
        ["require-directory", "2.1.1"],
        ["require-main-filename", "1.0.1"],
        ["set-blocking", "2.0.0"],
        ["string-width", "2.1.1"],
        ["which-module", "2.0.0"],
        ["y18n", "3.2.1"],
        ["yargs-parser", "8.1.0"],
        ["yargs", "10.1.2"],
      ]),
    }],
    ["12.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yargs-12.0.5-05f5997b609647b64f66b81e3b4b10a368e7ad13/node_modules/yargs/"),
      packageDependencies: new Map([
        ["cliui", "4.1.0"],
        ["decamelize", "1.2.0"],
        ["find-up", "3.0.0"],
        ["get-caller-file", "1.0.3"],
        ["os-locale", "3.1.0"],
        ["require-directory", "2.1.1"],
        ["require-main-filename", "1.0.1"],
        ["set-blocking", "2.0.0"],
        ["string-width", "2.1.1"],
        ["which-module", "2.0.0"],
        ["y18n", "4.0.0"],
        ["yargs-parser", "11.1.1"],
        ["yargs", "12.0.5"],
      ]),
    }],
  ])],
  ["cliui", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cliui-4.1.0-348422dbe82d800b3022eef4f6ac10bf2e4d1b49/node_modules/cliui/"),
      packageDependencies: new Map([
        ["string-width", "2.1.1"],
        ["strip-ansi", "4.0.0"],
        ["wrap-ansi", "2.1.0"],
        ["cliui", "4.1.0"],
      ]),
    }],
  ])],
  ["wrap-ansi", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-wrap-ansi-2.1.0-d8fc3d284dd05794fe84973caecdd1cf824fdd85/node_modules/wrap-ansi/"),
      packageDependencies: new Map([
        ["string-width", "1.0.2"],
        ["strip-ansi", "3.0.1"],
        ["wrap-ansi", "2.1.0"],
      ]),
    }],
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-wrap-ansi-3.0.1-288a04d87eda5c286e060dfe8f135ce8d007f8ba/node_modules/wrap-ansi/"),
      packageDependencies: new Map([
        ["string-width", "2.1.1"],
        ["strip-ansi", "4.0.0"],
        ["wrap-ansi", "3.0.1"],
      ]),
    }],
  ])],
  ["code-point-at", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-code-point-at-1.1.0-0d070b4d043a5bea33a2f1a40e2edb3d9a4ccf77/node_modules/code-point-at/"),
      packageDependencies: new Map([
        ["code-point-at", "1.1.0"],
      ]),
    }],
  ])],
  ["number-is-nan", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-number-is-nan-1.0.1-097b602b53422a522c1afb8790318336941a011d/node_modules/number-is-nan/"),
      packageDependencies: new Map([
        ["number-is-nan", "1.0.1"],
      ]),
    }],
  ])],
  ["decamelize", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-decamelize-1.2.0-f6534d15148269b20352e7bee26f501f9a191290/node_modules/decamelize/"),
      packageDependencies: new Map([
        ["decamelize", "1.2.0"],
      ]),
    }],
    ["3.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-decamelize-3.1.1-ebf473c6f8607bd70fd9ed6d892da27c5eb8539e/node_modules/decamelize/"),
      packageDependencies: new Map([
        ["xregexp", "4.2.4"],
        ["decamelize", "3.1.1"],
      ]),
    }],
  ])],
  ["get-caller-file", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-get-caller-file-1.0.3-f978fa4c90d1dfe7ff2d6beda2a515e713bdcf4a/node_modules/get-caller-file/"),
      packageDependencies: new Map([
        ["get-caller-file", "1.0.3"],
      ]),
    }],
  ])],
  ["os-locale", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-os-locale-2.1.0-42bc2900a6b5b8bd17376c8e882b65afccf24bf2/node_modules/os-locale/"),
      packageDependencies: new Map([
        ["execa", "0.7.0"],
        ["lcid", "1.0.0"],
        ["mem", "1.1.0"],
        ["os-locale", "2.1.0"],
      ]),
    }],
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-os-locale-3.1.0-a802a6ee17f24c10483ab9935719cef4ed16bf1a/node_modules/os-locale/"),
      packageDependencies: new Map([
        ["execa", "1.0.0"],
        ["lcid", "2.0.0"],
        ["mem", "4.1.0"],
        ["os-locale", "3.1.0"],
      ]),
    }],
  ])],
  ["execa", new Map([
    ["0.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-execa-0.7.0-944becd34cc41ee32a63a9faf27ad5a65fc59777/node_modules/execa/"),
      packageDependencies: new Map([
        ["cross-spawn", "5.1.0"],
        ["get-stream", "3.0.0"],
        ["is-stream", "1.1.0"],
        ["npm-run-path", "2.0.2"],
        ["p-finally", "1.0.0"],
        ["signal-exit", "3.0.2"],
        ["strip-eof", "1.0.0"],
        ["execa", "0.7.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-execa-1.0.0-c6236a5bb4df6d6f15e88e7f017798216749ddd8/node_modules/execa/"),
      packageDependencies: new Map([
        ["cross-spawn", "6.0.5"],
        ["get-stream", "4.1.0"],
        ["is-stream", "1.1.0"],
        ["npm-run-path", "2.0.2"],
        ["p-finally", "1.0.0"],
        ["signal-exit", "3.0.2"],
        ["strip-eof", "1.0.0"],
        ["execa", "1.0.0"],
      ]),
    }],
  ])],
  ["cross-spawn", new Map([
    ["5.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cross-spawn-5.1.0-e8bd0efee58fcff6f8f94510a0a554bbfa235449/node_modules/cross-spawn/"),
      packageDependencies: new Map([
        ["lru-cache", "4.1.5"],
        ["shebang-command", "1.2.0"],
        ["which", "1.3.1"],
        ["cross-spawn", "5.1.0"],
      ]),
    }],
    ["6.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cross-spawn-6.0.5-4a5ec7c64dfae22c3a14124dbacdee846d80cbc4/node_modules/cross-spawn/"),
      packageDependencies: new Map([
        ["nice-try", "1.0.5"],
        ["path-key", "2.0.1"],
        ["semver", "5.6.0"],
        ["shebang-command", "1.2.0"],
        ["which", "1.3.1"],
        ["cross-spawn", "6.0.5"],
      ]),
    }],
  ])],
  ["lru-cache", new Map([
    ["4.1.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lru-cache-4.1.5-8bbe50ea85bed59bc9e33dcab8235ee9bcf443cd/node_modules/lru-cache/"),
      packageDependencies: new Map([
        ["pseudomap", "1.0.2"],
        ["yallist", "2.1.2"],
        ["lru-cache", "4.1.5"],
      ]),
    }],
    ["5.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lru-cache-5.1.1-1da27e6710271947695daf6848e847f01d84b920/node_modules/lru-cache/"),
      packageDependencies: new Map([
        ["yallist", "3.0.3"],
        ["lru-cache", "5.1.1"],
      ]),
    }],
  ])],
  ["pseudomap", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pseudomap-1.0.2-f052a28da70e618917ef0a8ac34c1ae5a68286b3/node_modules/pseudomap/"),
      packageDependencies: new Map([
        ["pseudomap", "1.0.2"],
      ]),
    }],
  ])],
  ["yallist", new Map([
    ["2.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yallist-2.1.2-1c11f9218f076089a47dd512f93c6699a6a81d52/node_modules/yallist/"),
      packageDependencies: new Map([
        ["yallist", "2.1.2"],
      ]),
    }],
    ["3.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yallist-3.0.3-b4b049e314be545e3ce802236d6cd22cd91c3de9/node_modules/yallist/"),
      packageDependencies: new Map([
        ["yallist", "3.0.3"],
      ]),
    }],
  ])],
  ["shebang-command", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-shebang-command-1.2.0-44aac65b695b03398968c39f363fee5deafdf1ea/node_modules/shebang-command/"),
      packageDependencies: new Map([
        ["shebang-regex", "1.0.0"],
        ["shebang-command", "1.2.0"],
      ]),
    }],
  ])],
  ["shebang-regex", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-shebang-regex-1.0.0-da42f49740c0b42db2ca9728571cb190c98efea3/node_modules/shebang-regex/"),
      packageDependencies: new Map([
        ["shebang-regex", "1.0.0"],
      ]),
    }],
  ])],
  ["which", new Map([
    ["1.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-which-1.3.1-a45043d54f5805316da8d62f9f50918d3da70b0a/node_modules/which/"),
      packageDependencies: new Map([
        ["isexe", "2.0.0"],
        ["which", "1.3.1"],
      ]),
    }],
  ])],
  ["isexe", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isexe-2.0.0-e8fbf374dc556ff8947a10dcb0572d633f2cfa10/node_modules/isexe/"),
      packageDependencies: new Map([
        ["isexe", "2.0.0"],
      ]),
    }],
  ])],
  ["get-stream", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-get-stream-3.0.0-8e943d1358dc37555054ecbe2edb05aa174ede14/node_modules/get-stream/"),
      packageDependencies: new Map([
        ["get-stream", "3.0.0"],
      ]),
    }],
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-get-stream-4.1.0-c1b255575f3dc21d59bfc79cd3d2b46b1c3a54b5/node_modules/get-stream/"),
      packageDependencies: new Map([
        ["pump", "3.0.0"],
        ["get-stream", "4.1.0"],
      ]),
    }],
  ])],
  ["is-stream", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-stream-1.1.0-12d4a3dd4e68e0b79ceb8dbc84173ae80d91ca44/node_modules/is-stream/"),
      packageDependencies: new Map([
        ["is-stream", "1.1.0"],
      ]),
    }],
  ])],
  ["npm-run-path", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-run-path-2.0.2-35a9232dfa35d7067b4cb2ddf2357b1871536c5f/node_modules/npm-run-path/"),
      packageDependencies: new Map([
        ["path-key", "2.0.1"],
        ["npm-run-path", "2.0.2"],
      ]),
    }],
  ])],
  ["path-key", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-key-2.0.1-411cadb574c5a140d3a4b1910d40d80cc9f40b40/node_modules/path-key/"),
      packageDependencies: new Map([
        ["path-key", "2.0.1"],
      ]),
    }],
  ])],
  ["p-finally", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-finally-1.0.0-3fbcfb15b899a44123b34b6dcc18b724336a2cae/node_modules/p-finally/"),
      packageDependencies: new Map([
        ["p-finally", "1.0.0"],
      ]),
    }],
  ])],
  ["signal-exit", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-signal-exit-3.0.2-b5fdc08f1287ea1178628e415e25132b73646c6d/node_modules/signal-exit/"),
      packageDependencies: new Map([
        ["signal-exit", "3.0.2"],
      ]),
    }],
  ])],
  ["strip-eof", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-eof-1.0.0-bb43ff5598a6eb05d89b59fcd129c983313606bf/node_modules/strip-eof/"),
      packageDependencies: new Map([
        ["strip-eof", "1.0.0"],
      ]),
    }],
  ])],
  ["lcid", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lcid-1.0.0-308accafa0bc483a3867b4b6f2b9506251d1b835/node_modules/lcid/"),
      packageDependencies: new Map([
        ["invert-kv", "1.0.0"],
        ["lcid", "1.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lcid-2.0.0-6ef5d2df60e52f82eb228a4c373e8d1f397253cf/node_modules/lcid/"),
      packageDependencies: new Map([
        ["invert-kv", "2.0.0"],
        ["lcid", "2.0.0"],
      ]),
    }],
  ])],
  ["invert-kv", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-invert-kv-1.0.0-104a8e4aaca6d3d8cd157a8ef8bfab2d7a3ffdb6/node_modules/invert-kv/"),
      packageDependencies: new Map([
        ["invert-kv", "1.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-invert-kv-2.0.0-7393f5afa59ec9ff5f67a27620d11c226e3eec02/node_modules/invert-kv/"),
      packageDependencies: new Map([
        ["invert-kv", "2.0.0"],
      ]),
    }],
  ])],
  ["mem", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mem-1.1.0-5edd52b485ca1d900fe64895505399a0dfa45f76/node_modules/mem/"),
      packageDependencies: new Map([
        ["mimic-fn", "1.2.0"],
        ["mem", "1.1.0"],
      ]),
    }],
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mem-4.1.0-aeb9be2d21f47e78af29e4ac5978e8afa2ca5b8a/node_modules/mem/"),
      packageDependencies: new Map([
        ["map-age-cleaner", "0.1.3"],
        ["mimic-fn", "1.2.0"],
        ["p-is-promise", "2.0.0"],
        ["mem", "4.1.0"],
      ]),
    }],
  ])],
  ["mimic-fn", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mimic-fn-1.2.0-820c86a39334640e99516928bd03fca88057d022/node_modules/mimic-fn/"),
      packageDependencies: new Map([
        ["mimic-fn", "1.2.0"],
      ]),
    }],
  ])],
  ["require-directory", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-require-directory-2.1.1-8c64ad5fd30dab1c976e2344ffe7f792a6a6df42/node_modules/require-directory/"),
      packageDependencies: new Map([
        ["require-directory", "2.1.1"],
      ]),
    }],
  ])],
  ["require-main-filename", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-require-main-filename-1.0.1-97f717b69d48784f5f526a6c5aa8ffdda055a4d1/node_modules/require-main-filename/"),
      packageDependencies: new Map([
        ["require-main-filename", "1.0.1"],
      ]),
    }],
  ])],
  ["set-blocking", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-set-blocking-2.0.0-045f9782d011ae9a6803ddd382b24392b3d890f7/node_modules/set-blocking/"),
      packageDependencies: new Map([
        ["set-blocking", "2.0.0"],
      ]),
    }],
  ])],
  ["which-module", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-which-module-2.0.0-d9ef07dce77b9902b8a3a8fa4b31c3e3f7e6e87a/node_modules/which-module/"),
      packageDependencies: new Map([
        ["which-module", "2.0.0"],
      ]),
    }],
  ])],
  ["y18n", new Map([
    ["3.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-y18n-3.2.1-6d15fba884c08679c0d77e88e7759e811e07fa41/node_modules/y18n/"),
      packageDependencies: new Map([
        ["y18n", "3.2.1"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-y18n-4.0.0-95ef94f85ecc81d007c264e190a120f0a3c8566b/node_modules/y18n/"),
      packageDependencies: new Map([
        ["y18n", "4.0.0"],
      ]),
    }],
  ])],
  ["yargs-parser", new Map([
    ["8.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yargs-parser-8.1.0-f1376a33b6629a5d063782944da732631e966950/node_modules/yargs-parser/"),
      packageDependencies: new Map([
        ["camelcase", "4.1.0"],
        ["yargs-parser", "8.1.0"],
      ]),
    }],
    ["13.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yargs-parser-13.0.0-3fc44f3e76a8bdb1cc3602e860108602e5ccde8b/node_modules/yargs-parser/"),
      packageDependencies: new Map([
        ["camelcase", "5.0.0"],
        ["decamelize", "1.2.0"],
        ["yargs-parser", "13.0.0"],
      ]),
    }],
    ["11.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-yargs-parser-11.1.1-879a0865973bca9f6bab5cbdf3b1c67ec7d3bcf4/node_modules/yargs-parser/"),
      packageDependencies: new Map([
        ["camelcase", "5.0.0"],
        ["decamelize", "1.2.0"],
        ["yargs-parser", "11.1.1"],
      ]),
    }],
  ])],
  ["camelcase", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-4.1.0-d545635be1e33c542649c69173e5de6acfae34dd/node_modules/camelcase/"),
      packageDependencies: new Map([
        ["camelcase", "4.1.0"],
      ]),
    }],
    ["5.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-5.2.0-e7522abda5ed94cc0489e1b8466610e88404cf45/node_modules/camelcase/"),
      packageDependencies: new Map([
        ["camelcase", "5.2.0"],
      ]),
    }],
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-5.0.0-03295527d58bd3cd4aa75363f35b2e8d97be2f42/node_modules/camelcase/"),
      packageDependencies: new Map([
        ["camelcase", "5.0.0"],
      ]),
    }],
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-2.1.1-7c1d16d679a1bbe59ca02cacecfb011e201f5a1f/node_modules/camelcase/"),
      packageDependencies: new Map([
        ["camelcase", "2.1.1"],
      ]),
    }],
  ])],
  ["@sindresorhus/is", new Map([
    ["0.15.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@sindresorhus-is-0.15.0-96915baa05e6a6a1d137badf4984d3fc05820bb6/node_modules/@sindresorhus/is/"),
      packageDependencies: new Map([
        ["@sindresorhus/is", "0.15.0"],
      ]),
    }],
    ["0.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@sindresorhus-is-0.7.0-9a06f4f137ee84d7df0460c1fdb1135ffa6c50fd/node_modules/@sindresorhus/is/"),
      packageDependencies: new Map([
        ["@sindresorhus/is", "0.7.0"],
      ]),
    }],
    ["0.14.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@sindresorhus-is-0.14.0-9fb3a3cf3132328151f353de4632e01e52102bea/node_modules/@sindresorhus/is/"),
      packageDependencies: new Map([
        ["@sindresorhus/is", "0.14.0"],
      ]),
    }],
  ])],
  ["xregexp", new Map([
    ["4.2.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-xregexp-4.2.4-02a4aea056d65a42632c02f0233eab8e4d7e57ed/node_modules/xregexp/"),
      packageDependencies: new Map([
        ["@babel/runtime-corejs2", "7.4.2"],
        ["xregexp", "4.2.4"],
      ]),
    }],
  ])],
  ["@babel/runtime-corejs2", new Map([
    ["7.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-runtime-corejs2-7.4.2-a0cec2c41717fa415e9c204f32b603d88b1796c2/node_modules/@babel/runtime-corejs2/"),
      packageDependencies: new Map([
        ["core-js", "2.6.5"],
        ["regenerator-runtime", "0.13.2"],
        ["@babel/runtime-corejs2", "7.4.2"],
      ]),
    }],
  ])],
  ["core-js", new Map([
    ["2.6.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-js-2.6.5-44bc8d249e7fb2ff5d00e0341a7ffb94fbf67895/node_modules/core-js/"),
      packageDependencies: new Map([
        ["core-js", "2.6.5"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-js-3.0.0-a8dbfa978d29bfc263bfb66c556d0ca924c28957/node_modules/core-js/"),
      packageDependencies: new Map([
        ["core-js", "3.0.0"],
      ]),
    }],
    ["2.6.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-js-2.6.4-b8897c062c4d769dd30a0ac5c73976c47f92ea0d/node_modules/core-js/"),
      packageDependencies: new Map([
        ["core-js", "2.6.4"],
      ]),
    }],
  ])],
  ["regenerator-runtime", new Map([
    ["0.13.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-runtime-0.13.2-32e59c9a6fb9b1a4aff09b4930ca2d4477343447/node_modules/regenerator-runtime/"),
      packageDependencies: new Map([
        ["regenerator-runtime", "0.13.2"],
      ]),
    }],
    ["0.12.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-runtime-0.12.1-fa1a71544764c036f8c49b13a08b2594c9f8a0de/node_modules/regenerator-runtime/"),
      packageDependencies: new Map([
        ["regenerator-runtime", "0.12.1"],
      ]),
    }],
  ])],
  ["leven", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-leven-2.1.0-c2e7a9f772094dee9d34202ae8acce4687875580/node_modules/leven/"),
      packageDependencies: new Map([
        ["leven", "2.1.0"],
      ]),
    }],
  ])],
  ["turbocolor", new Map([
    ["2.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-turbocolor-2.6.1-1b47dcc0e0e5171f57d954351fb80a5088a8a921/node_modules/turbocolor/"),
      packageDependencies: new Map([
        ["turbocolor", "2.6.1"],
      ]),
    }],
  ])],
  ["camelcase-keys", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-keys-5.0.0-67250d1d2e6617ed0568463e56fa337845706695/node_modules/camelcase-keys/"),
      packageDependencies: new Map([
        ["camelcase", "5.0.0"],
        ["map-obj", "3.0.0"],
        ["quick-lru", "1.1.0"],
        ["camelcase-keys", "5.0.0"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-keys-2.1.0-308beeaffdf28119051efa1d932213c91b8f92e7/node_modules/camelcase-keys/"),
      packageDependencies: new Map([
        ["camelcase", "2.1.1"],
        ["map-obj", "1.0.1"],
        ["camelcase-keys", "2.1.0"],
      ]),
    }],
  ])],
  ["map-obj", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-map-obj-3.0.0-4221cc62360f88c0735f9e7c0813bd889657f490/node_modules/map-obj/"),
      packageDependencies: new Map([
        ["map-obj", "3.0.0"],
      ]),
    }],
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-map-obj-1.0.1-d933ceb9205d82bdcf4886f6742bdc2b4dea146d/node_modules/map-obj/"),
      packageDependencies: new Map([
        ["map-obj", "1.0.1"],
      ]),
    }],
  ])],
  ["quick-lru", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-quick-lru-1.1.0-4360b17c61136ad38078397ff11416e186dcfbb8/node_modules/quick-lru/"),
      packageDependencies: new Map([
        ["quick-lru", "1.1.0"],
      ]),
    }],
  ])],
  ["has-yarn", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-yarn-2.0.0-11b77911708db3c5cccd07400537d9acab6131f1/node_modules/has-yarn/"),
      packageDependencies: new Map([
        ["has-yarn", "2.0.0"],
      ]),
    }],
  ])],
  ["import-local", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-import-local-2.0.0-55070be38a5993cf18ef6db7e961f5bee5c5a09d/node_modules/import-local/"),
      packageDependencies: new Map([
        ["pkg-dir", "3.0.0"],
        ["resolve-cwd", "2.0.0"],
        ["import-local", "2.0.0"],
      ]),
    }],
  ])],
  ["pkg-dir", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pkg-dir-3.0.0-2749020f239ed990881b1f71210d51eb6523bea3/node_modules/pkg-dir/"),
      packageDependencies: new Map([
        ["find-up", "3.0.0"],
        ["pkg-dir", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pkg-dir-2.0.0-f6d5d1109e19d63edf428e0bd57e12777615334b/node_modules/pkg-dir/"),
      packageDependencies: new Map([
        ["find-up", "2.1.0"],
        ["pkg-dir", "2.0.0"],
      ]),
    }],
  ])],
  ["resolve-cwd", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-cwd-2.0.0-00a9f7387556e27038eae232caa372a6a59b665a/node_modules/resolve-cwd/"),
      packageDependencies: new Map([
        ["resolve-from", "3.0.0"],
        ["resolve-cwd", "2.0.0"],
      ]),
    }],
  ])],
  ["resolve-from", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-from-3.0.0-b22c7af7d9d6881bc8b6e653335eebcb0a188748/node_modules/resolve-from/"),
      packageDependencies: new Map([
        ["resolve-from", "3.0.0"],
      ]),
    }],
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-from-5.0.0-c35225843df8f776df21c57557bc087e9dfdfc69/node_modules/resolve-from/"),
      packageDependencies: new Map([
        ["resolve-from", "5.0.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-from-4.0.0-4abcd852ad32dd7baabfe9b40e00a36db5f392e6/node_modules/resolve-from/"),
      packageDependencies: new Map([
        ["resolve-from", "4.0.0"],
      ]),
    }],
  ])],
  ["is-installed-globally", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-installed-globally-0.1.0-0dfd98f5a9111716dd535dda6492f67bf3d25a80/node_modules/is-installed-globally/"),
      packageDependencies: new Map([
        ["global-dirs", "0.1.1"],
        ["is-path-inside", "1.0.1"],
        ["is-installed-globally", "0.1.0"],
      ]),
    }],
  ])],
  ["global-dirs", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-global-dirs-0.1.1-b319c0dd4607f353f3be9cca4c72fc148c49f445/node_modules/global-dirs/"),
      packageDependencies: new Map([
        ["ini", "1.3.5"],
        ["global-dirs", "0.1.1"],
      ]),
    }],
  ])],
  ["ini", new Map([
    ["1.3.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ini-1.3.5-eee25f56db1c9ec6085e0c22778083f596abf927/node_modules/ini/"),
      packageDependencies: new Map([
        ["ini", "1.3.5"],
      ]),
    }],
  ])],
  ["is-path-inside", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-path-inside-1.0.1-8ef5b7de50437a3fdca6b4e865ef7aa55cb48036/node_modules/is-path-inside/"),
      packageDependencies: new Map([
        ["path-is-inside", "1.0.2"],
        ["is-path-inside", "1.0.1"],
      ]),
    }],
  ])],
  ["path-is-inside", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-is-inside-1.0.2-365417dede44430d1c11af61027facf074bdfc53/node_modules/path-is-inside/"),
      packageDependencies: new Map([
        ["path-is-inside", "1.0.2"],
      ]),
    }],
  ])],
  ["read-pkg-up", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-up-4.0.0-1b221c6088ba7799601c808f91161c66e58f8978/node_modules/read-pkg-up/"),
      packageDependencies: new Map([
        ["find-up", "3.0.0"],
        ["read-pkg", "3.0.0"],
        ["read-pkg-up", "4.0.0"],
      ]),
    }],
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-up-1.0.1-9d63c13276c065918d57f002a57f40a1b643fb02/node_modules/read-pkg-up/"),
      packageDependencies: new Map([
        ["find-up", "1.1.2"],
        ["read-pkg", "1.1.0"],
        ["read-pkg-up", "1.0.1"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-up-2.0.0-6b72a8048984e0c41e79510fd5e9fa99b3b549be/node_modules/read-pkg-up/"),
      packageDependencies: new Map([
        ["find-up", "2.1.0"],
        ["read-pkg", "2.0.0"],
        ["read-pkg-up", "2.0.0"],
      ]),
    }],
  ])],
  ["read-pkg", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-3.0.0-9cbc686978fee65d16c00e2b19c237fcf6e38389/node_modules/read-pkg/"),
      packageDependencies: new Map([
        ["load-json-file", "4.0.0"],
        ["normalize-package-data", "2.5.0"],
        ["path-type", "3.0.0"],
        ["read-pkg", "3.0.0"],
      ]),
    }],
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-1.1.0-f5ffaa5ecd29cb31c0474bca7d756b6bb29e3f28/node_modules/read-pkg/"),
      packageDependencies: new Map([
        ["load-json-file", "1.1.0"],
        ["normalize-package-data", "2.5.0"],
        ["path-type", "1.1.0"],
        ["read-pkg", "1.1.0"],
      ]),
    }],
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-4.0.1-963625378f3e1c4d48c85872b5a6ec7d5d093237/node_modules/read-pkg/"),
      packageDependencies: new Map([
        ["normalize-package-data", "2.5.0"],
        ["parse-json", "4.0.0"],
        ["pify", "3.0.0"],
        ["read-pkg", "4.0.1"],
      ]),
    }],
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-5.0.0-75449907ece8dfb89cbc76adcba2665316e32b94/node_modules/read-pkg/"),
      packageDependencies: new Map([
        ["normalize-package-data", "2.5.0"],
        ["parse-json", "4.0.0"],
        ["read-pkg", "5.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-2.0.0-8ef1c0623c6a6db0dc6713c4bfac46332b2368f8/node_modules/read-pkg/"),
      packageDependencies: new Map([
        ["load-json-file", "2.0.0"],
        ["normalize-package-data", "2.5.0"],
        ["path-type", "2.0.0"],
        ["read-pkg", "2.0.0"],
      ]),
    }],
  ])],
  ["normalize-package-data", new Map([
    ["2.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-normalize-package-data-2.5.0-e66db1838b200c1dfc233225d12cb36520e234a8/node_modules/normalize-package-data/"),
      packageDependencies: new Map([
        ["hosted-git-info", "2.7.1"],
        ["resolve", "1.10.0"],
        ["semver", "5.6.0"],
        ["validate-npm-package-license", "3.0.4"],
        ["normalize-package-data", "2.5.0"],
      ]),
    }],
  ])],
  ["hosted-git-info", new Map([
    ["2.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-hosted-git-info-2.7.1-97f236977bd6e125408930ff6de3eec6281ec047/node_modules/hosted-git-info/"),
      packageDependencies: new Map([
        ["hosted-git-info", "2.7.1"],
      ]),
    }],
  ])],
  ["validate-npm-package-license", new Map([
    ["3.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-validate-npm-package-license-3.0.4-fc91f6b9c7ba15c857f4cb2c5defeec39d4f410a/node_modules/validate-npm-package-license/"),
      packageDependencies: new Map([
        ["spdx-correct", "3.1.0"],
        ["spdx-expression-parse", "3.0.0"],
        ["validate-npm-package-license", "3.0.4"],
      ]),
    }],
  ])],
  ["spdx-correct", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-spdx-correct-3.1.0-fb83e504445268f154b074e218c87c003cd31df4/node_modules/spdx-correct/"),
      packageDependencies: new Map([
        ["spdx-expression-parse", "3.0.0"],
        ["spdx-license-ids", "3.0.3"],
        ["spdx-correct", "3.1.0"],
      ]),
    }],
  ])],
  ["spdx-expression-parse", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-spdx-expression-parse-3.0.0-99e119b7a5da00e05491c9fa338b7904823b41d0/node_modules/spdx-expression-parse/"),
      packageDependencies: new Map([
        ["spdx-exceptions", "2.2.0"],
        ["spdx-license-ids", "3.0.3"],
        ["spdx-expression-parse", "3.0.0"],
      ]),
    }],
  ])],
  ["spdx-exceptions", new Map([
    ["2.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-spdx-exceptions-2.2.0-2ea450aee74f2a89bfb94519c07fcd6f41322977/node_modules/spdx-exceptions/"),
      packageDependencies: new Map([
        ["spdx-exceptions", "2.2.0"],
      ]),
    }],
  ])],
  ["spdx-license-ids", new Map([
    ["3.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-spdx-license-ids-3.0.3-81c0ce8f21474756148bbb5f3bfc0f36bf15d76e/node_modules/spdx-license-ids/"),
      packageDependencies: new Map([
        ["spdx-license-ids", "3.0.3"],
      ]),
    }],
  ])],
  ["path-type", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-type-3.0.0-cef31dc8e0a1a3bb0d105c0cd97cf3bf47f4e36f/node_modules/path-type/"),
      packageDependencies: new Map([
        ["pify", "3.0.0"],
        ["path-type", "3.0.0"],
      ]),
    }],
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-type-1.1.0-59c44f7ee491da704da415da5a4070ba4f8fe441/node_modules/path-type/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["pify", "2.3.0"],
        ["pinkie-promise", "2.0.1"],
        ["path-type", "1.1.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-type-2.0.0-f012ccb8415b7096fc2daa1054c3d72389594c73/node_modules/path-type/"),
      packageDependencies: new Map([
        ["pify", "2.3.0"],
        ["path-type", "2.0.0"],
      ]),
    }],
  ])],
  ["redent", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-redent-2.0.0-c1b2007b42d57eb1389079b3c8333639d5e1ccaa/node_modules/redent/"),
      packageDependencies: new Map([
        ["indent-string", "3.2.0"],
        ["strip-indent", "2.0.0"],
        ["redent", "2.0.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-redent-1.0.0-cf916ab1fd5f1f16dfb20822dd6ec7f730c2afde/node_modules/redent/"),
      packageDependencies: new Map([
        ["indent-string", "2.1.0"],
        ["strip-indent", "1.0.1"],
        ["redent", "1.0.0"],
      ]),
    }],
  ])],
  ["indent-string", new Map([
    ["3.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-indent-string-3.2.0-4a5fd6d27cc332f37e5419a504dbb837105c9289/node_modules/indent-string/"),
      packageDependencies: new Map([
        ["indent-string", "3.2.0"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-indent-string-2.1.0-8e2d48348742121b4a8218b7a137e9a52049dc80/node_modules/indent-string/"),
      packageDependencies: new Map([
        ["repeating", "2.0.1"],
        ["indent-string", "2.1.0"],
      ]),
    }],
  ])],
  ["strip-indent", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-indent-2.0.0-5ef8db295d01e6ed6cbf7aab96998d7822527b68/node_modules/strip-indent/"),
      packageDependencies: new Map([
        ["strip-indent", "2.0.0"],
      ]),
    }],
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-indent-1.0.1-0c7962a6adefa7bbd4ac366460a638552ae1a0a2/node_modules/strip-indent/"),
      packageDependencies: new Map([
        ["get-stdin", "4.0.1"],
        ["strip-indent", "1.0.1"],
      ]),
    }],
  ])],
  ["trim-newlines", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-trim-newlines-2.0.0-b403d0b91be50c331dfc4b82eeceb22c3de16d20/node_modules/trim-newlines/"),
      packageDependencies: new Map([
        ["trim-newlines", "2.0.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-trim-newlines-1.0.0-5887966bb582a4503a41eb524f7d35011815a613/node_modules/trim-newlines/"),
      packageDependencies: new Map([
        ["trim-newlines", "1.0.0"],
      ]),
    }],
  ])],
  ["boxen", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-boxen-3.0.0-2e229f603c9c1da9d2966b7e9a5681eb692eca23/node_modules/boxen/"),
      packageDependencies: new Map([
        ["ansi-align", "3.0.0"],
        ["camelcase", "5.0.0"],
        ["chalk", "2.4.2"],
        ["cli-boxes", "2.0.0"],
        ["string-width", "3.0.0"],
        ["term-size", "1.2.0"],
        ["widest-line", "2.0.1"],
        ["boxen", "3.0.0"],
      ]),
    }],
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-boxen-1.3.0-55c6c39a8ba58d9c61ad22cd877532deb665a20b/node_modules/boxen/"),
      packageDependencies: new Map([
        ["ansi-align", "2.0.0"],
        ["camelcase", "4.1.0"],
        ["chalk", "2.4.2"],
        ["cli-boxes", "1.0.0"],
        ["string-width", "2.1.1"],
        ["term-size", "1.2.0"],
        ["widest-line", "2.0.1"],
        ["boxen", "1.3.0"],
      ]),
    }],
  ])],
  ["ansi-align", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-align-3.0.0-b536b371cf687caaef236c18d3e21fe3797467cb/node_modules/ansi-align/"),
      packageDependencies: new Map([
        ["string-width", "3.0.0"],
        ["ansi-align", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-align-2.0.0-c36aeccba563b89ceb556f3690f0b1d9e3547f7f/node_modules/ansi-align/"),
      packageDependencies: new Map([
        ["string-width", "2.1.1"],
        ["ansi-align", "2.0.0"],
      ]),
    }],
  ])],
  ["emoji-regex", new Map([
    ["7.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-emoji-regex-7.0.3-933a04052860c85e83c122479c4748a8e4c72156/node_modules/emoji-regex/"),
      packageDependencies: new Map([
        ["emoji-regex", "7.0.3"],
      ]),
    }],
  ])],
  ["cli-boxes", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-boxes-2.0.0-de5eb5ce7462833133e85f5710fabb38377e9333/node_modules/cli-boxes/"),
      packageDependencies: new Map([
        ["cli-boxes", "2.0.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-boxes-1.0.0-4fa917c3e59c94a004cd61f8ee509da651687143/node_modules/cli-boxes/"),
      packageDependencies: new Map([
        ["cli-boxes", "1.0.0"],
      ]),
    }],
  ])],
  ["term-size", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-term-size-1.2.0-458b83887f288fc56d6fffbfad262e26638efa69/node_modules/term-size/"),
      packageDependencies: new Map([
        ["execa", "0.7.0"],
        ["term-size", "1.2.0"],
      ]),
    }],
  ])],
  ["widest-line", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-widest-line-2.0.1-7438764730ec7ef4381ce4df82fb98a53142a3fc/node_modules/widest-line/"),
      packageDependencies: new Map([
        ["string-width", "2.1.1"],
        ["widest-line", "2.0.1"],
      ]),
    }],
  ])],
  ["update-notifier", new Map([
    ["2.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-update-notifier-2.5.0-d0744593e13f161e406acb1d9408b72cad08aff6/node_modules/update-notifier/"),
      packageDependencies: new Map([
        ["boxen", "1.3.0"],
        ["chalk", "2.4.2"],
        ["configstore", "3.1.2"],
        ["import-lazy", "2.1.0"],
        ["is-ci", "1.2.1"],
        ["is-installed-globally", "0.1.0"],
        ["is-npm", "1.0.0"],
        ["latest-version", "3.1.0"],
        ["semver-diff", "2.1.0"],
        ["xdg-basedir", "3.0.0"],
        ["update-notifier", "2.5.0"],
      ]),
    }],
  ])],
  ["configstore", new Map([
    ["3.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-configstore-3.1.2-c6f25defaeef26df12dd33414b001fe81a543f8f/node_modules/configstore/"),
      packageDependencies: new Map([
        ["dot-prop", "4.2.0"],
        ["graceful-fs", "4.1.15"],
        ["make-dir", "1.3.0"],
        ["unique-string", "1.0.0"],
        ["write-file-atomic", "2.4.2"],
        ["xdg-basedir", "3.0.0"],
        ["configstore", "3.1.2"],
      ]),
    }],
  ])],
  ["dot-prop", new Map([
    ["4.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-dot-prop-4.2.0-1f19e0c2e1aa0e32797c49799f2837ac6af69c57/node_modules/dot-prop/"),
      packageDependencies: new Map([
        ["is-obj", "1.0.1"],
        ["dot-prop", "4.2.0"],
      ]),
    }],
  ])],
  ["is-obj", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-obj-1.0.1-3e4729ac1f5fde025cd7d83a896dab9f4f67db0f/node_modules/is-obj/"),
      packageDependencies: new Map([
        ["is-obj", "1.0.1"],
      ]),
    }],
  ])],
  ["unique-string", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unique-string-1.0.0-9e1057cca851abb93398f8b33ae187b99caec11a/node_modules/unique-string/"),
      packageDependencies: new Map([
        ["crypto-random-string", "1.0.0"],
        ["unique-string", "1.0.0"],
      ]),
    }],
  ])],
  ["crypto-random-string", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-crypto-random-string-1.0.0-a230f64f568310e1498009940790ec99545bca7e/node_modules/crypto-random-string/"),
      packageDependencies: new Map([
        ["crypto-random-string", "1.0.0"],
      ]),
    }],
  ])],
  ["write-file-atomic", new Map([
    ["2.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-write-file-atomic-2.4.2-a7181706dfba17855d221140a9c06e15fcdd87b9/node_modules/write-file-atomic/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["imurmurhash", "0.1.4"],
        ["signal-exit", "3.0.2"],
        ["write-file-atomic", "2.4.2"],
      ]),
    }],
    ["2.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-write-file-atomic-2.4.1-d0b05463c188ae804396fd5ab2a370062af87529/node_modules/write-file-atomic/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["imurmurhash", "0.1.4"],
        ["signal-exit", "3.0.2"],
        ["write-file-atomic", "2.4.1"],
      ]),
    }],
  ])],
  ["imurmurhash", new Map([
    ["0.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-imurmurhash-0.1.4-9218b9b2b928a238b13dc4fb6b6d576f231453ea/node_modules/imurmurhash/"),
      packageDependencies: new Map([
        ["imurmurhash", "0.1.4"],
      ]),
    }],
  ])],
  ["xdg-basedir", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-xdg-basedir-3.0.0-496b2cc109eca8dbacfe2dc72b603c17c5870ad4/node_modules/xdg-basedir/"),
      packageDependencies: new Map([
        ["xdg-basedir", "3.0.0"],
      ]),
    }],
  ])],
  ["import-lazy", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-import-lazy-2.1.0-05698e3d45c88e8d7e9d92cb0584e77f096f3e43/node_modules/import-lazy/"),
      packageDependencies: new Map([
        ["import-lazy", "2.1.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-import-lazy-4.0.0-e8eb627483a0a43da3c03f3e35548be5cb0cc153/node_modules/import-lazy/"),
      packageDependencies: new Map([
        ["import-lazy", "4.0.0"],
      ]),
    }],
  ])],
  ["is-ci", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-ci-1.2.1-e3779c8ee17fccf428488f6e281187f2e632841c/node_modules/is-ci/"),
      packageDependencies: new Map([
        ["ci-info", "1.6.0"],
        ["is-ci", "1.2.1"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-ci-2.0.0-6bc6334181810e04b5c22b3d589fdca55026404c/node_modules/is-ci/"),
      packageDependencies: new Map([
        ["ci-info", "2.0.0"],
        ["is-ci", "2.0.0"],
      ]),
    }],
  ])],
  ["ci-info", new Map([
    ["1.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ci-info-1.6.0-2ca20dbb9ceb32d4524a683303313f0304b1e497/node_modules/ci-info/"),
      packageDependencies: new Map([
        ["ci-info", "1.6.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ci-info-2.0.0-67a9e964be31a51e15e5010d58e6f12834002f46/node_modules/ci-info/"),
      packageDependencies: new Map([
        ["ci-info", "2.0.0"],
      ]),
    }],
  ])],
  ["is-npm", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-npm-1.0.0-f2fb63a65e4905b406c86072765a1a4dc793b9f4/node_modules/is-npm/"),
      packageDependencies: new Map([
        ["is-npm", "1.0.0"],
      ]),
    }],
  ])],
  ["latest-version", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-latest-version-3.1.0-a205383fea322b33b5ae3b18abee0dc2f356ee15/node_modules/latest-version/"),
      packageDependencies: new Map([
        ["package-json", "4.0.1"],
        ["latest-version", "3.1.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-latest-version-4.0.0-9542393ac55a585861a4c4ebc02389a0b4a9c332/node_modules/latest-version/"),
      packageDependencies: new Map([
        ["package-json", "5.0.0"],
        ["latest-version", "4.0.0"],
      ]),
    }],
  ])],
  ["package-json", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-package-json-4.0.1-8869a0401253661c4c4ca3da6c2121ed555f5eed/node_modules/package-json/"),
      packageDependencies: new Map([
        ["got", "6.7.1"],
        ["registry-auth-token", "3.4.0"],
        ["registry-url", "3.1.0"],
        ["semver", "5.6.0"],
        ["package-json", "4.0.1"],
      ]),
    }],
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-package-json-5.0.0-a7dbe2725edcc7dc9bcee627672275e323882433/node_modules/package-json/"),
      packageDependencies: new Map([
        ["got", "8.3.2"],
        ["registry-auth-token", "3.4.0"],
        ["registry-url", "3.1.0"],
        ["semver", "5.6.0"],
        ["package-json", "5.0.0"],
      ]),
    }],
  ])],
  ["got", new Map([
    ["6.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-got-6.7.1-240cd05785a9a18e561dc1b44b41c763ef1e8db0/node_modules/got/"),
      packageDependencies: new Map([
        ["create-error-class", "3.0.2"],
        ["duplexer3", "0.1.4"],
        ["get-stream", "3.0.0"],
        ["is-redirect", "1.0.0"],
        ["is-retry-allowed", "1.1.0"],
        ["is-stream", "1.1.0"],
        ["lowercase-keys", "1.0.1"],
        ["safe-buffer", "5.1.2"],
        ["timed-out", "4.0.1"],
        ["unzip-response", "2.0.1"],
        ["url-parse-lax", "1.0.0"],
        ["got", "6.7.1"],
      ]),
    }],
    ["8.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-got-8.3.2-1d23f64390e97f776cac52e5b936e5f514d2e937/node_modules/got/"),
      packageDependencies: new Map([
        ["@sindresorhus/is", "0.7.0"],
        ["cacheable-request", "2.1.4"],
        ["decompress-response", "3.3.0"],
        ["duplexer3", "0.1.4"],
        ["get-stream", "3.0.0"],
        ["into-stream", "3.1.0"],
        ["is-retry-allowed", "1.1.0"],
        ["isurl", "1.0.0"],
        ["lowercase-keys", "1.0.1"],
        ["mimic-response", "1.0.1"],
        ["p-cancelable", "0.4.1"],
        ["p-timeout", "2.0.1"],
        ["pify", "3.0.0"],
        ["safe-buffer", "5.1.2"],
        ["timed-out", "4.0.1"],
        ["url-parse-lax", "3.0.0"],
        ["url-to-options", "1.0.1"],
        ["got", "8.3.2"],
      ]),
    }],
    ["9.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-got-9.6.0-edf45e7d67f99545705de1f7bbeeeb121765ed85/node_modules/got/"),
      packageDependencies: new Map([
        ["@sindresorhus/is", "0.14.0"],
        ["@szmarczak/http-timer", "1.1.2"],
        ["cacheable-request", "6.0.0"],
        ["decompress-response", "3.3.0"],
        ["duplexer3", "0.1.4"],
        ["get-stream", "4.1.0"],
        ["lowercase-keys", "1.0.1"],
        ["mimic-response", "1.0.1"],
        ["p-cancelable", "1.1.0"],
        ["to-readable-stream", "1.0.0"],
        ["url-parse-lax", "3.0.0"],
        ["got", "9.6.0"],
      ]),
    }],
  ])],
  ["create-error-class", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-create-error-class-3.0.2-06be7abef947a3f14a30fd610671d401bca8b7b6/node_modules/create-error-class/"),
      packageDependencies: new Map([
        ["capture-stack-trace", "1.0.1"],
        ["create-error-class", "3.0.2"],
      ]),
    }],
  ])],
  ["capture-stack-trace", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-capture-stack-trace-1.0.1-a6c0bbe1f38f3aa0b92238ecb6ff42c344d4135d/node_modules/capture-stack-trace/"),
      packageDependencies: new Map([
        ["capture-stack-trace", "1.0.1"],
      ]),
    }],
  ])],
  ["duplexer3", new Map([
    ["0.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-duplexer3-0.1.4-ee01dd1cac0ed3cbc7fdbea37dc0a8f1ce002ce2/node_modules/duplexer3/"),
      packageDependencies: new Map([
        ["duplexer3", "0.1.4"],
      ]),
    }],
  ])],
  ["is-redirect", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-redirect-1.0.0-1d03dded53bd8db0f30c26e4f95d36fc7c87dc24/node_modules/is-redirect/"),
      packageDependencies: new Map([
        ["is-redirect", "1.0.0"],
      ]),
    }],
  ])],
  ["is-retry-allowed", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-retry-allowed-1.1.0-11a060568b67339444033d0125a61a20d564fb34/node_modules/is-retry-allowed/"),
      packageDependencies: new Map([
        ["is-retry-allowed", "1.1.0"],
      ]),
    }],
  ])],
  ["lowercase-keys", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lowercase-keys-1.0.1-6f9e30b47084d971a7c820ff15a6c5167b74c26f/node_modules/lowercase-keys/"),
      packageDependencies: new Map([
        ["lowercase-keys", "1.0.1"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lowercase-keys-1.0.0-4e3366b39e7f5457e35f1324bdf6f88d0bfc7306/node_modules/lowercase-keys/"),
      packageDependencies: new Map([
        ["lowercase-keys", "1.0.0"],
      ]),
    }],
  ])],
  ["timed-out", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-timed-out-4.0.1-f32eacac5a175bea25d7fab565ab3ed8741ef56f/node_modules/timed-out/"),
      packageDependencies: new Map([
        ["timed-out", "4.0.1"],
      ]),
    }],
  ])],
  ["unzip-response", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unzip-response-2.0.1-d2f0f737d16b0615e72a6935ed04214572d56f97/node_modules/unzip-response/"),
      packageDependencies: new Map([
        ["unzip-response", "2.0.1"],
      ]),
    }],
  ])],
  ["url-parse-lax", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-url-parse-lax-1.0.0-7af8f303645e9bd79a272e7a14ac68bc0609da73/node_modules/url-parse-lax/"),
      packageDependencies: new Map([
        ["prepend-http", "1.0.4"],
        ["url-parse-lax", "1.0.0"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-url-parse-lax-3.0.0-16b5cafc07dbe3676c1b1999177823d6503acb0c/node_modules/url-parse-lax/"),
      packageDependencies: new Map([
        ["prepend-http", "2.0.0"],
        ["url-parse-lax", "3.0.0"],
      ]),
    }],
  ])],
  ["prepend-http", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-prepend-http-1.0.4-d4f4562b0ce3696e41ac52d0e002e57a635dc6dc/node_modules/prepend-http/"),
      packageDependencies: new Map([
        ["prepend-http", "1.0.4"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-prepend-http-2.0.0-e92434bfa5ea8c19f41cdfd401d741a3c819d897/node_modules/prepend-http/"),
      packageDependencies: new Map([
        ["prepend-http", "2.0.0"],
      ]),
    }],
  ])],
  ["registry-auth-token", new Map([
    ["3.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-registry-auth-token-3.4.0-d7446815433f5d5ed6431cd5dca21048f66b397e/node_modules/registry-auth-token/"),
      packageDependencies: new Map([
        ["rc", "1.2.8"],
        ["safe-buffer", "5.1.2"],
        ["registry-auth-token", "3.4.0"],
      ]),
    }],
  ])],
  ["rc", new Map([
    ["1.2.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rc-1.2.8-cd924bf5200a075b83c188cd6b9e211b7fc0d3ed/node_modules/rc/"),
      packageDependencies: new Map([
        ["deep-extend", "0.6.0"],
        ["ini", "1.3.5"],
        ["minimist", "1.2.0"],
        ["strip-json-comments", "2.0.1"],
        ["rc", "1.2.8"],
      ]),
    }],
  ])],
  ["deep-extend", new Map([
    ["0.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-deep-extend-0.6.0-c4fa7c95404a17a9c3e8ca7e1537312b736330ac/node_modules/deep-extend/"),
      packageDependencies: new Map([
        ["deep-extend", "0.6.0"],
      ]),
    }],
  ])],
  ["strip-json-comments", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strip-json-comments-2.0.1-3c531942e908c2697c0ec344858c286c7ca0a60a/node_modules/strip-json-comments/"),
      packageDependencies: new Map([
        ["strip-json-comments", "2.0.1"],
      ]),
    }],
  ])],
  ["registry-url", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-registry-url-3.1.0-3d4ef870f73dde1d77f0cf9a381432444e174942/node_modules/registry-url/"),
      packageDependencies: new Map([
        ["rc", "1.2.8"],
        ["registry-url", "3.1.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-registry-url-4.0.0-7dc344ef0f1496fc95a6ad04ccb9a491df11c025/node_modules/registry-url/"),
      packageDependencies: new Map([
        ["rc", "1.2.8"],
        ["registry-url", "4.0.0"],
      ]),
    }],
  ])],
  ["semver-diff", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-semver-diff-2.1.0-4bbb8437c8d37e4b0cf1a68fd726ec6d645d6d36/node_modules/semver-diff/"),
      packageDependencies: new Map([
        ["semver", "5.6.0"],
        ["semver-diff", "2.1.0"],
      ]),
    }],
  ])],
  ["@quase/get-plugins", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/util/get-plugins/"),
      packageDependencies: new Map([
        ["resolve-from", "5.0.0"],
      ]),
    }],
  ])],
  ["@quase/source-map", new Map([
    ["0.2.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/source-map/"),
      packageDependencies: new Map([
        ["@quase/path-url", "0.2.0-0"],
        ["source-map", "0.8.0-beta.0"],
        ["fs-extra", "7.0.1"],
      ]),
    }],
  ])],
  ["@quase/path-url", new Map([
    ["0.2.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/path-url/"),
      packageDependencies: new Map([
        ["file-url", "3.0.0"],
        ["is-url-superb", "3.0.0"],
        ["slash", "3.0.0"],
      ]),
    }],
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@quase-path-url-0.1.0-42383ce0987748aee8291a3ddee2289a4734e036/node_modules/@quase/path-url/"),
      packageDependencies: new Map([
        ["file-url", "2.0.2"],
        ["is-url-superb", "2.0.0"],
        ["slash", "1.0.0"],
        ["@quase/path-url", "0.1.0"],
      ]),
    }],
  ])],
  ["file-url", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-file-url-3.0.0-247a586a746ce9f7a8ed05560290968afc262a77/node_modules/file-url/"),
      packageDependencies: new Map([
        ["file-url", "3.0.0"],
      ]),
    }],
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-file-url-2.0.2-e951784d79095127d3713029ab063f40818ca2ae/node_modules/file-url/"),
      packageDependencies: new Map([
        ["file-url", "2.0.2"],
      ]),
    }],
  ])],
  ["is-url-superb", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-url-superb-3.0.0-b9a1da878a1ac73659047d1e6f4ef22c209d3e25/node_modules/is-url-superb/"),
      packageDependencies: new Map([
        ["url-regex", "5.0.0"],
        ["is-url-superb", "3.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-url-superb-2.0.0-b728a18cf692e4d16da6b94c7408a811db0d0492/node_modules/is-url-superb/"),
      packageDependencies: new Map([
        ["url-regex", "3.2.0"],
        ["is-url-superb", "2.0.0"],
      ]),
    }],
  ])],
  ["url-regex", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-url-regex-5.0.0-8f5456ab83d898d18b2f91753a702649b873273a/node_modules/url-regex/"),
      packageDependencies: new Map([
        ["ip-regex", "4.1.0"],
        ["tlds", "1.203.1"],
        ["url-regex", "5.0.0"],
      ]),
    }],
    ["3.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-url-regex-3.2.0-dbad1e0c9e29e105dd0b1f09f6862f7fdb482724/node_modules/url-regex/"),
      packageDependencies: new Map([
        ["ip-regex", "1.0.3"],
        ["url-regex", "3.2.0"],
      ]),
    }],
  ])],
  ["ip-regex", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ip-regex-4.1.0-5ad62f685a14edb421abebc2fff8db94df67b455/node_modules/ip-regex/"),
      packageDependencies: new Map([
        ["ip-regex", "4.1.0"],
      ]),
    }],
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ip-regex-1.0.3-dc589076f659f419c222039a33316f1c7387effd/node_modules/ip-regex/"),
      packageDependencies: new Map([
        ["ip-regex", "1.0.3"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ip-regex-2.1.0-fa78bf5d2e6913c911ce9f819ee5146bb6d844e9/node_modules/ip-regex/"),
      packageDependencies: new Map([
        ["ip-regex", "2.1.0"],
      ]),
    }],
  ])],
  ["tlds", new Map([
    ["1.203.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tlds-1.203.1-4dc9b02f53de3315bc98b80665e13de3edfc1dfc/node_modules/tlds/"),
      packageDependencies: new Map([
        ["tlds", "1.203.1"],
      ]),
    }],
  ])],
  ["slash", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-slash-3.0.0-6539be870c165adbd5240220dbe361f1bc4d4634/node_modules/slash/"),
      packageDependencies: new Map([
        ["slash", "3.0.0"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-slash-1.0.0-c41f2f6c39fc16d1cd17ad4b5d896114ae470d55/node_modules/slash/"),
      packageDependencies: new Map([
        ["slash", "1.0.0"],
      ]),
    }],
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-slash-2.0.0-de552851a1759df3a8f206535442f5ec4ddeab44/node_modules/slash/"),
      packageDependencies: new Map([
        ["slash", "2.0.0"],
      ]),
    }],
  ])],
  ["whatwg-url", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-url-7.0.0-fde926fa54a599f3adf82dff25a9f7be02dc6edd/node_modules/whatwg-url/"),
      packageDependencies: new Map([
        ["lodash.sortby", "4.7.0"],
        ["tr46", "1.0.1"],
        ["webidl-conversions", "4.0.2"],
        ["whatwg-url", "7.0.0"],
      ]),
    }],
    ["6.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-url-6.5.0-f2df02bff176fd65070df74ad5ccbb5a199965a8/node_modules/whatwg-url/"),
      packageDependencies: new Map([
        ["lodash.sortby", "4.7.0"],
        ["tr46", "1.0.1"],
        ["webidl-conversions", "4.0.2"],
        ["whatwg-url", "6.5.0"],
      ]),
    }],
  ])],
  ["lodash.sortby", new Map([
    ["4.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-sortby-4.7.0-edd14c824e2cc9c1e0b0a1b42bb5210516a42438/node_modules/lodash.sortby/"),
      packageDependencies: new Map([
        ["lodash.sortby", "4.7.0"],
      ]),
    }],
  ])],
  ["tr46", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tr46-1.0.1-a8b13fd6bfd2489519674ccde55ba3693b706d09/node_modules/tr46/"),
      packageDependencies: new Map([
        ["punycode", "2.1.1"],
        ["tr46", "1.0.1"],
      ]),
    }],
  ])],
  ["punycode", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-punycode-2.1.1-b58b010ac40c22c5657616c8d2c2c02c7bf479ec/node_modules/punycode/"),
      packageDependencies: new Map([
        ["punycode", "2.1.1"],
      ]),
    }],
    ["1.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-punycode-1.4.1-c0d5a63b2718800ad8e1eb0fa5269c84dd41845e/node_modules/punycode/"),
      packageDependencies: new Map([
        ["punycode", "1.4.1"],
      ]),
    }],
  ])],
  ["webidl-conversions", new Map([
    ["4.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-webidl-conversions-4.0.2-a855980b1f0b6b359ba1d5d9fb39ae941faa63ad/node_modules/webidl-conversions/"),
      packageDependencies: new Map([
        ["webidl-conversions", "4.0.2"],
      ]),
    }],
  ])],
  ["fs-extra", new Map([
    ["7.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fs-extra-7.0.1-4f189c44aa123b895f722804f55ea23eadc348e9/node_modules/fs-extra/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["jsonfile", "4.0.0"],
        ["universalify", "0.1.2"],
        ["fs-extra", "7.0.1"],
      ]),
    }],
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fs-extra-5.0.0-414d0110cdd06705734d055652c5411260c31abd/node_modules/fs-extra/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["jsonfile", "4.0.0"],
        ["universalify", "0.1.2"],
        ["fs-extra", "5.0.0"],
      ]),
    }],
  ])],
  ["jsonfile", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsonfile-4.0.0-8771aae0799b64076b76640fca058f9c10e33ecb/node_modules/jsonfile/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["jsonfile", "4.0.0"],
      ]),
    }],
  ])],
  ["universalify", new Map([
    ["0.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-universalify-0.1.2-b646f69be3942dabcecc9d6639c80dc105efaa66/node_modules/universalify/"),
      packageDependencies: new Map([
        ["universalify", "0.1.2"],
      ]),
    }],
  ])],
  ["babel-preset-minify", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-preset-minify-0.5.0-e25bb8d3590087af02b650967159a77c19bfb96b/node_modules/babel-preset-minify/"),
      packageDependencies: new Map([
        ["babel-plugin-minify-builtins", "0.5.0"],
        ["babel-plugin-minify-constant-folding", "0.5.0"],
        ["babel-plugin-minify-dead-code-elimination", "0.5.0"],
        ["babel-plugin-minify-flip-comparisons", "0.4.3"],
        ["babel-plugin-minify-guarded-expressions", "0.4.3"],
        ["babel-plugin-minify-infinity", "0.4.3"],
        ["babel-plugin-minify-mangle-names", "0.5.0"],
        ["babel-plugin-minify-numeric-literals", "0.4.3"],
        ["babel-plugin-minify-replace", "0.5.0"],
        ["babel-plugin-minify-simplify", "0.5.0"],
        ["babel-plugin-minify-type-constructors", "0.4.3"],
        ["babel-plugin-transform-inline-consecutive-adds", "0.4.3"],
        ["babel-plugin-transform-member-expression-literals", "6.9.4"],
        ["babel-plugin-transform-merge-sibling-variables", "6.9.4"],
        ["babel-plugin-transform-minify-booleans", "6.9.4"],
        ["babel-plugin-transform-property-literals", "6.9.4"],
        ["babel-plugin-transform-regexp-constructors", "0.4.3"],
        ["babel-plugin-transform-remove-console", "6.9.4"],
        ["babel-plugin-transform-remove-debugger", "6.9.4"],
        ["babel-plugin-transform-remove-undefined", "0.5.0"],
        ["babel-plugin-transform-simplify-comparison-operators", "6.9.4"],
        ["babel-plugin-transform-undefined-to-void", "6.9.4"],
        ["lodash.isplainobject", "4.0.6"],
        ["babel-preset-minify", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-builtins", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-builtins-0.5.0-31eb82ed1a0d0efdc31312f93b6e4741ce82c36b/node_modules/babel-plugin-minify-builtins/"),
      packageDependencies: new Map([
        ["babel-plugin-minify-builtins", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-constant-folding", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-constant-folding-0.5.0-f84bc8dbf6a561e5e350ff95ae216b0ad5515b6e/node_modules/babel-plugin-minify-constant-folding/"),
      packageDependencies: new Map([
        ["babel-helper-evaluate-path", "0.5.0"],
        ["babel-plugin-minify-constant-folding", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-helper-evaluate-path", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-evaluate-path-0.5.0-a62fa9c4e64ff7ea5cea9353174ef023a900a67c/node_modules/babel-helper-evaluate-path/"),
      packageDependencies: new Map([
        ["babel-helper-evaluate-path", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-dead-code-elimination", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-dead-code-elimination-0.5.0-d23ef5445238ad06e8addf5c1cf6aec835bcda87/node_modules/babel-plugin-minify-dead-code-elimination/"),
      packageDependencies: new Map([
        ["babel-helper-evaluate-path", "0.5.0"],
        ["babel-helper-mark-eval-scopes", "0.4.3"],
        ["babel-helper-remove-or-void", "0.4.3"],
        ["lodash.some", "4.6.0"],
        ["babel-plugin-minify-dead-code-elimination", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-helper-mark-eval-scopes", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-mark-eval-scopes-0.4.3-d244a3bef9844872603ffb46e22ce8acdf551562/node_modules/babel-helper-mark-eval-scopes/"),
      packageDependencies: new Map([
        ["babel-helper-mark-eval-scopes", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-helper-remove-or-void", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-remove-or-void-0.4.3-a4f03b40077a0ffe88e45d07010dee241ff5ae60/node_modules/babel-helper-remove-or-void/"),
      packageDependencies: new Map([
        ["babel-helper-remove-or-void", "0.4.3"],
      ]),
    }],
  ])],
  ["lodash.some", new Map([
    ["4.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-some-4.6.0-1bb9f314ef6b8baded13b549169b2a945eb68e4d/node_modules/lodash.some/"),
      packageDependencies: new Map([
        ["lodash.some", "4.6.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-flip-comparisons", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-flip-comparisons-0.4.3-00ca870cb8f13b45c038b3c1ebc0f227293c965a/node_modules/babel-plugin-minify-flip-comparisons/"),
      packageDependencies: new Map([
        ["babel-helper-is-void-0", "0.4.3"],
        ["babel-plugin-minify-flip-comparisons", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-helper-is-void-0", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-is-void-0-0.4.3-7d9c01b4561e7b95dbda0f6eee48f5b60e67313e/node_modules/babel-helper-is-void-0/"),
      packageDependencies: new Map([
        ["babel-helper-is-void-0", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-guarded-expressions", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-guarded-expressions-0.4.3-cc709b4453fd21b1f302877444c89f88427ce397/node_modules/babel-plugin-minify-guarded-expressions/"),
      packageDependencies: new Map([
        ["babel-helper-flip-expressions", "0.4.3"],
        ["babel-plugin-minify-guarded-expressions", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-helper-flip-expressions", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-flip-expressions-0.4.3-3696736a128ac18bc25254b5f40a22ceb3c1d3fd/node_modules/babel-helper-flip-expressions/"),
      packageDependencies: new Map([
        ["babel-helper-flip-expressions", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-infinity", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-infinity-0.4.3-dfb876a1b08a06576384ef3f92e653ba607b39ca/node_modules/babel-plugin-minify-infinity/"),
      packageDependencies: new Map([
        ["babel-plugin-minify-infinity", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-mangle-names", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-mangle-names-0.5.0-bcddb507c91d2c99e138bd6b17a19c3c271e3fd3/node_modules/babel-plugin-minify-mangle-names/"),
      packageDependencies: new Map([
        ["babel-helper-mark-eval-scopes", "0.4.3"],
        ["babel-plugin-minify-mangle-names", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-numeric-literals", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-numeric-literals-0.4.3-8e4fd561c79f7801286ff60e8c5fd9deee93c0bc/node_modules/babel-plugin-minify-numeric-literals/"),
      packageDependencies: new Map([
        ["babel-plugin-minify-numeric-literals", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-replace", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-replace-0.5.0-d3e2c9946c9096c070efc96761ce288ec5c3f71c/node_modules/babel-plugin-minify-replace/"),
      packageDependencies: new Map([
        ["babel-plugin-minify-replace", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-simplify", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-simplify-0.5.0-1f090018afb90d8b54d3d027fd8a4927f243da6f/node_modules/babel-plugin-minify-simplify/"),
      packageDependencies: new Map([
        ["babel-helper-flip-expressions", "0.4.3"],
        ["babel-helper-is-nodes-equiv", "0.0.1"],
        ["babel-helper-to-multiple-sequence-expressions", "0.5.0"],
        ["babel-plugin-minify-simplify", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-helper-is-nodes-equiv", new Map([
    ["0.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-is-nodes-equiv-0.0.1-34e9b300b1479ddd98ec77ea0bbe9342dfe39684/node_modules/babel-helper-is-nodes-equiv/"),
      packageDependencies: new Map([
        ["babel-helper-is-nodes-equiv", "0.0.1"],
      ]),
    }],
  ])],
  ["babel-helper-to-multiple-sequence-expressions", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-to-multiple-sequence-expressions-0.5.0-a3f924e3561882d42fcf48907aa98f7979a4588d/node_modules/babel-helper-to-multiple-sequence-expressions/"),
      packageDependencies: new Map([
        ["babel-helper-to-multiple-sequence-expressions", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-minify-type-constructors", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-type-constructors-0.4.3-1bc6f15b87f7ab1085d42b330b717657a2156500/node_modules/babel-plugin-minify-type-constructors/"),
      packageDependencies: new Map([
        ["babel-helper-is-void-0", "0.4.3"],
        ["babel-plugin-minify-type-constructors", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-inline-consecutive-adds", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-inline-consecutive-adds-0.4.3-323d47a3ea63a83a7ac3c811ae8e6941faf2b0d1/node_modules/babel-plugin-transform-inline-consecutive-adds/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-inline-consecutive-adds", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-member-expression-literals", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-member-expression-literals-6.9.4-37039c9a0c3313a39495faac2ff3a6b5b9d038bf/node_modules/babel-plugin-transform-member-expression-literals/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-member-expression-literals", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-merge-sibling-variables", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-merge-sibling-variables-6.9.4-85b422fc3377b449c9d1cde44087203532401dae/node_modules/babel-plugin-transform-merge-sibling-variables/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-merge-sibling-variables", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-minify-booleans", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-minify-booleans-6.9.4-acbb3e56a3555dd23928e4b582d285162dd2b198/node_modules/babel-plugin-transform-minify-booleans/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-minify-booleans", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-property-literals", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-property-literals-6.9.4-98c1d21e255736573f93ece54459f6ce24985d39/node_modules/babel-plugin-transform-property-literals/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
        ["babel-plugin-transform-property-literals", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-regexp-constructors", new Map([
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-regexp-constructors-0.4.3-58b7775b63afcf33328fae9a5f88fbd4fb0b4965/node_modules/babel-plugin-transform-regexp-constructors/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-regexp-constructors", "0.4.3"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-remove-console", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-remove-console-6.9.4-b980360c067384e24b357a588d807d3c83527780/node_modules/babel-plugin-transform-remove-console/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-remove-console", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-remove-debugger", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-remove-debugger-6.9.4-42b727631c97978e1eb2d199a7aec84a18339ef2/node_modules/babel-plugin-transform-remove-debugger/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-remove-debugger", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-remove-undefined", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-remove-undefined-0.5.0-80208b31225766c630c97fa2d288952056ea22dd/node_modules/babel-plugin-transform-remove-undefined/"),
      packageDependencies: new Map([
        ["babel-helper-evaluate-path", "0.5.0"],
        ["babel-plugin-transform-remove-undefined", "0.5.0"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-simplify-comparison-operators", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-simplify-comparison-operators-6.9.4-f62afe096cab0e1f68a2d753fdf283888471ceb9/node_modules/babel-plugin-transform-simplify-comparison-operators/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-simplify-comparison-operators", "6.9.4"],
      ]),
    }],
  ])],
  ["babel-plugin-transform-undefined-to-void", new Map([
    ["6.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-undefined-to-void-6.9.4-be241ca81404030678b748717322b89d0c8fe280/node_modules/babel-plugin-transform-undefined-to-void/"),
      packageDependencies: new Map([
        ["babel-plugin-transform-undefined-to-void", "6.9.4"],
      ]),
    }],
  ])],
  ["lodash.isplainobject", new Map([
    ["4.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-isplainobject-4.0.6-7c526a52d89b45c45cc690b88163be0497f550cb/node_modules/lodash.isplainobject/"),
      packageDependencies: new Map([
        ["lodash.isplainobject", "4.0.6"],
      ]),
    }],
  ])],
  ["colorette", new Map([
    ["1.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-colorette-1.0.8-421ff11c80b7414027ebed922396bc1833d1903c/node_modules/colorette/"),
      packageDependencies: new Map([
        ["colorette", "1.0.8"],
      ]),
    }],
    ["1.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-colorette-1.0.7-7adf43c445ee63a541b4a4aef7d13f03df1e0cc0/node_modules/colorette/"),
      packageDependencies: new Map([
        ["colorette", "1.0.7"],
      ]),
    }],
  ])],
  ["fswatcher-child", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fswatcher-child-1.1.1-264dd95f9c4b5f8615327d7d7567884591846b9b/node_modules/fswatcher-child/"),
      packageDependencies: new Map([
        ["chokidar", "2.1.0"],
        ["fswatcher-child", "1.1.1"],
      ]),
    }],
  ])],
  ["chokidar", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chokidar-2.1.0-5fcb70d0b28ebe0867eb0f09d5f6a08f29a1efa0/node_modules/chokidar/"),
      packageDependencies: new Map([
        ["anymatch", "2.0.0"],
        ["async-each", "1.0.1"],
        ["braces", "2.3.2"],
        ["glob-parent", "3.1.0"],
        ["inherits", "2.0.3"],
        ["is-binary-path", "1.0.1"],
        ["is-glob", "4.0.0"],
        ["normalize-path", "3.0.0"],
        ["path-is-absolute", "1.0.1"],
        ["readdirp", "2.2.1"],
        ["upath", "1.1.0"],
        ["chokidar", "2.1.0"],
      ]),
    }],
    ["2.1.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chokidar-2.1.6-b6cad653a929e244ce8a834244164d241fa954c5/node_modules/chokidar/"),
      packageDependencies: new Map([
        ["anymatch", "2.0.0"],
        ["async-each", "1.0.1"],
        ["braces", "2.3.2"],
        ["glob-parent", "3.1.0"],
        ["inherits", "2.0.3"],
        ["is-binary-path", "1.0.1"],
        ["is-glob", "4.0.0"],
        ["normalize-path", "3.0.0"],
        ["path-is-absolute", "1.0.1"],
        ["readdirp", "2.2.1"],
        ["upath", "1.1.2"],
        ["chokidar", "2.1.6"],
      ]),
    }],
  ])],
  ["anymatch", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-anymatch-2.0.0-bcb24b4f37934d9aa7ac17b4adaf89e7c76ef2eb/node_modules/anymatch/"),
      packageDependencies: new Map([
        ["micromatch", "3.1.10"],
        ["normalize-path", "2.1.1"],
        ["anymatch", "2.0.0"],
      ]),
    }],
  ])],
  ["micromatch", new Map([
    ["3.1.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-micromatch-3.1.10-70859bc95c9840952f359a068a3fc49f9ecfac23/node_modules/micromatch/"),
      packageDependencies: new Map([
        ["arr-diff", "4.0.0"],
        ["array-unique", "0.3.2"],
        ["braces", "2.3.2"],
        ["define-property", "2.0.2"],
        ["extend-shallow", "3.0.2"],
        ["extglob", "2.0.4"],
        ["fragment-cache", "0.2.1"],
        ["kind-of", "6.0.2"],
        ["nanomatch", "1.2.13"],
        ["object.pick", "1.3.0"],
        ["regex-not", "1.0.2"],
        ["snapdragon", "0.8.2"],
        ["to-regex", "3.0.2"],
        ["micromatch", "3.1.10"],
      ]),
    }],
  ])],
  ["arr-diff", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-arr-diff-4.0.0-d6461074febfec71e7e15235761a329a5dc7c520/node_modules/arr-diff/"),
      packageDependencies: new Map([
        ["arr-diff", "4.0.0"],
      ]),
    }],
  ])],
  ["array-unique", new Map([
    ["0.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-array-unique-0.3.2-a894b75d4bc4f6cd679ef3244a9fd8f46ae2d428/node_modules/array-unique/"),
      packageDependencies: new Map([
        ["array-unique", "0.3.2"],
      ]),
    }],
  ])],
  ["braces", new Map([
    ["2.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-braces-2.3.2-5979fd3f14cd531565e5fa2df1abfff1dfaee729/node_modules/braces/"),
      packageDependencies: new Map([
        ["arr-flatten", "1.1.0"],
        ["array-unique", "0.3.2"],
        ["extend-shallow", "2.0.1"],
        ["fill-range", "4.0.0"],
        ["isobject", "3.0.1"],
        ["repeat-element", "1.1.3"],
        ["snapdragon", "0.8.2"],
        ["snapdragon-node", "2.1.1"],
        ["split-string", "3.1.0"],
        ["to-regex", "3.0.2"],
        ["braces", "2.3.2"],
      ]),
    }],
  ])],
  ["arr-flatten", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-arr-flatten-1.1.0-36048bbff4e7b47e136644316c99669ea5ae91f1/node_modules/arr-flatten/"),
      packageDependencies: new Map([
        ["arr-flatten", "1.1.0"],
      ]),
    }],
  ])],
  ["extend-shallow", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-extend-shallow-2.0.1-51af7d614ad9a9f610ea1bafbb989d6b1c56890f/node_modules/extend-shallow/"),
      packageDependencies: new Map([
        ["is-extendable", "0.1.1"],
        ["extend-shallow", "2.0.1"],
      ]),
    }],
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-extend-shallow-3.0.2-26a71aaf073b39fb2127172746131c2704028db8/node_modules/extend-shallow/"),
      packageDependencies: new Map([
        ["assign-symbols", "1.0.0"],
        ["is-extendable", "1.0.1"],
        ["extend-shallow", "3.0.2"],
      ]),
    }],
  ])],
  ["is-extendable", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-extendable-0.1.1-62b110e289a471418e3ec36a617d472e301dfc89/node_modules/is-extendable/"),
      packageDependencies: new Map([
        ["is-extendable", "0.1.1"],
      ]),
    }],
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-extendable-1.0.1-a7470f9e426733d81bd81e1155264e3a3507cab4/node_modules/is-extendable/"),
      packageDependencies: new Map([
        ["is-plain-object", "2.0.4"],
        ["is-extendable", "1.0.1"],
      ]),
    }],
  ])],
  ["fill-range", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fill-range-4.0.0-d544811d428f98eb06a63dc402d2403c328c38f7/node_modules/fill-range/"),
      packageDependencies: new Map([
        ["extend-shallow", "2.0.1"],
        ["is-number", "3.0.0"],
        ["repeat-string", "1.6.1"],
        ["to-regex-range", "2.1.1"],
        ["fill-range", "4.0.0"],
      ]),
    }],
  ])],
  ["is-number", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-number-3.0.0-24fd6201a4782cf50561c810276afc7d12d71195/node_modules/is-number/"),
      packageDependencies: new Map([
        ["kind-of", "3.2.2"],
        ["is-number", "3.0.0"],
      ]),
    }],
  ])],
  ["kind-of", new Map([
    ["3.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-3.2.2-31ea21a734bab9bbb0f32466d893aea51e4a3c64/node_modules/kind-of/"),
      packageDependencies: new Map([
        ["is-buffer", "1.1.6"],
        ["kind-of", "3.2.2"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-4.0.0-20813df3d712928b207378691a45066fae72dd57/node_modules/kind-of/"),
      packageDependencies: new Map([
        ["is-buffer", "1.1.6"],
        ["kind-of", "4.0.0"],
      ]),
    }],
    ["5.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-5.1.0-729c91e2d857b7a419a1f9aa65685c4c33f5845d/node_modules/kind-of/"),
      packageDependencies: new Map([
        ["kind-of", "5.1.0"],
      ]),
    }],
    ["6.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-6.0.2-01146b36a6218e64e58f3a8d66de5d7fc6f6d051/node_modules/kind-of/"),
      packageDependencies: new Map([
        ["kind-of", "6.0.2"],
      ]),
    }],
  ])],
  ["is-buffer", new Map([
    ["1.1.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-buffer-1.1.6-efaa2ea9daa0d7ab2ea13a97b2b8ad51fefbe8be/node_modules/is-buffer/"),
      packageDependencies: new Map([
        ["is-buffer", "1.1.6"],
      ]),
    }],
  ])],
  ["repeat-string", new Map([
    ["1.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-repeat-string-1.6.1-8dcae470e1c88abc2d600fff4a776286da75e637/node_modules/repeat-string/"),
      packageDependencies: new Map([
        ["repeat-string", "1.6.1"],
      ]),
    }],
  ])],
  ["to-regex-range", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-to-regex-range-2.1.1-7c80c17b9dfebe599e27367e0d4dd5590141db38/node_modules/to-regex-range/"),
      packageDependencies: new Map([
        ["is-number", "3.0.0"],
        ["repeat-string", "1.6.1"],
        ["to-regex-range", "2.1.1"],
      ]),
    }],
  ])],
  ["isobject", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isobject-3.0.1-4e431e92b11a9731636aa1f9c8d1ccbcfdab78df/node_modules/isobject/"),
      packageDependencies: new Map([
        ["isobject", "3.0.1"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isobject-2.1.0-f065561096a3f1da2ef46272f815c840d87e0c89/node_modules/isobject/"),
      packageDependencies: new Map([
        ["isarray", "1.0.0"],
        ["isobject", "2.1.0"],
      ]),
    }],
  ])],
  ["repeat-element", new Map([
    ["1.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-repeat-element-1.1.3-782e0d825c0c5a3bb39731f84efee6b742e6b1ce/node_modules/repeat-element/"),
      packageDependencies: new Map([
        ["repeat-element", "1.1.3"],
      ]),
    }],
  ])],
  ["snapdragon", new Map([
    ["0.8.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-snapdragon-0.8.2-64922e7c565b0e14204ba1aa7d6964278d25182d/node_modules/snapdragon/"),
      packageDependencies: new Map([
        ["base", "0.11.2"],
        ["debug", "2.6.9"],
        ["define-property", "0.2.5"],
        ["extend-shallow", "2.0.1"],
        ["map-cache", "0.2.2"],
        ["source-map", "0.5.7"],
        ["source-map-resolve", "0.5.2"],
        ["use", "3.1.1"],
        ["snapdragon", "0.8.2"],
      ]),
    }],
  ])],
  ["base", new Map([
    ["0.11.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-base-0.11.2-7bde5ced145b6d551a90db87f83c558b4eb48a8f/node_modules/base/"),
      packageDependencies: new Map([
        ["cache-base", "1.0.1"],
        ["class-utils", "0.3.6"],
        ["component-emitter", "1.2.1"],
        ["define-property", "1.0.0"],
        ["isobject", "3.0.1"],
        ["mixin-deep", "1.3.1"],
        ["pascalcase", "0.1.1"],
        ["base", "0.11.2"],
      ]),
    }],
  ])],
  ["cache-base", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cache-base-1.0.1-0a7f46416831c8b662ee36fe4e7c59d76f666ab2/node_modules/cache-base/"),
      packageDependencies: new Map([
        ["collection-visit", "1.0.0"],
        ["component-emitter", "1.2.1"],
        ["get-value", "2.0.6"],
        ["has-value", "1.0.0"],
        ["isobject", "3.0.1"],
        ["set-value", "2.0.0"],
        ["to-object-path", "0.3.0"],
        ["union-value", "1.0.0"],
        ["unset-value", "1.0.0"],
        ["cache-base", "1.0.1"],
      ]),
    }],
  ])],
  ["collection-visit", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-collection-visit-1.0.0-4bc0373c164bc3291b4d368c829cf1a80a59dca0/node_modules/collection-visit/"),
      packageDependencies: new Map([
        ["map-visit", "1.0.0"],
        ["object-visit", "1.0.1"],
        ["collection-visit", "1.0.0"],
      ]),
    }],
  ])],
  ["map-visit", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-map-visit-1.0.0-ecdca8f13144e660f1b5bd41f12f3479d98dfb8f/node_modules/map-visit/"),
      packageDependencies: new Map([
        ["object-visit", "1.0.1"],
        ["map-visit", "1.0.0"],
      ]),
    }],
  ])],
  ["object-visit", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-object-visit-1.0.1-f79c4493af0c5377b59fe39d395e41042dd045bb/node_modules/object-visit/"),
      packageDependencies: new Map([
        ["isobject", "3.0.1"],
        ["object-visit", "1.0.1"],
      ]),
    }],
  ])],
  ["component-emitter", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-component-emitter-1.2.1-137918d6d78283f7df7a6b7c5a63e140e69425e6/node_modules/component-emitter/"),
      packageDependencies: new Map([
        ["component-emitter", "1.2.1"],
      ]),
    }],
  ])],
  ["get-value", new Map([
    ["2.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-get-value-2.0.6-dc15ca1c672387ca76bd37ac0a395ba2042a2c28/node_modules/get-value/"),
      packageDependencies: new Map([
        ["get-value", "2.0.6"],
      ]),
    }],
  ])],
  ["has-value", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-value-1.0.0-18b281da585b1c5c51def24c930ed29a0be6b177/node_modules/has-value/"),
      packageDependencies: new Map([
        ["get-value", "2.0.6"],
        ["has-values", "1.0.0"],
        ["isobject", "3.0.1"],
        ["has-value", "1.0.0"],
      ]),
    }],
    ["0.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-value-0.3.1-7b1f58bada62ca827ec0a2078025654845995e1f/node_modules/has-value/"),
      packageDependencies: new Map([
        ["get-value", "2.0.6"],
        ["has-values", "0.1.4"],
        ["isobject", "2.1.0"],
        ["has-value", "0.3.1"],
      ]),
    }],
  ])],
  ["has-values", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-values-1.0.0-95b0b63fec2146619a6fe57fe75628d5a39efe4f/node_modules/has-values/"),
      packageDependencies: new Map([
        ["is-number", "3.0.0"],
        ["kind-of", "4.0.0"],
        ["has-values", "1.0.0"],
      ]),
    }],
    ["0.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-values-0.1.4-6d61de95d91dfca9b9a02089ad384bff8f62b771/node_modules/has-values/"),
      packageDependencies: new Map([
        ["has-values", "0.1.4"],
      ]),
    }],
  ])],
  ["set-value", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-set-value-2.0.0-71ae4a88f0feefbbf52d1ea604f3fb315ebb6274/node_modules/set-value/"),
      packageDependencies: new Map([
        ["extend-shallow", "2.0.1"],
        ["is-extendable", "0.1.1"],
        ["is-plain-object", "2.0.4"],
        ["split-string", "3.1.0"],
        ["set-value", "2.0.0"],
      ]),
    }],
    ["0.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-set-value-0.4.3-7db08f9d3d22dc7f78e53af3c3bf4666ecdfccf1/node_modules/set-value/"),
      packageDependencies: new Map([
        ["extend-shallow", "2.0.1"],
        ["is-extendable", "0.1.1"],
        ["is-plain-object", "2.0.4"],
        ["to-object-path", "0.3.0"],
        ["set-value", "0.4.3"],
      ]),
    }],
  ])],
  ["is-plain-object", new Map([
    ["2.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-plain-object-2.0.4-2c163b3fafb1b606d9d17928f05c2a1c38e07677/node_modules/is-plain-object/"),
      packageDependencies: new Map([
        ["isobject", "3.0.1"],
        ["is-plain-object", "2.0.4"],
      ]),
    }],
  ])],
  ["split-string", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-split-string-3.1.0-7cb09dda3a86585705c64b39a6466038682e8fe2/node_modules/split-string/"),
      packageDependencies: new Map([
        ["extend-shallow", "3.0.2"],
        ["split-string", "3.1.0"],
      ]),
    }],
  ])],
  ["assign-symbols", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-assign-symbols-1.0.0-59667f41fadd4f20ccbc2bb96b8d4f7f78ec0367/node_modules/assign-symbols/"),
      packageDependencies: new Map([
        ["assign-symbols", "1.0.0"],
      ]),
    }],
  ])],
  ["to-object-path", new Map([
    ["0.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-to-object-path-0.3.0-297588b7b0e7e0ac08e04e672f85c1f4999e17af/node_modules/to-object-path/"),
      packageDependencies: new Map([
        ["kind-of", "3.2.2"],
        ["to-object-path", "0.3.0"],
      ]),
    }],
  ])],
  ["union-value", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-union-value-1.0.0-5c71c34cb5bad5dcebe3ea0cd08207ba5aa1aea4/node_modules/union-value/"),
      packageDependencies: new Map([
        ["arr-union", "3.1.0"],
        ["get-value", "2.0.6"],
        ["is-extendable", "0.1.1"],
        ["set-value", "0.4.3"],
        ["union-value", "1.0.0"],
      ]),
    }],
  ])],
  ["arr-union", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-arr-union-3.1.0-e39b09aea9def866a8f206e288af63919bae39c4/node_modules/arr-union/"),
      packageDependencies: new Map([
        ["arr-union", "3.1.0"],
      ]),
    }],
  ])],
  ["unset-value", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unset-value-1.0.0-8376873f7d2335179ffb1e6fc3a8ed0dfc8ab559/node_modules/unset-value/"),
      packageDependencies: new Map([
        ["has-value", "0.3.1"],
        ["isobject", "3.0.1"],
        ["unset-value", "1.0.0"],
      ]),
    }],
  ])],
  ["isarray", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isarray-1.0.0-bb935d48582cba168c06834957a54a3e07124f11/node_modules/isarray/"),
      packageDependencies: new Map([
        ["isarray", "1.0.0"],
      ]),
    }],
    ["0.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isarray-0.0.1-8a18acfca9a8f4177e09abfc6038939b05d1eedf/node_modules/isarray/"),
      packageDependencies: new Map([
        ["isarray", "0.0.1"],
      ]),
    }],
  ])],
  ["class-utils", new Map([
    ["0.3.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-class-utils-0.3.6-f93369ae8b9a7ce02fd41faad0ca83033190c463/node_modules/class-utils/"),
      packageDependencies: new Map([
        ["arr-union", "3.1.0"],
        ["define-property", "0.2.5"],
        ["isobject", "3.0.1"],
        ["static-extend", "0.1.2"],
        ["class-utils", "0.3.6"],
      ]),
    }],
  ])],
  ["define-property", new Map([
    ["0.2.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-define-property-0.2.5-c35b1ef918ec3c990f9a5bc57be04aacec5c8116/node_modules/define-property/"),
      packageDependencies: new Map([
        ["is-descriptor", "0.1.6"],
        ["define-property", "0.2.5"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-define-property-1.0.0-769ebaaf3f4a63aad3af9e8d304c9bbe79bfb0e6/node_modules/define-property/"),
      packageDependencies: new Map([
        ["is-descriptor", "1.0.2"],
        ["define-property", "1.0.0"],
      ]),
    }],
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-define-property-2.0.2-d459689e8d654ba77e02a817f8710d702cb16e9d/node_modules/define-property/"),
      packageDependencies: new Map([
        ["is-descriptor", "1.0.2"],
        ["isobject", "3.0.1"],
        ["define-property", "2.0.2"],
      ]),
    }],
  ])],
  ["is-descriptor", new Map([
    ["0.1.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-descriptor-0.1.6-366d8240dde487ca51823b1ab9f07a10a78251ca/node_modules/is-descriptor/"),
      packageDependencies: new Map([
        ["is-accessor-descriptor", "0.1.6"],
        ["is-data-descriptor", "0.1.4"],
        ["kind-of", "5.1.0"],
        ["is-descriptor", "0.1.6"],
      ]),
    }],
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-descriptor-1.0.2-3b159746a66604b04f8c81524ba365c5f14d86ec/node_modules/is-descriptor/"),
      packageDependencies: new Map([
        ["is-accessor-descriptor", "1.0.0"],
        ["is-data-descriptor", "1.0.0"],
        ["kind-of", "6.0.2"],
        ["is-descriptor", "1.0.2"],
      ]),
    }],
  ])],
  ["is-accessor-descriptor", new Map([
    ["0.1.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-accessor-descriptor-0.1.6-a9e12cb3ae8d876727eeef3843f8a0897b5c98d6/node_modules/is-accessor-descriptor/"),
      packageDependencies: new Map([
        ["kind-of", "3.2.2"],
        ["is-accessor-descriptor", "0.1.6"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-accessor-descriptor-1.0.0-169c2f6d3df1f992618072365c9b0ea1f6878656/node_modules/is-accessor-descriptor/"),
      packageDependencies: new Map([
        ["kind-of", "6.0.2"],
        ["is-accessor-descriptor", "1.0.0"],
      ]),
    }],
  ])],
  ["is-data-descriptor", new Map([
    ["0.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-data-descriptor-0.1.4-0b5ee648388e2c860282e793f1856fec3f301b56/node_modules/is-data-descriptor/"),
      packageDependencies: new Map([
        ["kind-of", "3.2.2"],
        ["is-data-descriptor", "0.1.4"],
      ]),
    }],
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-data-descriptor-1.0.0-d84876321d0e7add03990406abbbbd36ba9268c7/node_modules/is-data-descriptor/"),
      packageDependencies: new Map([
        ["kind-of", "6.0.2"],
        ["is-data-descriptor", "1.0.0"],
      ]),
    }],
  ])],
  ["static-extend", new Map([
    ["0.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-static-extend-0.1.2-60809c39cbff55337226fd5e0b520f341f1fb5c6/node_modules/static-extend/"),
      packageDependencies: new Map([
        ["define-property", "0.2.5"],
        ["object-copy", "0.1.0"],
        ["static-extend", "0.1.2"],
      ]),
    }],
  ])],
  ["object-copy", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-object-copy-0.1.0-7e7d858b781bd7c991a41ba975ed3812754e998c/node_modules/object-copy/"),
      packageDependencies: new Map([
        ["copy-descriptor", "0.1.1"],
        ["define-property", "0.2.5"],
        ["kind-of", "3.2.2"],
        ["object-copy", "0.1.0"],
      ]),
    }],
  ])],
  ["copy-descriptor", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-copy-descriptor-0.1.1-676f6eb3c39997c2ee1ac3a924fd6124748f578d/node_modules/copy-descriptor/"),
      packageDependencies: new Map([
        ["copy-descriptor", "0.1.1"],
      ]),
    }],
  ])],
  ["mixin-deep", new Map([
    ["1.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mixin-deep-1.3.1-a49e7268dce1a0d9698e45326c5626df3543d0fe/node_modules/mixin-deep/"),
      packageDependencies: new Map([
        ["for-in", "1.0.2"],
        ["is-extendable", "1.0.1"],
        ["mixin-deep", "1.3.1"],
      ]),
    }],
  ])],
  ["for-in", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-for-in-1.0.2-81068d295a8142ec0ac726c6e2200c30fb6d5e80/node_modules/for-in/"),
      packageDependencies: new Map([
        ["for-in", "1.0.2"],
      ]),
    }],
  ])],
  ["pascalcase", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pascalcase-0.1.1-b363e55e8006ca6fe21784d2db22bd15d7917f14/node_modules/pascalcase/"),
      packageDependencies: new Map([
        ["pascalcase", "0.1.1"],
      ]),
    }],
  ])],
  ["map-cache", new Map([
    ["0.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-map-cache-0.2.2-c32abd0bd6525d9b051645bb4f26ac5dc98a0dbf/node_modules/map-cache/"),
      packageDependencies: new Map([
        ["map-cache", "0.2.2"],
      ]),
    }],
  ])],
  ["source-map-resolve", new Map([
    ["0.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-source-map-resolve-0.5.2-72e2cc34095543e43b2c62b2c4c10d4a9054f259/node_modules/source-map-resolve/"),
      packageDependencies: new Map([
        ["atob", "2.1.2"],
        ["decode-uri-component", "0.2.0"],
        ["resolve-url", "0.2.1"],
        ["source-map-url", "0.4.0"],
        ["urix", "0.1.0"],
        ["source-map-resolve", "0.5.2"],
      ]),
    }],
  ])],
  ["atob", new Map([
    ["2.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-atob-2.1.2-6d9517eb9e030d2436666651e86bd9f6f13533c9/node_modules/atob/"),
      packageDependencies: new Map([
        ["atob", "2.1.2"],
      ]),
    }],
  ])],
  ["decode-uri-component", new Map([
    ["0.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-decode-uri-component-0.2.0-eb3913333458775cb84cd1a1fae062106bb87545/node_modules/decode-uri-component/"),
      packageDependencies: new Map([
        ["decode-uri-component", "0.2.0"],
      ]),
    }],
  ])],
  ["resolve-url", new Map([
    ["0.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-resolve-url-0.2.1-2c637fe77c893afd2a663fe21aa9080068e2052a/node_modules/resolve-url/"),
      packageDependencies: new Map([
        ["resolve-url", "0.2.1"],
      ]),
    }],
  ])],
  ["source-map-url", new Map([
    ["0.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-source-map-url-0.4.0-3e935d7ddd73631b97659956d55128e87b5084a3/node_modules/source-map-url/"),
      packageDependencies: new Map([
        ["source-map-url", "0.4.0"],
      ]),
    }],
  ])],
  ["urix", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-urix-0.1.0-da937f7a62e21fec1fd18d49b35c2935067a6c72/node_modules/urix/"),
      packageDependencies: new Map([
        ["urix", "0.1.0"],
      ]),
    }],
  ])],
  ["use", new Map([
    ["3.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-use-3.1.1-d50c8cac79a19fbc20f2911f56eb973f4e10070f/node_modules/use/"),
      packageDependencies: new Map([
        ["use", "3.1.1"],
      ]),
    }],
  ])],
  ["snapdragon-node", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-snapdragon-node-2.1.1-6c175f86ff14bdb0724563e8f3c1b021a286853b/node_modules/snapdragon-node/"),
      packageDependencies: new Map([
        ["define-property", "1.0.0"],
        ["isobject", "3.0.1"],
        ["snapdragon-util", "3.0.1"],
        ["snapdragon-node", "2.1.1"],
      ]),
    }],
  ])],
  ["snapdragon-util", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-snapdragon-util-3.0.1-f956479486f2acd79700693f6f7b805e45ab56e2/node_modules/snapdragon-util/"),
      packageDependencies: new Map([
        ["kind-of", "3.2.2"],
        ["snapdragon-util", "3.0.1"],
      ]),
    }],
  ])],
  ["to-regex", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-to-regex-3.0.2-13cfdd9b336552f30b51f33a8ae1b42a7a7599ce/node_modules/to-regex/"),
      packageDependencies: new Map([
        ["define-property", "2.0.2"],
        ["extend-shallow", "3.0.2"],
        ["regex-not", "1.0.2"],
        ["safe-regex", "1.1.0"],
        ["to-regex", "3.0.2"],
      ]),
    }],
  ])],
  ["regex-not", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regex-not-1.0.2-1f4ece27e00b0b65e0247a6810e6a85d83a5752c/node_modules/regex-not/"),
      packageDependencies: new Map([
        ["extend-shallow", "3.0.2"],
        ["safe-regex", "1.1.0"],
        ["regex-not", "1.0.2"],
      ]),
    }],
  ])],
  ["safe-regex", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-safe-regex-1.1.0-40a3669f3b077d1e943d44629e157dd48023bf2e/node_modules/safe-regex/"),
      packageDependencies: new Map([
        ["ret", "0.1.15"],
        ["safe-regex", "1.1.0"],
      ]),
    }],
  ])],
  ["ret", new Map([
    ["0.1.15", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ret-0.1.15-b8a4825d5bdb1fc3f6f53c2bc33f81388681c7bc/node_modules/ret/"),
      packageDependencies: new Map([
        ["ret", "0.1.15"],
      ]),
    }],
  ])],
  ["extglob", new Map([
    ["2.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-extglob-2.0.4-ad00fe4dc612a9232e8718711dc5cb5ab0285543/node_modules/extglob/"),
      packageDependencies: new Map([
        ["array-unique", "0.3.2"],
        ["define-property", "1.0.0"],
        ["expand-brackets", "2.1.4"],
        ["extend-shallow", "2.0.1"],
        ["fragment-cache", "0.2.1"],
        ["regex-not", "1.0.2"],
        ["snapdragon", "0.8.2"],
        ["to-regex", "3.0.2"],
        ["extglob", "2.0.4"],
      ]),
    }],
  ])],
  ["expand-brackets", new Map([
    ["2.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-expand-brackets-2.1.4-b77735e315ce30f6b6eff0f83b04151a22449622/node_modules/expand-brackets/"),
      packageDependencies: new Map([
        ["debug", "2.6.9"],
        ["define-property", "0.2.5"],
        ["extend-shallow", "2.0.1"],
        ["posix-character-classes", "0.1.1"],
        ["regex-not", "1.0.2"],
        ["snapdragon", "0.8.2"],
        ["to-regex", "3.0.2"],
        ["expand-brackets", "2.1.4"],
      ]),
    }],
  ])],
  ["posix-character-classes", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-posix-character-classes-0.1.1-01eac0fe3b5af71a2a6c02feabb8c1fef7e00eab/node_modules/posix-character-classes/"),
      packageDependencies: new Map([
        ["posix-character-classes", "0.1.1"],
      ]),
    }],
  ])],
  ["fragment-cache", new Map([
    ["0.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fragment-cache-0.2.1-4290fad27f13e89be7f33799c6bc5a0abfff0d19/node_modules/fragment-cache/"),
      packageDependencies: new Map([
        ["map-cache", "0.2.2"],
        ["fragment-cache", "0.2.1"],
      ]),
    }],
  ])],
  ["nanomatch", new Map([
    ["1.2.13", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-nanomatch-1.2.13-b87a8aa4fc0de8fe6be88895b38983ff265bd119/node_modules/nanomatch/"),
      packageDependencies: new Map([
        ["arr-diff", "4.0.0"],
        ["array-unique", "0.3.2"],
        ["define-property", "2.0.2"],
        ["extend-shallow", "3.0.2"],
        ["fragment-cache", "0.2.1"],
        ["is-windows", "1.0.2"],
        ["kind-of", "6.0.2"],
        ["object.pick", "1.3.0"],
        ["regex-not", "1.0.2"],
        ["snapdragon", "0.8.2"],
        ["to-regex", "3.0.2"],
        ["nanomatch", "1.2.13"],
      ]),
    }],
  ])],
  ["is-windows", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-windows-1.0.2-d1850eb9791ecd18e6182ce12a30f396634bb19d/node_modules/is-windows/"),
      packageDependencies: new Map([
        ["is-windows", "1.0.2"],
      ]),
    }],
  ])],
  ["object.pick", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-object-pick-1.3.0-87a10ac4c1694bd2e1cbf53591a66141fb5dd747/node_modules/object.pick/"),
      packageDependencies: new Map([
        ["isobject", "3.0.1"],
        ["object.pick", "1.3.0"],
      ]),
    }],
  ])],
  ["normalize-path", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-normalize-path-2.1.1-1ab28b556e198363a8c1a6f7e6fa20137fe6aed9/node_modules/normalize-path/"),
      packageDependencies: new Map([
        ["remove-trailing-separator", "1.1.0"],
        ["normalize-path", "2.1.1"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-normalize-path-3.0.0-0dcd69ff23a1c9b11fd0978316644a0388216a65/node_modules/normalize-path/"),
      packageDependencies: new Map([
        ["normalize-path", "3.0.0"],
      ]),
    }],
  ])],
  ["remove-trailing-separator", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-remove-trailing-separator-1.1.0-c24bce2a283adad5bc3f58e0d48249b92379d8ef/node_modules/remove-trailing-separator/"),
      packageDependencies: new Map([
        ["remove-trailing-separator", "1.1.0"],
      ]),
    }],
  ])],
  ["async-each", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-async-each-1.0.1-19d386a1d9edc6e7c1c85d388aedbcc56d33602d/node_modules/async-each/"),
      packageDependencies: new Map([
        ["async-each", "1.0.1"],
      ]),
    }],
  ])],
  ["glob-parent", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-glob-parent-3.1.0-9e6af6299d8d3bd2bd40430832bd113df906c5ae/node_modules/glob-parent/"),
      packageDependencies: new Map([
        ["is-glob", "3.1.0"],
        ["path-dirname", "1.0.2"],
        ["glob-parent", "3.1.0"],
      ]),
    }],
  ])],
  ["is-glob", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-glob-3.1.0-7ba5ae24217804ac70707b96922567486cc3e84a/node_modules/is-glob/"),
      packageDependencies: new Map([
        ["is-extglob", "2.1.1"],
        ["is-glob", "3.1.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-glob-4.0.0-9521c76845cc2610a85203ddf080a958c2ffabc0/node_modules/is-glob/"),
      packageDependencies: new Map([
        ["is-extglob", "2.1.1"],
        ["is-glob", "4.0.0"],
      ]),
    }],
  ])],
  ["is-extglob", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-extglob-2.1.1-a88c02535791f02ed37c76a1b9ea9773c833f8c2/node_modules/is-extglob/"),
      packageDependencies: new Map([
        ["is-extglob", "2.1.1"],
      ]),
    }],
  ])],
  ["path-dirname", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-dirname-1.0.2-cc33d24d525e099a5388c0336c6e32b9160609e0/node_modules/path-dirname/"),
      packageDependencies: new Map([
        ["path-dirname", "1.0.2"],
      ]),
    }],
  ])],
  ["inherits", new Map([
    ["2.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-inherits-2.0.3-633c2c83e3da42a502f52466022480f4208261de/node_modules/inherits/"),
      packageDependencies: new Map([
        ["inherits", "2.0.3"],
      ]),
    }],
  ])],
  ["is-binary-path", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-binary-path-1.0.1-75f16642b480f187a711c814161fd3a4a7655898/node_modules/is-binary-path/"),
      packageDependencies: new Map([
        ["binary-extensions", "1.13.0"],
        ["is-binary-path", "1.0.1"],
      ]),
    }],
  ])],
  ["binary-extensions", new Map([
    ["1.13.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-binary-extensions-1.13.0-9523e001306a32444b907423f1de2164222f6ab1/node_modules/binary-extensions/"),
      packageDependencies: new Map([
        ["binary-extensions", "1.13.0"],
      ]),
    }],
  ])],
  ["path-is-absolute", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-is-absolute-1.0.1-174b9268735534ffbc7ace6bf53a5a9e1b5c5f5f/node_modules/path-is-absolute/"),
      packageDependencies: new Map([
        ["path-is-absolute", "1.0.1"],
      ]),
    }],
  ])],
  ["readdirp", new Map([
    ["2.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-readdirp-2.2.1-0e87622a3325aa33e892285caf8b4e846529a525/node_modules/readdirp/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["micromatch", "3.1.10"],
        ["readable-stream", "2.3.6"],
        ["readdirp", "2.2.1"],
      ]),
    }],
  ])],
  ["readable-stream", new Map([
    ["2.3.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-readable-stream-2.3.6-b11c27d88b8ff1fbe070643cf94b0c79ae1b0aaf/node_modules/readable-stream/"),
      packageDependencies: new Map([
        ["core-util-is", "1.0.2"],
        ["inherits", "2.0.3"],
        ["isarray", "1.0.0"],
        ["process-nextick-args", "2.0.0"],
        ["safe-buffer", "5.1.2"],
        ["string_decoder", "1.1.1"],
        ["util-deprecate", "1.0.2"],
        ["readable-stream", "2.3.6"],
      ]),
    }],
  ])],
  ["core-util-is", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-util-is-1.0.2-b5fd54220aa2bc5ab57aab7140c940754503c1a7/node_modules/core-util-is/"),
      packageDependencies: new Map([
        ["core-util-is", "1.0.2"],
      ]),
    }],
  ])],
  ["process-nextick-args", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-process-nextick-args-2.0.0-a37d732f4271b4ab1ad070d35508e8290788ffaa/node_modules/process-nextick-args/"),
      packageDependencies: new Map([
        ["process-nextick-args", "2.0.0"],
      ]),
    }],
  ])],
  ["string_decoder", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-string-decoder-1.1.1-9cf1611ba62685d7030ae9e4ba34149c3af03fc8/node_modules/string_decoder/"),
      packageDependencies: new Map([
        ["safe-buffer", "5.1.2"],
        ["string_decoder", "1.1.1"],
      ]),
    }],
  ])],
  ["util-deprecate", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-util-deprecate-1.0.2-450d4dc9fa70de732762fbd2d4a28981419a0ccf/node_modules/util-deprecate/"),
      packageDependencies: new Map([
        ["util-deprecate", "1.0.2"],
      ]),
    }],
  ])],
  ["upath", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-upath-1.1.0-35256597e46a581db4793d0ce47fa9aebfc9fabd/node_modules/upath/"),
      packageDependencies: new Map([
        ["upath", "1.1.0"],
      ]),
    }],
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-upath-1.1.2-3db658600edaeeccbe6db5e684d67ee8c2acd068/node_modules/upath/"),
      packageDependencies: new Map([
        ["upath", "1.1.2"],
      ]),
    }],
  ])],
  ["graphviz", new Map([
    ["0.0.9", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-graphviz-0.0.9-0bbf1df588c6a92259282da35323622528c4bbc4/node_modules/graphviz/"),
      packageDependencies: new Map([
        ["temp", "0.4.0"],
        ["graphviz", "0.0.9"],
      ]),
    }],
  ])],
  ["temp", new Map([
    ["0.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-temp-0.4.0-671ad63d57be0fe9d7294664b3fc400636678a60/node_modules/temp/"),
      packageDependencies: new Map([
        ["temp", "0.4.0"],
      ]),
    }],
  ])],
  ["ora", new Map([
    ["3.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ora-3.4.0-bf0752491059a3ef3ed4c85097531de9fdbcd318/node_modules/ora/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["cli-cursor", "2.1.0"],
        ["cli-spinners", "2.0.0"],
        ["log-symbols", "2.2.0"],
        ["strip-ansi", "5.2.0"],
        ["wcwidth", "1.0.1"],
        ["ora", "3.4.0"],
      ]),
    }],
    ["3.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ora-3.2.0-67e98a7e11f7f0ac95deaaaf11bb04de3d09e481/node_modules/ora/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["cli-cursor", "2.1.0"],
        ["cli-spinners", "2.0.0"],
        ["log-symbols", "2.2.0"],
        ["strip-ansi", "5.0.0"],
        ["wcwidth", "1.0.1"],
        ["ora", "3.2.0"],
      ]),
    }],
  ])],
  ["cli-cursor", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-cursor-2.1.0-b35dac376479facc3e94747d41d0d0f5238ffcb5/node_modules/cli-cursor/"),
      packageDependencies: new Map([
        ["restore-cursor", "2.0.0"],
        ["cli-cursor", "2.1.0"],
      ]),
    }],
  ])],
  ["restore-cursor", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-restore-cursor-2.0.0-9f7ee287f82fd326d4fd162923d62129eee0dfaf/node_modules/restore-cursor/"),
      packageDependencies: new Map([
        ["onetime", "2.0.1"],
        ["signal-exit", "3.0.2"],
        ["restore-cursor", "2.0.0"],
      ]),
    }],
  ])],
  ["onetime", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-onetime-2.0.1-067428230fd67443b2794b22bba528b6867962d4/node_modules/onetime/"),
      packageDependencies: new Map([
        ["mimic-fn", "1.2.0"],
        ["onetime", "2.0.1"],
      ]),
    }],
  ])],
  ["cli-spinners", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-spinners-2.0.0-4b078756fc17a8f72043fdc9f1f14bf4fa87e2df/node_modules/cli-spinners/"),
      packageDependencies: new Map([
        ["cli-spinners", "2.0.0"],
      ]),
    }],
  ])],
  ["log-symbols", new Map([
    ["2.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-log-symbols-2.2.0-5740e1c5d6f0dfda4ad9323b5332107ef6b4c40a/node_modules/log-symbols/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["log-symbols", "2.2.0"],
      ]),
    }],
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-log-symbols-1.0.2-376ff7b58ea3086a0f09facc74617eca501e1a18/node_modules/log-symbols/"),
      packageDependencies: new Map([
        ["chalk", "1.1.3"],
        ["log-symbols", "1.0.2"],
      ]),
    }],
  ])],
  ["wcwidth", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-wcwidth-1.0.1-f0b0dcf915bc5ff1528afadb2c0e17b532da2fe8/node_modules/wcwidth/"),
      packageDependencies: new Map([
        ["defaults", "1.0.3"],
        ["wcwidth", "1.0.1"],
      ]),
    }],
  ])],
  ["defaults", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-defaults-1.0.3-c656051e9817d9ff08ed881477f3fe4019f3ef7d/node_modules/defaults/"),
      packageDependencies: new Map([
        ["clone", "1.0.4"],
        ["defaults", "1.0.3"],
      ]),
    }],
  ])],
  ["clone", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-clone-1.0.4-da309cc263df15994c688ca902179ca3c7cd7c7e/node_modules/clone/"),
      packageDependencies: new Map([
        ["clone", "1.0.4"],
      ]),
    }],
  ])],
  ["parse5", new Map([
    ["5.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parse5-5.1.0-c59341c9723f414c452975564c7c00a68d58acd2/node_modules/parse5/"),
      packageDependencies: new Map([
        ["parse5", "5.1.0"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parse5-4.0.0-6d78656e3da8d78b4ec0b906f7c08ef1dfe3f608/node_modules/parse5/"),
      packageDependencies: new Map([
        ["parse5", "4.0.0"],
      ]),
    }],
  ])],
  ["pretty-bytes", new Map([
    ["5.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pretty-bytes-5.2.0-96c92c6e95a0b35059253fb33c03e260d40f5a1f/node_modules/pretty-bytes/"),
      packageDependencies: new Map([
        ["pretty-bytes", "5.2.0"],
      ]),
    }],
    ["4.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pretty-bytes-4.0.2-b2bf82e7350d65c6c33aa95aaa5a4f6327f61cd9/node_modules/pretty-bytes/"),
      packageDependencies: new Map([
        ["pretty-bytes", "4.0.2"],
      ]),
    }],
  ])],
  ["ws", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ws-7.0.0-79351cbc3f784b3c20d0821baf4b4ff809ffbf51/node_modules/ws/"),
      packageDependencies: new Map([
        ["async-limiter", "1.0.0"],
        ["ws", "7.0.0"],
      ]),
    }],
    ["5.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ws-5.2.2-dffef14866b8e8dc9133582514d1befaf96e980f/node_modules/ws/"),
      packageDependencies: new Map([
        ["async-limiter", "1.0.0"],
        ["ws", "5.2.2"],
      ]),
    }],
  ])],
  ["async-limiter", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-async-limiter-1.0.0-78faed8c3d074ab81f22b4e985d79e8738f720f8/node_modules/async-limiter/"),
      packageDependencies: new Map([
        ["async-limiter", "1.0.0"],
      ]),
    }],
  ])],
  ["@babel/preset-env", new Map([
    ["7.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-preset-env-7.4.2-2f5ba1de2daefa9dcca653848f96c7ce2e406676/node_modules/@babel/preset-env/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-proposal-async-generator-functions", "pnp:c9bc4575bb4c144ef417ebbafd47b3b8295af064"],
        ["@babel/plugin-proposal-json-strings", "pnp:68ec4f6bc76d657bdeb2cc59bd8137cc968fe627"],
        ["@babel/plugin-proposal-object-rest-spread", "7.4.0"],
        ["@babel/plugin-proposal-optional-catch-binding", "pnp:d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2"],
        ["@babel/plugin-proposal-unicode-property-regex", "7.4.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:2dc40106cf8fd126426ad6195234ec72dbcfaf39"],
        ["@babel/plugin-syntax-json-strings", "pnp:3fce135b2c9687a3ba481074ff3a21fb1421630c"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:f21c2711308277c29808d40b71d3469926161e85"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:225721100e9193a34544da90564940816d04a0f3"],
        ["@babel/plugin-transform-arrow-functions", "pnp:705e525ab6be3fa50fb9ef4e48cf128f32a3cc22"],
        ["@babel/plugin-transform-async-to-generator", "7.4.0"],
        ["@babel/plugin-transform-block-scoped-functions", "pnp:b8d36a0e178b88992b847671a432a570de7b2a01"],
        ["@babel/plugin-transform-block-scoping", "7.4.0"],
        ["@babel/plugin-transform-classes", "7.4.0"],
        ["@babel/plugin-transform-computed-properties", "pnp:7833a827b64ccae1f1110308a462b3cecb5f9e99"],
        ["@babel/plugin-transform-destructuring", "7.4.0"],
        ["@babel/plugin-transform-dotall-regex", "7.2.0"],
        ["@babel/plugin-transform-duplicate-keys", "pnp:2c1efb2908ba15d96fa6c471d52e1c06e6a35136"],
        ["@babel/plugin-transform-exponentiation-operator", "pnp:f4ed7a7493b7db746c46fd71274457a6b37dacf8"],
        ["@babel/plugin-transform-for-of", "7.4.0"],
        ["@babel/plugin-transform-function-name", "7.2.0"],
        ["@babel/plugin-transform-literals", "pnp:928eb25abee04aa2ef762c675400efb2058f9313"],
        ["@babel/plugin-transform-modules-amd", "pnp:706179cadfc9260a128e03f81f4b6e353114732a"],
        ["@babel/plugin-transform-modules-commonjs", "7.4.0"],
        ["@babel/plugin-transform-modules-systemjs", "7.4.0"],
        ["@babel/plugin-transform-modules-umd", "pnp:07b0af85a2cecc3ce69934c8ce0f82220a29e1df"],
        ["@babel/plugin-transform-named-capturing-groups-regex", "7.4.2"],
        ["@babel/plugin-transform-new-target", "7.4.0"],
        ["@babel/plugin-transform-object-super", "pnp:3ce0792a866dfb9f9666453725275d742cb07516"],
        ["@babel/plugin-transform-parameters", "7.4.0"],
        ["@babel/plugin-transform-regenerator", "7.4.0"],
        ["@babel/plugin-transform-shorthand-properties", "pnp:6706f7f88678021374b6601dff1304cc39f28df2"],
        ["@babel/plugin-transform-spread", "pnp:531a3ec66b00c112c32da4c3169cb60e29e256e0"],
        ["@babel/plugin-transform-sticky-regex", "pnp:d0e0051d5601f7731706c6a83567ab381606682d"],
        ["@babel/plugin-transform-template-literals", "7.2.0"],
        ["@babel/plugin-transform-typeof-symbol", "pnp:15ab85d1e18ca8a2f7e59e350db294bf7f835467"],
        ["@babel/plugin-transform-unicode-regex", "7.2.0"],
        ["@babel/types", "7.4.0"],
        ["browserslist", "4.5.2"],
        ["core-js-compat", "3.0.0"],
        ["invariant", "2.2.4"],
        ["js-levenshtein", "1.1.6"],
        ["semver", "5.6.0"],
        ["@babel/preset-env", "7.4.2"],
      ]),
    }],
    ["pnp:0fcb8a86302027dee988c72e7fda9a303025484a", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-0fcb8a86302027dee988c72e7fda9a303025484a/node_modules/@babel/preset-env/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-proposal-async-generator-functions", "pnp:0fcba5ab8fb387ed9474092e019695c05c2078d1"],
        ["@babel/plugin-proposal-json-strings", "pnp:e6558ae27eed106acc73f522796abf89e5cc93f6"],
        ["@babel/plugin-proposal-object-rest-spread", "pnp:d21a38d0695bb92bc896c7afeebcfc9e3c3a1464"],
        ["@babel/plugin-proposal-optional-catch-binding", "pnp:58301a8687a35c191f6b7ba378cc2feb3e9e8bd6"],
        ["@babel/plugin-proposal-unicode-property-regex", "7.4.4"],
        ["@babel/plugin-syntax-async-generators", "pnp:bdb015bb034f3f82084dfacd1ba186a4212bc8c5"],
        ["@babel/plugin-syntax-json-strings", "pnp:87accb40ed4635b97081c874891070fcaea08d37"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:04416ed1deece382c5ecb0ef2759dc1c8ea12290"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:17df0d674d7ac439f303b29abc0b89de84450201"],
        ["@babel/plugin-transform-arrow-functions", "pnp:a81271c9accc4c94a60061b6c7d9ed4f566e633d"],
        ["@babel/plugin-transform-async-to-generator", "7.4.4"],
        ["@babel/plugin-transform-block-scoped-functions", "pnp:dba325a89899ca82a1bce94e52fe46c9eb3ef76c"],
        ["@babel/plugin-transform-block-scoping", "7.4.4"],
        ["@babel/plugin-transform-classes", "7.4.4"],
        ["@babel/plugin-transform-computed-properties", "pnp:cccec504e039f73d05407aac79b4545b3d9e0fee"],
        ["@babel/plugin-transform-destructuring", "7.4.4"],
        ["@babel/plugin-transform-dotall-regex", "7.4.4"],
        ["@babel/plugin-transform-duplicate-keys", "pnp:e104fc3b299ecc9e424fe88ef169be4ff387ea9a"],
        ["@babel/plugin-transform-exponentiation-operator", "pnp:585f461e43b2ed57e91c98f770ce10675ca460a0"],
        ["@babel/plugin-transform-for-of", "7.4.4"],
        ["@babel/plugin-transform-function-name", "7.4.4"],
        ["@babel/plugin-transform-literals", "pnp:1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64"],
        ["@babel/plugin-transform-member-expression-literals", "7.2.0"],
        ["@babel/plugin-transform-modules-amd", "pnp:854ff2a92da13ec2571fd6ca44727c5f2a8e5114"],
        ["@babel/plugin-transform-modules-commonjs", "7.4.4"],
        ["@babel/plugin-transform-modules-systemjs", "7.4.4"],
        ["@babel/plugin-transform-modules-umd", "pnp:e8697c845c77d5331f239f35e71dff671d8b4313"],
        ["@babel/plugin-transform-named-capturing-groups-regex", "7.4.5"],
        ["@babel/plugin-transform-new-target", "7.4.4"],
        ["@babel/plugin-transform-object-super", "pnp:46b2e6e496c3be4ddf42cfd099550e51885f42a9"],
        ["@babel/plugin-transform-parameters", "7.4.4"],
        ["@babel/plugin-transform-property-literals", "7.2.0"],
        ["@babel/plugin-transform-regenerator", "7.4.5"],
        ["@babel/plugin-transform-reserved-words", "7.2.0"],
        ["@babel/plugin-transform-shorthand-properties", "pnp:25374ccf4f521bd0353762e978ad98015f7f6ede"],
        ["@babel/plugin-transform-spread", "pnp:5caa1f0f3085d959c7ab13f26ee2ce823c67efdf"],
        ["@babel/plugin-transform-sticky-regex", "pnp:84785f3ae38278d5344c734e450ab8ee376a33e6"],
        ["@babel/plugin-transform-template-literals", "7.4.4"],
        ["@babel/plugin-transform-typeof-symbol", "pnp:0723272ecac627bc84b814d76a18e1d861fb609f"],
        ["@babel/plugin-transform-unicode-regex", "7.4.4"],
        ["@babel/types", "7.4.4"],
        ["browserslist", "4.6.3"],
        ["core-js-compat", "3.1.4"],
        ["invariant", "2.2.4"],
        ["js-levenshtein", "1.1.6"],
        ["semver", "5.6.0"],
        ["@babel/preset-env", "pnp:0fcb8a86302027dee988c72e7fda9a303025484a"],
      ]),
    }],
  ])],
  ["@babel/helper-plugin-utils", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-plugin-utils-7.0.0-bbb3fbee98661c569034237cc03967ba99b4f250/node_modules/@babel/helper-plugin-utils/"),
      packageDependencies: new Map([
        ["@babel/helper-plugin-utils", "7.0.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-proposal-async-generator-functions", new Map([
    ["pnp:c9bc4575bb4c144ef417ebbafd47b3b8295af064", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-c9bc4575bb4c144ef417ebbafd47b3b8295af064/node_modules/@babel/plugin-proposal-async-generator-functions/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-remap-async-to-generator", "7.1.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:4ecc4075f1b85e42f60a92a519195c57adcaee37"],
        ["@babel/plugin-proposal-async-generator-functions", "pnp:c9bc4575bb4c144ef417ebbafd47b3b8295af064"],
      ]),
    }],
    ["pnp:0fcba5ab8fb387ed9474092e019695c05c2078d1", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-0fcba5ab8fb387ed9474092e019695c05c2078d1/node_modules/@babel/plugin-proposal-async-generator-functions/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-remap-async-to-generator", "7.1.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:4b19e84a5869a0f9cae36be834eee07e4163a47f"],
        ["@babel/plugin-proposal-async-generator-functions", "pnp:0fcba5ab8fb387ed9474092e019695c05c2078d1"],
      ]),
    }],
  ])],
  ["@babel/helper-remap-async-to-generator", new Map([
    ["7.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-remap-async-to-generator-7.1.0-361d80821b6f38da75bd3f0785ece20a88c5fe7f/node_modules/@babel/helper-remap-async-to-generator/"),
      packageDependencies: new Map([
        ["@babel/helper-annotate-as-pure", "7.0.0"],
        ["@babel/helper-wrap-function", "7.2.0"],
        ["@babel/template", "7.2.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-remap-async-to-generator", "7.1.0"],
      ]),
    }],
  ])],
  ["@babel/helper-annotate-as-pure", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-annotate-as-pure-7.0.0-323d39dd0b50e10c7c06ca7d7638e6864d8c5c32/node_modules/@babel/helper-annotate-as-pure/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@babel/helper-annotate-as-pure", "7.0.0"],
      ]),
    }],
  ])],
  ["@babel/helper-wrap-function", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-wrap-function-7.2.0-c4e0012445769e2815b55296ead43a958549f6fa/node_modules/@babel/helper-wrap-function/"),
      packageDependencies: new Map([
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/template", "7.2.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-wrap-function", "7.2.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-async-generators", new Map([
    ["pnp:4ecc4075f1b85e42f60a92a519195c57adcaee37", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-4ecc4075f1b85e42f60a92a519195c57adcaee37/node_modules/@babel/plugin-syntax-async-generators/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:4ecc4075f1b85e42f60a92a519195c57adcaee37"],
      ]),
    }],
    ["pnp:2dc40106cf8fd126426ad6195234ec72dbcfaf39", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-2dc40106cf8fd126426ad6195234ec72dbcfaf39/node_modules/@babel/plugin-syntax-async-generators/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:2dc40106cf8fd126426ad6195234ec72dbcfaf39"],
      ]),
    }],
    ["pnp:4b19e84a5869a0f9cae36be834eee07e4163a47f", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-4b19e84a5869a0f9cae36be834eee07e4163a47f/node_modules/@babel/plugin-syntax-async-generators/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:4b19e84a5869a0f9cae36be834eee07e4163a47f"],
      ]),
    }],
    ["pnp:bdb015bb034f3f82084dfacd1ba186a4212bc8c5", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-bdb015bb034f3f82084dfacd1ba186a4212bc8c5/node_modules/@babel/plugin-syntax-async-generators/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-async-generators", "pnp:bdb015bb034f3f82084dfacd1ba186a4212bc8c5"],
      ]),
    }],
  ])],
  ["@babel/plugin-proposal-json-strings", new Map([
    ["pnp:68ec4f6bc76d657bdeb2cc59bd8137cc968fe627", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-68ec4f6bc76d657bdeb2cc59bd8137cc968fe627/node_modules/@babel/plugin-proposal-json-strings/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-json-strings", "pnp:90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc"],
        ["@babel/plugin-proposal-json-strings", "pnp:68ec4f6bc76d657bdeb2cc59bd8137cc968fe627"],
      ]),
    }],
    ["pnp:e6558ae27eed106acc73f522796abf89e5cc93f6", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-e6558ae27eed106acc73f522796abf89e5cc93f6/node_modules/@babel/plugin-proposal-json-strings/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-json-strings", "pnp:1fb25abe4c84fb26fe43937d800e625daaf09a5b"],
        ["@babel/plugin-proposal-json-strings", "pnp:e6558ae27eed106acc73f522796abf89e5cc93f6"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-json-strings", new Map([
    ["pnp:90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc/node_modules/@babel/plugin-syntax-json-strings/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-json-strings", "pnp:90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc"],
      ]),
    }],
    ["pnp:3fce135b2c9687a3ba481074ff3a21fb1421630c", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-3fce135b2c9687a3ba481074ff3a21fb1421630c/node_modules/@babel/plugin-syntax-json-strings/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-json-strings", "pnp:3fce135b2c9687a3ba481074ff3a21fb1421630c"],
      ]),
    }],
    ["pnp:1fb25abe4c84fb26fe43937d800e625daaf09a5b", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-1fb25abe4c84fb26fe43937d800e625daaf09a5b/node_modules/@babel/plugin-syntax-json-strings/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-json-strings", "pnp:1fb25abe4c84fb26fe43937d800e625daaf09a5b"],
      ]),
    }],
    ["pnp:87accb40ed4635b97081c874891070fcaea08d37", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-87accb40ed4635b97081c874891070fcaea08d37/node_modules/@babel/plugin-syntax-json-strings/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-json-strings", "pnp:87accb40ed4635b97081c874891070fcaea08d37"],
      ]),
    }],
  ])],
  ["@babel/plugin-proposal-object-rest-spread", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-object-rest-spread-7.4.0-e4960575205eadf2a1ab4e0c79f9504d5b82a97f/node_modules/@babel/plugin-proposal-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a"],
        ["@babel/plugin-proposal-object-rest-spread", "7.4.0"],
      ]),
    }],
    ["7.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-object-rest-spread-7.4.3-be27cd416eceeba84141305b93c282f5de23bbb4/node_modules/@babel/plugin-proposal-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:9f663b6856b348804c2c0c2434805caf61c6c3e2"],
        ["@babel/plugin-proposal-object-rest-spread", "7.4.3"],
      ]),
    }],
    ["pnp:a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75/node_modules/@babel/plugin-proposal-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:b48ed82b04ffd88ec843040b4a109a32fe4380e0"],
        ["@babel/plugin-proposal-object-rest-spread", "pnp:a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75"],
      ]),
    }],
    ["pnp:d21a38d0695bb92bc896c7afeebcfc9e3c3a1464", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-d21a38d0695bb92bc896c7afeebcfc9e3c3a1464/node_modules/@babel/plugin-proposal-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:289edf6f22f0e6a8c576348d7aceba28afb7ce12"],
        ["@babel/plugin-proposal-object-rest-spread", "pnp:d21a38d0695bb92bc896c7afeebcfc9e3c3a1464"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-object-rest-spread", new Map([
    ["pnp:aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a"],
      ]),
    }],
    ["pnp:f21c2711308277c29808d40b71d3469926161e85", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-f21c2711308277c29808d40b71d3469926161e85/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:f21c2711308277c29808d40b71d3469926161e85"],
      ]),
    }],
    ["pnp:9f663b6856b348804c2c0c2434805caf61c6c3e2", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-9f663b6856b348804c2c0c2434805caf61c6c3e2/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:9f663b6856b348804c2c0c2434805caf61c6c3e2"],
      ]),
    }],
    ["pnp:b48ed82b04ffd88ec843040b4a109a32fe4380e0", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-b48ed82b04ffd88ec843040b4a109a32fe4380e0/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:b48ed82b04ffd88ec843040b4a109a32fe4380e0"],
      ]),
    }],
    ["pnp:289edf6f22f0e6a8c576348d7aceba28afb7ce12", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-289edf6f22f0e6a8c576348d7aceba28afb7ce12/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:289edf6f22f0e6a8c576348d7aceba28afb7ce12"],
      ]),
    }],
    ["pnp:04416ed1deece382c5ecb0ef2759dc1c8ea12290", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-04416ed1deece382c5ecb0ef2759dc1c8ea12290/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:04416ed1deece382c5ecb0ef2759dc1c8ea12290"],
      ]),
    }],
    ["pnp:02230c10914cd035a201a3903a61f186c4b9c0e8", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-02230c10914cd035a201a3903a61f186c4b9c0e8/node_modules/@babel/plugin-syntax-object-rest-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:02230c10914cd035a201a3903a61f186c4b9c0e8"],
      ]),
    }],
  ])],
  ["@babel/plugin-proposal-optional-catch-binding", new Map([
    ["pnp:d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2/node_modules/@babel/plugin-proposal-optional-catch-binding/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1"],
        ["@babel/plugin-proposal-optional-catch-binding", "pnp:d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2"],
      ]),
    }],
    ["pnp:58301a8687a35c191f6b7ba378cc2feb3e9e8bd6", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-58301a8687a35c191f6b7ba378cc2feb3e9e8bd6/node_modules/@babel/plugin-proposal-optional-catch-binding/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:9b1989a76a394312ba9c5025d05a2e9a7511be36"],
        ["@babel/plugin-proposal-optional-catch-binding", "pnp:58301a8687a35c191f6b7ba378cc2feb3e9e8bd6"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-optional-catch-binding", new Map([
    ["pnp:493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1/node_modules/@babel/plugin-syntax-optional-catch-binding/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1"],
      ]),
    }],
    ["pnp:225721100e9193a34544da90564940816d04a0f3", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-225721100e9193a34544da90564940816d04a0f3/node_modules/@babel/plugin-syntax-optional-catch-binding/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:225721100e9193a34544da90564940816d04a0f3"],
      ]),
    }],
    ["pnp:9b1989a76a394312ba9c5025d05a2e9a7511be36", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-9b1989a76a394312ba9c5025d05a2e9a7511be36/node_modules/@babel/plugin-syntax-optional-catch-binding/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:9b1989a76a394312ba9c5025d05a2e9a7511be36"],
      ]),
    }],
    ["pnp:17df0d674d7ac439f303b29abc0b89de84450201", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-17df0d674d7ac439f303b29abc0b89de84450201/node_modules/@babel/plugin-syntax-optional-catch-binding/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-optional-catch-binding", "pnp:17df0d674d7ac439f303b29abc0b89de84450201"],
      ]),
    }],
  ])],
  ["@babel/plugin-proposal-unicode-property-regex", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-unicode-property-regex-7.4.0-202d91ee977d760ef83f4f416b280d568be84623/node_modules/@babel/plugin-proposal-unicode-property-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.0.0"],
        ["regexpu-core", "4.5.4"],
        ["@babel/plugin-proposal-unicode-property-regex", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-unicode-property-regex-7.4.4-501ffd9826c0b91da22690720722ac7cb1ca9c78/node_modules/@babel/plugin-proposal-unicode-property-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.4.4"],
        ["regexpu-core", "4.5.4"],
        ["@babel/plugin-proposal-unicode-property-regex", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-regex", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-regex-7.0.0-2c1718923b57f9bbe64705ffe5640ac64d9bdb27/node_modules/@babel/helper-regex/"),
      packageDependencies: new Map([
        ["lodash", "4.17.11"],
        ["@babel/helper-regex", "7.0.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-regex-7.4.4-a47e02bc91fb259d2e6727c2a30013e3ac13c4a2/node_modules/@babel/helper-regex/"),
      packageDependencies: new Map([
        ["lodash", "4.17.11"],
        ["@babel/helper-regex", "7.4.4"],
      ]),
    }],
  ])],
  ["regexpu-core", new Map([
    ["4.5.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regexpu-core-4.5.4-080d9d02289aa87fe1667a4f5136bc98a6aebaae/node_modules/regexpu-core/"),
      packageDependencies: new Map([
        ["regenerate", "1.4.0"],
        ["regenerate-unicode-properties", "8.0.2"],
        ["regjsgen", "0.5.0"],
        ["regjsparser", "0.6.0"],
        ["unicode-match-property-ecmascript", "1.0.4"],
        ["unicode-match-property-value-ecmascript", "1.1.0"],
        ["regexpu-core", "4.5.4"],
      ]),
    }],
    ["4.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regexpu-core-4.4.0-8d43e0d1266883969720345e70c275ee0aec0d32/node_modules/regexpu-core/"),
      packageDependencies: new Map([
        ["regenerate", "1.4.0"],
        ["regenerate-unicode-properties", "7.0.0"],
        ["regjsgen", "0.5.0"],
        ["regjsparser", "0.6.0"],
        ["unicode-match-property-ecmascript", "1.0.4"],
        ["unicode-match-property-value-ecmascript", "1.0.2"],
        ["regexpu-core", "4.4.0"],
      ]),
    }],
  ])],
  ["regenerate", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerate-1.4.0-4a856ec4b56e4077c557589cae85e7a4c8869a11/node_modules/regenerate/"),
      packageDependencies: new Map([
        ["regenerate", "1.4.0"],
      ]),
    }],
  ])],
  ["regenerate-unicode-properties", new Map([
    ["8.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerate-unicode-properties-8.0.2-7b38faa296252376d363558cfbda90c9ce709662/node_modules/regenerate-unicode-properties/"),
      packageDependencies: new Map([
        ["regenerate", "1.4.0"],
        ["regenerate-unicode-properties", "8.0.2"],
      ]),
    }],
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerate-unicode-properties-7.0.0-107405afcc4a190ec5ed450ecaa00ed0cafa7a4c/node_modules/regenerate-unicode-properties/"),
      packageDependencies: new Map([
        ["regenerate", "1.4.0"],
        ["regenerate-unicode-properties", "7.0.0"],
      ]),
    }],
  ])],
  ["regjsgen", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regjsgen-0.5.0-a7634dc08f89209c2049adda3525711fb97265dd/node_modules/regjsgen/"),
      packageDependencies: new Map([
        ["regjsgen", "0.5.0"],
      ]),
    }],
  ])],
  ["regjsparser", new Map([
    ["0.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regjsparser-0.6.0-f1e6ae8b7da2bae96c99399b868cd6c933a2ba9c/node_modules/regjsparser/"),
      packageDependencies: new Map([
        ["jsesc", "0.5.0"],
        ["regjsparser", "0.6.0"],
      ]),
    }],
  ])],
  ["unicode-match-property-ecmascript", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unicode-match-property-ecmascript-1.0.4-8ed2a32569961bce9227d09cd3ffbb8fed5f020c/node_modules/unicode-match-property-ecmascript/"),
      packageDependencies: new Map([
        ["unicode-canonical-property-names-ecmascript", "1.0.4"],
        ["unicode-property-aliases-ecmascript", "1.0.4"],
        ["unicode-match-property-ecmascript", "1.0.4"],
      ]),
    }],
  ])],
  ["unicode-canonical-property-names-ecmascript", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unicode-canonical-property-names-ecmascript-1.0.4-2619800c4c825800efdd8343af7dd9933cbe2818/node_modules/unicode-canonical-property-names-ecmascript/"),
      packageDependencies: new Map([
        ["unicode-canonical-property-names-ecmascript", "1.0.4"],
      ]),
    }],
  ])],
  ["unicode-property-aliases-ecmascript", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unicode-property-aliases-ecmascript-1.0.4-5a533f31b4317ea76f17d807fa0d116546111dd0/node_modules/unicode-property-aliases-ecmascript/"),
      packageDependencies: new Map([
        ["unicode-property-aliases-ecmascript", "1.0.4"],
      ]),
    }],
  ])],
  ["unicode-match-property-value-ecmascript", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unicode-match-property-value-ecmascript-1.1.0-5b4b426e08d13a80365e0d657ac7a6c1ec46a277/node_modules/unicode-match-property-value-ecmascript/"),
      packageDependencies: new Map([
        ["unicode-match-property-value-ecmascript", "1.1.0"],
      ]),
    }],
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unicode-match-property-value-ecmascript-1.0.2-9f1dc76926d6ccf452310564fd834ace059663d4/node_modules/unicode-match-property-value-ecmascript/"),
      packageDependencies: new Map([
        ["unicode-match-property-value-ecmascript", "1.0.2"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-arrow-functions", new Map([
    ["pnp:705e525ab6be3fa50fb9ef4e48cf128f32a3cc22", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-705e525ab6be3fa50fb9ef4e48cf128f32a3cc22/node_modules/@babel/plugin-transform-arrow-functions/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-arrow-functions", "pnp:705e525ab6be3fa50fb9ef4e48cf128f32a3cc22"],
      ]),
    }],
    ["pnp:a81271c9accc4c94a60061b6c7d9ed4f566e633d", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-a81271c9accc4c94a60061b6c7d9ed4f566e633d/node_modules/@babel/plugin-transform-arrow-functions/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-arrow-functions", "pnp:a81271c9accc4c94a60061b6c7d9ed4f566e633d"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-async-to-generator", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-async-to-generator-7.4.0-234fe3e458dce95865c0d152d256119b237834b0/node_modules/@babel/plugin-transform-async-to-generator/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-remap-async-to-generator", "7.1.0"],
        ["@babel/plugin-transform-async-to-generator", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-async-to-generator-7.4.4-a3f1d01f2f21cadab20b33a82133116f14fb5894/node_modules/@babel/plugin-transform-async-to-generator/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-remap-async-to-generator", "7.1.0"],
        ["@babel/plugin-transform-async-to-generator", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-block-scoped-functions", new Map([
    ["pnp:b8d36a0e178b88992b847671a432a570de7b2a01", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-b8d36a0e178b88992b847671a432a570de7b2a01/node_modules/@babel/plugin-transform-block-scoped-functions/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-block-scoped-functions", "pnp:b8d36a0e178b88992b847671a432a570de7b2a01"],
      ]),
    }],
    ["pnp:dba325a89899ca82a1bce94e52fe46c9eb3ef76c", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-dba325a89899ca82a1bce94e52fe46c9eb3ef76c/node_modules/@babel/plugin-transform-block-scoped-functions/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-block-scoped-functions", "pnp:dba325a89899ca82a1bce94e52fe46c9eb3ef76c"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-block-scoping", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-block-scoping-7.4.0-164df3bb41e3deb954c4ca32ffa9fcaa56d30bcb/node_modules/@babel/plugin-transform-block-scoping/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["lodash", "4.17.11"],
        ["@babel/plugin-transform-block-scoping", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-block-scoping-7.4.4-c13279fabf6b916661531841a23c4b7dae29646d/node_modules/@babel/plugin-transform-block-scoping/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["lodash", "4.17.11"],
        ["@babel/plugin-transform-block-scoping", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-classes", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-classes-7.4.0-e3428d3c8a3d01f33b10c529b998ba1707043d4d/node_modules/@babel/plugin-transform-classes/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-annotate-as-pure", "7.0.0"],
        ["@babel/helper-define-map", "7.4.0"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-replace-supers", "7.4.0"],
        ["@babel/helper-split-export-declaration", "7.4.0"],
        ["globals", "11.10.0"],
        ["@babel/plugin-transform-classes", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-classes-7.4.4-0ce4094cdafd709721076d3b9c38ad31ca715eb6/node_modules/@babel/plugin-transform-classes/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-annotate-as-pure", "7.0.0"],
        ["@babel/helper-define-map", "7.4.4"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-replace-supers", "7.4.4"],
        ["@babel/helper-split-export-declaration", "7.4.4"],
        ["globals", "11.10.0"],
        ["@babel/plugin-transform-classes", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-define-map", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-define-map-7.4.0-cbfd8c1b2f12708e262c26f600cd16ed6a3bc6c9/node_modules/@babel/helper-define-map/"),
      packageDependencies: new Map([
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/types", "7.4.0"],
        ["lodash", "4.17.11"],
        ["@babel/helper-define-map", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-define-map-7.4.4-6969d1f570b46bdc900d1eba8e5d59c48ba2c12a/node_modules/@babel/helper-define-map/"),
      packageDependencies: new Map([
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/types", "7.4.4"],
        ["lodash", "4.17.11"],
        ["@babel/helper-define-map", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-optimise-call-expression", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-optimise-call-expression-7.0.0-a2920c5702b073c15de51106200aa8cad20497d5/node_modules/@babel/helper-optimise-call-expression/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
      ]),
    }],
  ])],
  ["@babel/helper-replace-supers", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-replace-supers-7.4.0-4f56adb6aedcd449d2da9399c2dcf0545463b64c/node_modules/@babel/helper-replace-supers/"),
      packageDependencies: new Map([
        ["@babel/helper-member-expression-to-functions", "7.0.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/traverse", "7.4.0"],
        ["@babel/types", "7.4.0"],
        ["@babel/helper-replace-supers", "7.4.0"],
      ]),
    }],
    ["7.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-replace-supers-7.2.3-19970020cf22677d62b3a689561dbd9644d8c5e5/node_modules/@babel/helper-replace-supers/"),
      packageDependencies: new Map([
        ["@babel/helper-member-expression-to-functions", "7.0.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-replace-supers", "7.2.3"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-replace-supers-7.4.4-aee41783ebe4f2d3ab3ae775e1cc6f1a90cefa27/node_modules/@babel/helper-replace-supers/"),
      packageDependencies: new Map([
        ["@babel/helper-member-expression-to-functions", "7.0.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/traverse", "7.4.5"],
        ["@babel/types", "7.4.4"],
        ["@babel/helper-replace-supers", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-member-expression-to-functions", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-member-expression-to-functions-7.0.0-8cd14b0a0df7ff00f009e7d7a436945f47c7a16f/node_modules/@babel/helper-member-expression-to-functions/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@babel/helper-member-expression-to-functions", "7.0.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-computed-properties", new Map([
    ["pnp:7833a827b64ccae1f1110308a462b3cecb5f9e99", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-7833a827b64ccae1f1110308a462b3cecb5f9e99/node_modules/@babel/plugin-transform-computed-properties/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-computed-properties", "pnp:7833a827b64ccae1f1110308a462b3cecb5f9e99"],
      ]),
    }],
    ["pnp:cccec504e039f73d05407aac79b4545b3d9e0fee", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-cccec504e039f73d05407aac79b4545b3d9e0fee/node_modules/@babel/plugin-transform-computed-properties/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-computed-properties", "pnp:cccec504e039f73d05407aac79b4545b3d9e0fee"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-destructuring", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-destructuring-7.4.0-acbb9b2418d290107db333f4d6cd8aa6aea00343/node_modules/@babel/plugin-transform-destructuring/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-destructuring", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-destructuring-7.4.4-9d964717829cc9e4b601fc82a26a71a4d8faf20f/node_modules/@babel/plugin-transform-destructuring/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-destructuring", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-dotall-regex", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-dotall-regex-7.2.0-f0aabb93d120a8ac61e925ea0ba440812dbe0e49/node_modules/@babel/plugin-transform-dotall-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.0.0"],
        ["regexpu-core", "4.4.0"],
        ["@babel/plugin-transform-dotall-regex", "7.2.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-dotall-regex-7.4.4-361a148bc951444312c69446d76ed1ea8e4450c3/node_modules/@babel/plugin-transform-dotall-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.4.4"],
        ["regexpu-core", "4.5.4"],
        ["@babel/plugin-transform-dotall-regex", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-duplicate-keys", new Map([
    ["pnp:2c1efb2908ba15d96fa6c471d52e1c06e6a35136", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-2c1efb2908ba15d96fa6c471d52e1c06e6a35136/node_modules/@babel/plugin-transform-duplicate-keys/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-duplicate-keys", "pnp:2c1efb2908ba15d96fa6c471d52e1c06e6a35136"],
      ]),
    }],
    ["pnp:e104fc3b299ecc9e424fe88ef169be4ff387ea9a", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-e104fc3b299ecc9e424fe88ef169be4ff387ea9a/node_modules/@babel/plugin-transform-duplicate-keys/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-duplicate-keys", "pnp:e104fc3b299ecc9e424fe88ef169be4ff387ea9a"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-exponentiation-operator", new Map([
    ["pnp:f4ed7a7493b7db746c46fd71274457a6b37dacf8", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-f4ed7a7493b7db746c46fd71274457a6b37dacf8/node_modules/@babel/plugin-transform-exponentiation-operator/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-builder-binary-assignment-operator-visitor", "7.1.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-exponentiation-operator", "pnp:f4ed7a7493b7db746c46fd71274457a6b37dacf8"],
      ]),
    }],
    ["pnp:585f461e43b2ed57e91c98f770ce10675ca460a0", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-585f461e43b2ed57e91c98f770ce10675ca460a0/node_modules/@babel/plugin-transform-exponentiation-operator/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-builder-binary-assignment-operator-visitor", "7.1.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-exponentiation-operator", "pnp:585f461e43b2ed57e91c98f770ce10675ca460a0"],
      ]),
    }],
  ])],
  ["@babel/helper-builder-binary-assignment-operator-visitor", new Map([
    ["7.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-builder-binary-assignment-operator-visitor-7.1.0-6b69628dfe4087798e0c4ed98e3d4a6b2fbd2f5f/node_modules/@babel/helper-builder-binary-assignment-operator-visitor/"),
      packageDependencies: new Map([
        ["@babel/helper-explode-assignable-expression", "7.1.0"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-builder-binary-assignment-operator-visitor", "7.1.0"],
      ]),
    }],
  ])],
  ["@babel/helper-explode-assignable-expression", new Map([
    ["7.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-explode-assignable-expression-7.1.0-537fa13f6f1674df745b0c00ec8fe4e99681c8f6/node_modules/@babel/helper-explode-assignable-expression/"),
      packageDependencies: new Map([
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-explode-assignable-expression", "7.1.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-for-of", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-for-of-7.4.0-56c8c36677f5d4a16b80b12f7b768de064aaeb5f/node_modules/@babel/plugin-transform-for-of/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-for-of", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-for-of-7.4.4-0267fc735e24c808ba173866c6c4d1440fc3c556/node_modules/@babel/plugin-transform-for-of/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-for-of", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-function-name", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-function-name-7.2.0-f7930362829ff99a3174c39f0afcc024ef59731a/node_modules/@babel/plugin-transform-function-name/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-function-name", "7.2.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-function-name-7.4.4-e1436116abb0610c2259094848754ac5230922ad/node_modules/@babel/plugin-transform-function-name/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-function-name", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-literals", new Map([
    ["pnp:928eb25abee04aa2ef762c675400efb2058f9313", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-928eb25abee04aa2ef762c675400efb2058f9313/node_modules/@babel/plugin-transform-literals/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-literals", "pnp:928eb25abee04aa2ef762c675400efb2058f9313"],
      ]),
    }],
    ["pnp:1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64/node_modules/@babel/plugin-transform-literals/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-literals", "pnp:1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-modules-amd", new Map([
    ["pnp:706179cadfc9260a128e03f81f4b6e353114732a", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-706179cadfc9260a128e03f81f4b6e353114732a/node_modules/@babel/plugin-transform-modules-amd/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-module-transforms", "7.2.2"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-modules-amd", "pnp:706179cadfc9260a128e03f81f4b6e353114732a"],
      ]),
    }],
    ["pnp:854ff2a92da13ec2571fd6ca44727c5f2a8e5114", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-854ff2a92da13ec2571fd6ca44727c5f2a8e5114/node_modules/@babel/plugin-transform-modules-amd/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-module-transforms", "7.2.2"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-modules-amd", "pnp:854ff2a92da13ec2571fd6ca44727c5f2a8e5114"],
      ]),
    }],
  ])],
  ["@babel/helper-module-transforms", new Map([
    ["7.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-module-transforms-7.2.2-ab2f8e8d231409f8370c883d20c335190284b963/node_modules/@babel/helper-module-transforms/"),
      packageDependencies: new Map([
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-simple-access", "7.1.0"],
        ["@babel/helper-split-export-declaration", "7.0.0"],
        ["@babel/template", "7.2.2"],
        ["@babel/types", "7.3.2"],
        ["lodash", "4.17.11"],
        ["@babel/helper-module-transforms", "7.2.2"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-module-transforms-7.4.4-96115ea42a2f139e619e98ed46df6019b94414b8/node_modules/@babel/helper-module-transforms/"),
      packageDependencies: new Map([
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-simple-access", "7.1.0"],
        ["@babel/helper-split-export-declaration", "7.4.4"],
        ["@babel/template", "7.4.4"],
        ["@babel/types", "7.4.4"],
        ["lodash", "4.17.11"],
        ["@babel/helper-module-transforms", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-simple-access", new Map([
    ["7.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-simple-access-7.1.0-65eeb954c8c245beaa4e859da6188f39d71e585c/node_modules/@babel/helper-simple-access/"),
      packageDependencies: new Map([
        ["@babel/template", "7.2.2"],
        ["@babel/types", "7.3.2"],
        ["@babel/helper-simple-access", "7.1.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-modules-commonjs", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-commonjs-7.4.0-3b8ec61714d3b75d20c5ccfa157f2c2e087fd4ca/node_modules/@babel/plugin-transform-modules-commonjs/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-module-transforms", "7.2.2"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-simple-access", "7.1.0"],
        ["@babel/plugin-transform-modules-commonjs", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-commonjs-7.4.4-0bef4713d30f1d78c2e59b3d6db40e60192cac1e/node_modules/@babel/plugin-transform-modules-commonjs/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-module-transforms", "7.4.4"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-simple-access", "7.1.0"],
        ["@babel/plugin-transform-modules-commonjs", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-modules-systemjs", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-systemjs-7.4.0-c2495e55528135797bc816f5d50f851698c586a1/node_modules/@babel/plugin-transform-modules-systemjs/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-hoist-variables", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-modules-systemjs", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-systemjs-7.4.4-dc83c5665b07d6c2a7b224c00ac63659ea36a405/node_modules/@babel/plugin-transform-modules-systemjs/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-hoist-variables", "7.4.4"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-modules-systemjs", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-hoist-variables", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-hoist-variables-7.4.0-25b621399ae229869329730a62015bbeb0a6fbd6/node_modules/@babel/helper-hoist-variables/"),
      packageDependencies: new Map([
        ["@babel/types", "7.4.0"],
        ["@babel/helper-hoist-variables", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-hoist-variables-7.4.4-0298b5f25c8c09c53102d52ac4a98f773eb2850a/node_modules/@babel/helper-hoist-variables/"),
      packageDependencies: new Map([
        ["@babel/types", "7.4.4"],
        ["@babel/helper-hoist-variables", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-modules-umd", new Map([
    ["pnp:07b0af85a2cecc3ce69934c8ce0f82220a29e1df", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-07b0af85a2cecc3ce69934c8ce0f82220a29e1df/node_modules/@babel/plugin-transform-modules-umd/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-module-transforms", "7.2.2"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-modules-umd", "pnp:07b0af85a2cecc3ce69934c8ce0f82220a29e1df"],
      ]),
    }],
    ["pnp:e8697c845c77d5331f239f35e71dff671d8b4313", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-e8697c845c77d5331f239f35e71dff671d8b4313/node_modules/@babel/plugin-transform-modules-umd/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-module-transforms", "7.2.2"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-modules-umd", "pnp:e8697c845c77d5331f239f35e71dff671d8b4313"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-named-capturing-groups-regex", new Map([
    ["7.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-named-capturing-groups-regex-7.4.2-800391136d6cbcc80728dbdba3c1c6e46f86c12e/node_modules/@babel/plugin-transform-named-capturing-groups-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["regexp-tree", "0.1.1"],
        ["@babel/plugin-transform-named-capturing-groups-regex", "7.4.2"],
      ]),
    }],
    ["7.4.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-named-capturing-groups-regex-7.4.5-9d269fd28a370258199b4294736813a60bbdd106/node_modules/@babel/plugin-transform-named-capturing-groups-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["regexp-tree", "0.1.10"],
        ["@babel/plugin-transform-named-capturing-groups-regex", "7.4.5"],
      ]),
    }],
  ])],
  ["nice-try", new Map([
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-nice-try-1.0.5-a3378a7696ce7d223e88fc9b764bd7ef1089e366/node_modules/nice-try/"),
      packageDependencies: new Map([
        ["nice-try", "1.0.5"],
      ]),
    }],
  ])],
  ["pump", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pump-3.0.0-b4a2116815bde2f4e1ea602354e8c75565107a64/node_modules/pump/"),
      packageDependencies: new Map([
        ["end-of-stream", "1.4.1"],
        ["once", "1.4.0"],
        ["pump", "3.0.0"],
      ]),
    }],
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pump-2.0.1-12399add6e4cf7526d973cbc8b5ce2e2908b3909/node_modules/pump/"),
      packageDependencies: new Map([
        ["end-of-stream", "1.4.1"],
        ["once", "1.4.0"],
        ["pump", "2.0.1"],
      ]),
    }],
  ])],
  ["end-of-stream", new Map([
    ["1.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-end-of-stream-1.4.1-ed29634d19baba463b6ce6b80a37213eab71ec43/node_modules/end-of-stream/"),
      packageDependencies: new Map([
        ["once", "1.4.0"],
        ["end-of-stream", "1.4.1"],
      ]),
    }],
  ])],
  ["once", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-once-1.4.0-583b1aa775961d4b113ac17d9c50baef9dd76bd1/node_modules/once/"),
      packageDependencies: new Map([
        ["wrappy", "1.0.2"],
        ["once", "1.4.0"],
      ]),
    }],
  ])],
  ["wrappy", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-wrappy-1.0.2-b5243d8f3ec1aa35f1364605bc0d1036e30ab69f/node_modules/wrappy/"),
      packageDependencies: new Map([
        ["wrappy", "1.0.2"],
      ]),
    }],
  ])],
  ["map-age-cleaner", new Map([
    ["0.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-map-age-cleaner-0.1.3-7d583a7306434c055fe474b0f45078e6e1b4b92a/node_modules/map-age-cleaner/"),
      packageDependencies: new Map([
        ["p-defer", "1.0.0"],
        ["map-age-cleaner", "0.1.3"],
      ]),
    }],
  ])],
  ["p-defer", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-defer-1.0.0-9f6eb182f6c9aa8cd743004a7d4f96b196b0fb0c/node_modules/p-defer/"),
      packageDependencies: new Map([
        ["p-defer", "1.0.0"],
      ]),
    }],
  ])],
  ["p-is-promise", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-is-promise-2.0.0-7554e3d572109a87e1f3f53f6a7d85d1b194f4c5/node_modules/p-is-promise/"),
      packageDependencies: new Map([
        ["p-is-promise", "2.0.0"],
      ]),
    }],
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-is-promise-1.1.0-9c9456989e9f6588017b0434d56097675c3da05e/node_modules/p-is-promise/"),
      packageDependencies: new Map([
        ["p-is-promise", "1.1.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-new-target", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-new-target-7.4.0-67658a1d944edb53c8d4fa3004473a0dd7838150/node_modules/@babel/plugin-transform-new-target/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-new-target", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-new-target-7.4.4-18d120438b0cc9ee95a47f2c72bc9768fbed60a5/node_modules/@babel/plugin-transform-new-target/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-new-target", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-object-super", new Map([
    ["pnp:3ce0792a866dfb9f9666453725275d742cb07516", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-3ce0792a866dfb9f9666453725275d742cb07516/node_modules/@babel/plugin-transform-object-super/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-replace-supers", "7.2.3"],
        ["@babel/plugin-transform-object-super", "pnp:3ce0792a866dfb9f9666453725275d742cb07516"],
      ]),
    }],
    ["pnp:46b2e6e496c3be4ddf42cfd099550e51885f42a9", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-46b2e6e496c3be4ddf42cfd099550e51885f42a9/node_modules/@babel/plugin-transform-object-super/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-replace-supers", "7.2.3"],
        ["@babel/plugin-transform-object-super", "pnp:46b2e6e496c3be4ddf42cfd099550e51885f42a9"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-parameters", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-parameters-7.4.0-a1309426fac4eecd2a9439a4c8c35124a11a48a9/node_modules/@babel/plugin-transform-parameters/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-call-delegate", "7.4.0"],
        ["@babel/helper-get-function-arity", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-parameters", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-parameters-7.4.4-7556cf03f318bd2719fe4c922d2d808be5571e16/node_modules/@babel/plugin-transform-parameters/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-call-delegate", "7.4.4"],
        ["@babel/helper-get-function-arity", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-parameters", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/helper-call-delegate", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-call-delegate-7.4.0-f308eabe0d44f451217853aedf4dea5f6fe3294f/node_modules/@babel/helper-call-delegate/"),
      packageDependencies: new Map([
        ["@babel/helper-hoist-variables", "7.4.0"],
        ["@babel/traverse", "7.4.0"],
        ["@babel/types", "7.4.0"],
        ["@babel/helper-call-delegate", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-call-delegate-7.4.4-87c1f8ca19ad552a736a7a27b1c1fcf8b1ff1f43/node_modules/@babel/helper-call-delegate/"),
      packageDependencies: new Map([
        ["@babel/helper-hoist-variables", "7.4.4"],
        ["@babel/traverse", "7.4.5"],
        ["@babel/types", "7.4.4"],
        ["@babel/helper-call-delegate", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-regenerator", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-regenerator-7.4.0-0780e27ee458cc3fdbad18294d703e972ae1f6d1/node_modules/@babel/plugin-transform-regenerator/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["regenerator-transform", "0.13.4"],
        ["@babel/plugin-transform-regenerator", "7.4.0"],
      ]),
    }],
    ["7.4.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-regenerator-7.4.5-629dc82512c55cee01341fb27bdfcb210354680f/node_modules/@babel/plugin-transform-regenerator/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["regenerator-transform", "0.14.0"],
        ["@babel/plugin-transform-regenerator", "7.4.5"],
      ]),
    }],
  ])],
  ["regenerator-transform", new Map([
    ["0.13.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-transform-0.13.4-18f6763cf1382c69c36df76c6ce122cc694284fb/node_modules/regenerator-transform/"),
      packageDependencies: new Map([
        ["private", "0.1.8"],
        ["regenerator-transform", "0.13.4"],
      ]),
    }],
    ["0.14.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-transform-0.14.0-2ca9aaf7a2c239dd32e4761218425b8c7a86ecaf/node_modules/regenerator-transform/"),
      packageDependencies: new Map([
        ["private", "0.1.8"],
        ["regenerator-transform", "0.14.0"],
      ]),
    }],
  ])],
  ["private", new Map([
    ["0.1.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-private-0.1.8-2381edb3689f7a53d653190060fcf822d2f368ff/node_modules/private/"),
      packageDependencies: new Map([
        ["private", "0.1.8"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-shorthand-properties", new Map([
    ["pnp:6706f7f88678021374b6601dff1304cc39f28df2", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-6706f7f88678021374b6601dff1304cc39f28df2/node_modules/@babel/plugin-transform-shorthand-properties/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-shorthand-properties", "pnp:6706f7f88678021374b6601dff1304cc39f28df2"],
      ]),
    }],
    ["pnp:25374ccf4f521bd0353762e978ad98015f7f6ede", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-25374ccf4f521bd0353762e978ad98015f7f6ede/node_modules/@babel/plugin-transform-shorthand-properties/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-shorthand-properties", "pnp:25374ccf4f521bd0353762e978ad98015f7f6ede"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-spread", new Map([
    ["pnp:531a3ec66b00c112c32da4c3169cb60e29e256e0", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-531a3ec66b00c112c32da4c3169cb60e29e256e0/node_modules/@babel/plugin-transform-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-spread", "pnp:531a3ec66b00c112c32da4c3169cb60e29e256e0"],
      ]),
    }],
    ["pnp:5caa1f0f3085d959c7ab13f26ee2ce823c67efdf", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-5caa1f0f3085d959c7ab13f26ee2ce823c67efdf/node_modules/@babel/plugin-transform-spread/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-spread", "pnp:5caa1f0f3085d959c7ab13f26ee2ce823c67efdf"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-sticky-regex", new Map([
    ["pnp:d0e0051d5601f7731706c6a83567ab381606682d", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-d0e0051d5601f7731706c6a83567ab381606682d/node_modules/@babel/plugin-transform-sticky-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.0.0"],
        ["@babel/plugin-transform-sticky-regex", "pnp:d0e0051d5601f7731706c6a83567ab381606682d"],
      ]),
    }],
    ["pnp:84785f3ae38278d5344c734e450ab8ee376a33e6", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-84785f3ae38278d5344c734e450ab8ee376a33e6/node_modules/@babel/plugin-transform-sticky-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.0.0"],
        ["@babel/plugin-transform-sticky-regex", "pnp:84785f3ae38278d5344c734e450ab8ee376a33e6"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-template-literals", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-template-literals-7.2.0-d87ed01b8eaac7a92473f608c97c089de2ba1e5b/node_modules/@babel/plugin-transform-template-literals/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-annotate-as-pure", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-template-literals", "7.2.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-template-literals-7.4.4-9d28fea7bbce637fb7612a0750989d8321d4bcb0/node_modules/@babel/plugin-transform-template-literals/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-annotate-as-pure", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-template-literals", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-typeof-symbol", new Map([
    ["pnp:15ab85d1e18ca8a2f7e59e350db294bf7f835467", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-15ab85d1e18ca8a2f7e59e350db294bf7f835467/node_modules/@babel/plugin-transform-typeof-symbol/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-typeof-symbol", "pnp:15ab85d1e18ca8a2f7e59e350db294bf7f835467"],
      ]),
    }],
    ["pnp:0723272ecac627bc84b814d76a18e1d861fb609f", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-0723272ecac627bc84b814d76a18e1d861fb609f/node_modules/@babel/plugin-transform-typeof-symbol/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-typeof-symbol", "pnp:0723272ecac627bc84b814d76a18e1d861fb609f"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-unicode-regex", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-unicode-regex-7.2.0-4eb8db16f972f8abb5062c161b8b115546ade08b/node_modules/@babel/plugin-transform-unicode-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.0.0"],
        ["regexpu-core", "4.4.0"],
        ["@babel/plugin-transform-unicode-regex", "7.2.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-unicode-regex-7.4.4-ab4634bb4f14d36728bf5978322b35587787970f/node_modules/@babel/plugin-transform-unicode-regex/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-regex", "7.4.4"],
        ["regexpu-core", "4.5.4"],
        ["@babel/plugin-transform-unicode-regex", "7.4.4"],
      ]),
    }],
  ])],
  ["browserslist", new Map([
    ["4.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-browserslist-4.5.2-36ad281f040af684555a23c780f5c2081c752df0/node_modules/browserslist/"),
      packageDependencies: new Map([
        ["caniuse-lite", "1.0.30000951"],
        ["electron-to-chromium", "1.3.119"],
        ["node-releases", "1.1.11"],
        ["browserslist", "4.5.2"],
      ]),
    }],
    ["4.6.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-browserslist-4.6.3-0530cbc6ab0c1f3fc8c819c72377ba55cf647f05/node_modules/browserslist/"),
      packageDependencies: new Map([
        ["caniuse-lite", "1.0.30000975"],
        ["electron-to-chromium", "1.3.165"],
        ["node-releases", "1.1.23"],
        ["browserslist", "4.6.3"],
      ]),
    }],
  ])],
  ["caniuse-lite", new Map([
    ["1.0.30000951", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-caniuse-lite-1.0.30000951-c7c2fd4d71080284c8677dd410368df8d83688fe/node_modules/caniuse-lite/"),
      packageDependencies: new Map([
        ["caniuse-lite", "1.0.30000951"],
      ]),
    }],
    ["1.0.30000975", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-caniuse-lite-1.0.30000975-d4e7131391dddcf2838999d3ce75065f65f1cdfc/node_modules/caniuse-lite/"),
      packageDependencies: new Map([
        ["caniuse-lite", "1.0.30000975"],
      ]),
    }],
  ])],
  ["electron-to-chromium", new Map([
    ["1.3.119", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-electron-to-chromium-1.3.119-9a7770da667252aeb81f667853f67c2b26e00197/node_modules/electron-to-chromium/"),
      packageDependencies: new Map([
        ["electron-to-chromium", "1.3.119"],
      ]),
    }],
    ["1.3.165", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-electron-to-chromium-1.3.165-51864c9e3c9bd9e1c020b9493fddcc0f49888e3a/node_modules/electron-to-chromium/"),
      packageDependencies: new Map([
        ["electron-to-chromium", "1.3.165"],
      ]),
    }],
  ])],
  ["node-releases", new Map([
    ["1.1.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-releases-1.1.11-9a0841a4b0d92b7d5141ed179e764f42ad22724a/node_modules/node-releases/"),
      packageDependencies: new Map([
        ["semver", "5.6.0"],
        ["node-releases", "1.1.11"],
      ]),
    }],
    ["1.1.23", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-releases-1.1.23-de7409f72de044a2fa59c097f436ba89c39997f0/node_modules/node-releases/"),
      packageDependencies: new Map([
        ["semver", "5.6.0"],
        ["node-releases", "1.1.23"],
      ]),
    }],
  ])],
  ["core-js-compat", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-js-compat-3.0.0-cd9810b8000742535a4a43773866185e310bd4f7/node_modules/core-js-compat/"),
      packageDependencies: new Map([
        ["browserslist", "4.5.2"],
        ["core-js", "3.0.0"],
        ["core-js-pure", "3.0.0"],
        ["semver", "5.6.0"],
        ["core-js-compat", "3.0.0"],
      ]),
    }],
    ["3.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-js-compat-3.1.4-e4d0c40fbd01e65b1d457980fe4112d4358a7408/node_modules/core-js-compat/"),
      packageDependencies: new Map([
        ["browserslist", "4.6.3"],
        ["core-js-pure", "3.1.4"],
        ["semver", "6.1.1"],
        ["core-js-compat", "3.1.4"],
      ]),
    }],
  ])],
  ["core-js-pure", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-core-js-pure-3.0.0-a5679adb4875427c8c0488afc93e6f5b7125859b/node_modules/core-js-pure/"),
      packageDependencies: new Map([
        ["core-js-pure", "3.0.0"],
      ]),
    }],
    ["3.1.4", {
      packageLocation: path.resolve(__dirname, "./.pnp/unplugged/npm-core-js-pure-3.1.4-5fa17dc77002a169a3566cc48dc774d2e13e3769/node_modules/core-js-pure/"),
      packageDependencies: new Map([
        ["core-js-pure", "3.1.4"],
      ]),
    }],
  ])],
  ["invariant", new Map([
    ["2.2.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-invariant-2.2.4-610f3c92c9359ce1db616e538008d23ff35158e6/node_modules/invariant/"),
      packageDependencies: new Map([
        ["loose-envify", "1.4.0"],
        ["invariant", "2.2.4"],
      ]),
    }],
  ])],
  ["loose-envify", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-loose-envify-1.4.0-71ee51fa7be4caec1a63839f7e682d8132d30caf/node_modules/loose-envify/"),
      packageDependencies: new Map([
        ["js-tokens", "4.0.0"],
        ["loose-envify", "1.4.0"],
      ]),
    }],
  ])],
  ["js-levenshtein", new Map([
    ["1.1.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-js-levenshtein-1.1.6-c6cee58eb3550372df8deb85fad5ce66ce01d59d/node_modules/js-levenshtein/"),
      packageDependencies: new Map([
        ["js-levenshtein", "1.1.6"],
      ]),
    }],
  ])],
  ["@babel/preset-typescript", new Map([
    ["pnp:ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5/node_modules/@babel/preset-typescript/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-typescript", "7.4.0"],
        ["@babel/preset-typescript", "pnp:ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5"],
      ]),
    }],
    ["pnp:1eacac43c9327c4cb3cbca060094d2d32117e9cf", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-1eacac43c9327c4cb3cbca060094d2d32117e9cf/node_modules/@babel/preset-typescript/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-typescript", "7.4.0"],
        ["@babel/preset-typescript", "pnp:1eacac43c9327c4cb3cbca060094d2d32117e9cf"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-typescript", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-typescript-7.4.0-0389ec53a34e80f99f708c4ca311181449a68eb1/node_modules/@babel/plugin-transform-typescript/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-typescript", "7.2.0"],
        ["@babel/plugin-transform-typescript", "7.4.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-typescript", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-syntax-typescript-7.2.0-55d240536bd314dcbbec70fd949c5cabaed1de29/node_modules/@babel/plugin-syntax-typescript/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-typescript", "7.2.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-external-helpers", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-external-helpers-7.2.0-7f4cb7dee651cd380d2034847d914288467a6be4/node_modules/@babel/plugin-external-helpers/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-external-helpers", "7.2.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-proposal-class-properties", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-class-properties-7.4.0-d70db61a2f1fd79de927eea91f6411c964e084b8/node_modules/@babel/plugin-proposal-class-properties/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-create-class-features-plugin", "7.4.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-proposal-class-properties", "7.4.0"],
      ]),
    }],
    ["pnp:14724cda3c3ac650e41a80edd910cdecbe601f04", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-14724cda3c3ac650e41a80edd910cdecbe601f04/node_modules/@babel/plugin-proposal-class-properties/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-create-class-features-plugin", "7.4.4"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-proposal-class-properties", "pnp:14724cda3c3ac650e41a80edd910cdecbe601f04"],
      ]),
    }],
  ])],
  ["@babel/helper-create-class-features-plugin", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-create-class-features-plugin-7.4.0-30fd090e059d021995c1762a5b76798fa0b51d82/node_modules/@babel/helper-create-class-features-plugin/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-member-expression-to-functions", "7.0.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-replace-supers", "7.4.0"],
        ["@babel/helper-split-export-declaration", "7.4.0"],
        ["@babel/helper-create-class-features-plugin", "7.4.0"],
      ]),
    }],
    ["7.4.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-create-class-features-plugin-7.4.4-fc3d690af6554cc9efc607364a82d48f58736dba/node_modules/@babel/helper-create-class-features-plugin/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-function-name", "7.1.0"],
        ["@babel/helper-member-expression-to-functions", "7.0.0"],
        ["@babel/helper-optimise-call-expression", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/helper-replace-supers", "7.4.4"],
        ["@babel/helper-split-export-declaration", "7.4.4"],
        ["@babel/helper-create-class-features-plugin", "7.4.4"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-runtime", new Map([
    ["7.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-runtime-7.4.0-b4d8c925ed957471bc57e0b9da53408ebb1ed457/node_modules/@babel/plugin-transform-runtime/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.0"],
        ["@babel/helper-module-imports", "7.0.0"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["resolve", "1.10.0"],
        ["semver", "5.6.0"],
        ["@babel/plugin-transform-runtime", "7.4.0"],
      ]),
    }],
  ])],
  ["klaw", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-klaw-3.0.0-b11bec9cf2492f06756d6e809ab73a2910259146/node_modules/klaw/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["klaw", "3.0.0"],
      ]),
    }],
  ])],
  ["rollup", new Map([
    ["1.10.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rollup-1.10.0-91d594aa4386c51ca0883ad4ef2050b469d3e8aa/node_modules/rollup/"),
      packageDependencies: new Map([
        ["@types/estree", "0.0.39"],
        ["@types/node", "11.13.5"],
        ["acorn", "6.1.1"],
        ["rollup", "1.10.0"],
      ]),
    }],
  ])],
  ["@types/estree", new Map([
    ["0.0.39", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-estree-0.0.39-e177e699ee1b8c22d23174caaa7422644389509f/node_modules/@types/estree/"),
      packageDependencies: new Map([
        ["@types/estree", "0.0.39"],
      ]),
    }],
  ])],
  ["@types/node", new Map([
    ["11.13.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-11.13.5-266564afa8a6a09dc778dfacc703ed3f09c80516/node_modules/@types/node/"),
      packageDependencies: new Map([
        ["@types/node", "11.13.5"],
      ]),
    }],
    ["11.11.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-11.11.6-df929d1bb2eee5afdda598a41930fe50b43eaa6a/node_modules/@types/node/"),
      packageDependencies: new Map([
        ["@types/node", "11.11.6"],
      ]),
    }],
    ["10.14.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-10.14.3-170a81168620d931cc3b83460be253cadd3028f1/node_modules/@types/node/"),
      packageDependencies: new Map([
        ["@types/node", "10.14.3"],
      ]),
    }],
    ["12.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-12.0.8-551466be11b2adc3f3d47156758f610bd9f6b1d8/node_modules/@types/node/"),
      packageDependencies: new Map([
        ["@types/node", "12.0.8"],
      ]),
    }],
  ])],
  ["acorn", new Map([
    ["6.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-6.1.1-7d25ae05bb8ad1f9b699108e1094ecd7884adc1f/node_modules/acorn/"),
      packageDependencies: new Map([
        ["acorn", "6.1.1"],
      ]),
    }],
    ["6.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-6.1.0-b0a3be31752c97a0f7013c5f4903b71a05db6818/node_modules/acorn/"),
      packageDependencies: new Map([
        ["acorn", "6.1.0"],
      ]),
    }],
    ["5.7.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-5.7.3-67aa231bf8812974b85235a96771eb6bd07ea279/node_modules/acorn/"),
      packageDependencies: new Map([
        ["acorn", "5.7.3"],
      ]),
    }],
  ])],
  ["sw-precache", new Map([
    ["5.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sw-precache-5.2.1-06134f319eec68f3b9583ce9a7036b1c119f7179/node_modules/sw-precache/"),
      packageDependencies: new Map([
        ["dom-urls", "1.1.0"],
        ["es6-promise", "4.2.6"],
        ["glob", "7.1.3"],
        ["lodash.defaults", "4.2.0"],
        ["lodash.template", "4.4.0"],
        ["meow", "3.7.0"],
        ["mkdirp", "0.5.1"],
        ["pretty-bytes", "4.0.2"],
        ["sw-toolbox", "3.6.0"],
        ["update-notifier", "2.5.0"],
        ["sw-precache", "5.2.1"],
      ]),
    }],
  ])],
  ["dom-urls", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-dom-urls-1.1.0-001ddf81628cd1e706125c7176f53ccec55d918e/node_modules/dom-urls/"),
      packageDependencies: new Map([
        ["urijs", "1.19.1"],
        ["dom-urls", "1.1.0"],
      ]),
    }],
  ])],
  ["urijs", new Map([
    ["1.19.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-urijs-1.19.1-5b0ff530c0cbde8386f6342235ba5ca6e995d25a/node_modules/urijs/"),
      packageDependencies: new Map([
        ["urijs", "1.19.1"],
      ]),
    }],
  ])],
  ["es6-promise", new Map([
    ["4.2.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-es6-promise-4.2.6-b685edd8258886365ea62b57d30de28fadcd974f/node_modules/es6-promise/"),
      packageDependencies: new Map([
        ["es6-promise", "4.2.6"],
      ]),
    }],
    ["4.2.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-es6-promise-4.2.5-da6d0d5692efb461e082c14817fe2427d8f5d054/node_modules/es6-promise/"),
      packageDependencies: new Map([
        ["es6-promise", "4.2.5"],
      ]),
    }],
  ])],
  ["glob", new Map([
    ["7.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-glob-7.1.3-3960832d3f1574108342dafd3a67b332c0969df1/node_modules/glob/"),
      packageDependencies: new Map([
        ["fs.realpath", "1.0.0"],
        ["inflight", "1.0.6"],
        ["inherits", "2.0.3"],
        ["minimatch", "3.0.4"],
        ["once", "1.4.0"],
        ["path-is-absolute", "1.0.1"],
        ["glob", "7.1.3"],
      ]),
    }],
  ])],
  ["fs.realpath", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fs-realpath-1.0.0-1504ad2523158caa40db4a2787cb01411994ea4f/node_modules/fs.realpath/"),
      packageDependencies: new Map([
        ["fs.realpath", "1.0.0"],
      ]),
    }],
  ])],
  ["inflight", new Map([
    ["1.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-inflight-1.0.6-49bd6331d7d02d0c09bc910a1075ba8165b56df9/node_modules/inflight/"),
      packageDependencies: new Map([
        ["once", "1.4.0"],
        ["wrappy", "1.0.2"],
        ["inflight", "1.0.6"],
      ]),
    }],
  ])],
  ["minimatch", new Map([
    ["3.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-minimatch-3.0.4-5166e286457f03306064be5497e8dbb0c3d32083/node_modules/minimatch/"),
      packageDependencies: new Map([
        ["brace-expansion", "1.1.11"],
        ["minimatch", "3.0.4"],
      ]),
    }],
  ])],
  ["brace-expansion", new Map([
    ["1.1.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-brace-expansion-1.1.11-3c7fcbf529d87226f3d2f52b966ff5271eb441dd/node_modules/brace-expansion/"),
      packageDependencies: new Map([
        ["balanced-match", "1.0.0"],
        ["concat-map", "0.0.1"],
        ["brace-expansion", "1.1.11"],
      ]),
    }],
  ])],
  ["balanced-match", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-balanced-match-1.0.0-89b4d199ab2bee49de164ea02b89ce462d71b767/node_modules/balanced-match/"),
      packageDependencies: new Map([
        ["balanced-match", "1.0.0"],
      ]),
    }],
  ])],
  ["concat-map", new Map([
    ["0.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-concat-map-0.0.1-d8a96bd77fd68df7793a73036a3ba0d5405d477b/node_modules/concat-map/"),
      packageDependencies: new Map([
        ["concat-map", "0.0.1"],
      ]),
    }],
  ])],
  ["lodash.defaults", new Map([
    ["4.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-defaults-4.2.0-d09178716ffea4dde9e5fb7b37f6f0802274580c/node_modules/lodash.defaults/"),
      packageDependencies: new Map([
        ["lodash.defaults", "4.2.0"],
      ]),
    }],
  ])],
  ["lodash.template", new Map([
    ["4.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-template-4.4.0-e73a0385c8355591746e020b99679c690e68fba0/node_modules/lodash.template/"),
      packageDependencies: new Map([
        ["lodash._reinterpolate", "3.0.0"],
        ["lodash.templatesettings", "4.1.0"],
        ["lodash.template", "4.4.0"],
      ]),
    }],
  ])],
  ["lodash._reinterpolate", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-reinterpolate-3.0.0-0ccf2d89166af03b3663c796538b75ac6e114d9d/node_modules/lodash._reinterpolate/"),
      packageDependencies: new Map([
        ["lodash._reinterpolate", "3.0.0"],
      ]),
    }],
  ])],
  ["lodash.templatesettings", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-templatesettings-4.1.0-2b4d4e95ba440d915ff08bc899e4553666713316/node_modules/lodash.templatesettings/"),
      packageDependencies: new Map([
        ["lodash._reinterpolate", "3.0.0"],
        ["lodash.templatesettings", "4.1.0"],
      ]),
    }],
  ])],
  ["meow", new Map([
    ["3.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-meow-3.7.0-72cb668b425228290abbfa856892587308a801fb/node_modules/meow/"),
      packageDependencies: new Map([
        ["camelcase-keys", "2.1.0"],
        ["decamelize", "1.2.0"],
        ["loud-rejection", "1.6.0"],
        ["map-obj", "1.0.1"],
        ["minimist", "1.2.0"],
        ["normalize-package-data", "2.5.0"],
        ["object-assign", "4.1.1"],
        ["read-pkg-up", "1.0.1"],
        ["redent", "1.0.0"],
        ["trim-newlines", "1.0.0"],
        ["meow", "3.7.0"],
      ]),
    }],
  ])],
  ["loud-rejection", new Map([
    ["1.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-loud-rejection-1.6.0-5b46f80147edee578870f086d04821cf998e551f/node_modules/loud-rejection/"),
      packageDependencies: new Map([
        ["currently-unhandled", "0.4.1"],
        ["signal-exit", "3.0.2"],
        ["loud-rejection", "1.6.0"],
      ]),
    }],
  ])],
  ["currently-unhandled", new Map([
    ["0.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-currently-unhandled-0.4.1-988df33feab191ef799a61369dd76c17adf957ea/node_modules/currently-unhandled/"),
      packageDependencies: new Map([
        ["array-find-index", "1.0.2"],
        ["currently-unhandled", "0.4.1"],
      ]),
    }],
  ])],
  ["array-find-index", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-array-find-index-1.0.2-df010aa1287e164bbda6f9723b0a96a1ec4187a1/node_modules/array-find-index/"),
      packageDependencies: new Map([
        ["array-find-index", "1.0.2"],
      ]),
    }],
  ])],
  ["pinkie-promise", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pinkie-promise-2.0.1-2135d6dfa7a358c069ac9b178776288228450ffa/node_modules/pinkie-promise/"),
      packageDependencies: new Map([
        ["pinkie", "2.0.4"],
        ["pinkie-promise", "2.0.1"],
      ]),
    }],
  ])],
  ["pinkie", new Map([
    ["2.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pinkie-2.0.4-72556b80cfa0d48a974e80e77248e80ed4f7f870/node_modules/pinkie/"),
      packageDependencies: new Map([
        ["pinkie", "2.0.4"],
      ]),
    }],
  ])],
  ["is-utf8", new Map([
    ["0.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-utf8-0.2.1-4b0da1442104d1b336340e80797e865cf39f7d72/node_modules/is-utf8/"),
      packageDependencies: new Map([
        ["is-utf8", "0.2.1"],
      ]),
    }],
  ])],
  ["repeating", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-repeating-2.0.1-5214c53a926d3552707527fbab415dbc08d06dda/node_modules/repeating/"),
      packageDependencies: new Map([
        ["is-finite", "1.0.2"],
        ["repeating", "2.0.1"],
      ]),
    }],
  ])],
  ["is-finite", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-finite-1.0.2-cc6677695602be550ef11e8b4aa6305342b6d0aa/node_modules/is-finite/"),
      packageDependencies: new Map([
        ["number-is-nan", "1.0.1"],
        ["is-finite", "1.0.2"],
      ]),
    }],
  ])],
  ["get-stdin", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-get-stdin-4.0.1-b968c6b0a04384324902e8bf1a5df32579a450fe/node_modules/get-stdin/"),
      packageDependencies: new Map([
        ["get-stdin", "4.0.1"],
      ]),
    }],
  ])],
  ["mkdirp", new Map([
    ["0.5.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mkdirp-0.5.1-30057438eac6cf7f8c4767f38648d6697d75c903/node_modules/mkdirp/"),
      packageDependencies: new Map([
        ["minimist", "0.0.8"],
        ["mkdirp", "0.5.1"],
      ]),
    }],
  ])],
  ["sw-toolbox", new Map([
    ["3.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sw-toolbox-3.6.0-26df1d1c70348658e4dea2884319149b7b3183b5/node_modules/sw-toolbox/"),
      packageDependencies: new Map([
        ["path-to-regexp", "1.7.0"],
        ["serviceworker-cache-polyfill", "4.0.0"],
        ["sw-toolbox", "3.6.0"],
      ]),
    }],
  ])],
  ["path-to-regexp", new Map([
    ["1.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-path-to-regexp-1.7.0-59fde0f435badacba103a84e9d3bc64e96b9937d/node_modules/path-to-regexp/"),
      packageDependencies: new Map([
        ["isarray", "0.0.1"],
        ["path-to-regexp", "1.7.0"],
      ]),
    }],
  ])],
  ["serviceworker-cache-polyfill", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-serviceworker-cache-polyfill-4.0.0-de19ee73bef21ab3c0740a37b33db62464babdeb/node_modules/serviceworker-cache-polyfill/"),
      packageDependencies: new Map([
        ["serviceworker-cache-polyfill", "4.0.0"],
      ]),
    }],
  ])],
  ["@quase/error", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/error/"),
      packageDependencies: new Map([
        ["@quase/path-url", "0.1.0"],
        ["error-stack-parser", "2.0.2"],
        ["@quase/source-map", "0.2.0-0"],
        ["fs-extra", "7.0.1"],
      ]),
    }],
  ])],
  ["error-stack-parser", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-error-stack-parser-2.0.2-4ae8dbaa2bf90a8b450707b9149dcabca135520d/node_modules/error-stack-parser/"),
      packageDependencies: new Map([
        ["stackframe", "1.0.4"],
        ["error-stack-parser", "2.0.2"],
      ]),
    }],
  ])],
  ["stackframe", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-stackframe-1.0.4-357b24a992f9427cba6b545d96a14ed2cbca187b/node_modules/stackframe/"),
      packageDependencies: new Map([
        ["stackframe", "1.0.4"],
      ]),
    }],
  ])],
  ["@quase/cacheable-fs", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/fs/cacheable-fs/"),
      packageDependencies: new Map([
        ["@quase/path-url", "0.2.0-0"],
        ["fs-extra", "5.0.0"],
      ]),
    }],
  ])],
  ["@quase/find-files", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/fs/find-files/"),
      packageDependencies: new Map([
        ["fs-extra", "5.0.0"],
        ["glob-parent", "3.1.0"],
        ["ignore-by-default", "1.0.1"],
        ["is-negated-glob", "1.0.0"],
        ["micromatch", "3.1.10"],
        ["slash", "1.0.0"],
        ["to-absolute-glob", "2.0.2"],
        ["zen-observable", "0.8.13"],
      ]),
    }],
  ])],
  ["ignore-by-default", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ignore-by-default-1.0.1-48ca6d72f6c6a3af00a9ad4ae6876be3889e2b09/node_modules/ignore-by-default/"),
      packageDependencies: new Map([
        ["ignore-by-default", "1.0.1"],
      ]),
    }],
  ])],
  ["is-negated-glob", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-negated-glob-1.0.0-6910bca5da8c95e784b5751b976cf5a10fee36d2/node_modules/is-negated-glob/"),
      packageDependencies: new Map([
        ["is-negated-glob", "1.0.0"],
      ]),
    }],
  ])],
  ["to-absolute-glob", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-to-absolute-glob-2.0.2-1865f43d9e74b0822db9f145b78cff7d0f7c849b/node_modules/to-absolute-glob/"),
      packageDependencies: new Map([
        ["is-absolute", "1.0.0"],
        ["is-negated-glob", "1.0.0"],
        ["to-absolute-glob", "2.0.2"],
      ]),
    }],
  ])],
  ["is-absolute", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-absolute-1.0.0-395e1ae84b11f26ad1795e73c17378e48a301576/node_modules/is-absolute/"),
      packageDependencies: new Map([
        ["is-relative", "1.0.0"],
        ["is-windows", "1.0.2"],
        ["is-absolute", "1.0.0"],
      ]),
    }],
  ])],
  ["is-relative", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-relative-1.0.0-a1bb6935ce8c5dba1e8b9754b9b2dcc020e2260d/node_modules/is-relative/"),
      packageDependencies: new Map([
        ["is-unc-path", "1.0.0"],
        ["is-relative", "1.0.0"],
      ]),
    }],
  ])],
  ["is-unc-path", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-unc-path-1.0.0-d731e8898ed090a12c352ad2eaed5095ad322c9d/node_modules/is-unc-path/"),
      packageDependencies: new Map([
        ["unc-path-regex", "0.1.2"],
        ["is-unc-path", "1.0.0"],
      ]),
    }],
  ])],
  ["unc-path-regex", new Map([
    ["0.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unc-path-regex-0.1.2-e73dd3d7b0d7c5ed86fbac6b0ae7d8c6a69d50fa/node_modules/unc-path-regex/"),
      packageDependencies: new Map([
        ["unc-path-regex", "0.1.2"],
      ]),
    }],
  ])],
  ["zen-observable", new Map([
    ["0.8.13", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-zen-observable-0.8.13-a9f1b9dbdfd2d60a08761ceac6a861427d44ae2e/node_modules/zen-observable/"),
      packageDependencies: new Map([
        ["zen-observable", "0.8.13"],
      ]),
    }],
  ])],
  ["@quase/lang", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/languages/quase-lang/"),
      packageDependencies: new Map([
        ["@quase/parser", "0.1.0-0"],
      ]),
    }],
  ])],
  ["@quase/package-manager", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/package-manager/"),
      packageDependencies: new Map([
        ["@quase/cli", "0.4.0-0"],
        ["@zkochan/cmd-shim", "3.1.0"],
        ["fs-extra", "7.0.1"],
        ["klaw", "3.0.0"],
        ["latest-version", "4.0.0"],
        ["load-json-file", "5.2.0"],
        ["log-symbols", "2.2.0"],
        ["normalize-package-data", "2.5.0"],
        ["npm-package-arg", "6.1.0"],
        ["ora", "3.2.0"],
        ["pacote", "9.5.0"],
        ["read-pkg", "4.0.1"],
        ["semver", "5.6.0"],
        ["sort-keys", "2.0.0"],
        ["symlink-dir", "1.1.3"],
        ["write-json-file", "2.3.0"],
        ["write-pkg", "3.2.0"],
      ]),
    }],
  ])],
  ["@zkochan/cmd-shim", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@zkochan-cmd-shim-3.1.0-2ab8ed81f5bb5452a85f25758eb9b8681982fd2e/node_modules/@zkochan/cmd-shim/"),
      packageDependencies: new Map([
        ["is-windows", "1.0.2"],
        ["mkdirp-promise", "5.0.1"],
        ["mz", "2.7.0"],
        ["@zkochan/cmd-shim", "3.1.0"],
      ]),
    }],
  ])],
  ["mkdirp-promise", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mkdirp-promise-5.0.1-e9b8f68e552c68a9c1713b84883f7a1dd039b8a1/node_modules/mkdirp-promise/"),
      packageDependencies: new Map([
        ["mkdirp", "0.5.1"],
        ["mkdirp-promise", "5.0.1"],
      ]),
    }],
  ])],
  ["mz", new Map([
    ["2.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mz-2.7.0-95008057a56cafadc2bc63dde7f9ff6955948e32/node_modules/mz/"),
      packageDependencies: new Map([
        ["any-promise", "1.3.0"],
        ["object-assign", "4.1.1"],
        ["thenify-all", "1.6.0"],
        ["mz", "2.7.0"],
      ]),
    }],
  ])],
  ["any-promise", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-any-promise-1.3.0-abc6afeedcea52e809cdc0376aed3ce39635d17f/node_modules/any-promise/"),
      packageDependencies: new Map([
        ["any-promise", "1.3.0"],
      ]),
    }],
  ])],
  ["thenify-all", new Map([
    ["1.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-thenify-all-1.6.0-1a1918d402d8fc3f98fbf234db0bcc8cc10e9726/node_modules/thenify-all/"),
      packageDependencies: new Map([
        ["thenify", "3.3.0"],
        ["thenify-all", "1.6.0"],
      ]),
    }],
  ])],
  ["thenify", new Map([
    ["3.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-thenify-3.3.0-e69e38a1babe969b0108207978b9f62b88604839/node_modules/thenify/"),
      packageDependencies: new Map([
        ["any-promise", "1.3.0"],
        ["thenify", "3.3.0"],
      ]),
    }],
  ])],
  ["cacheable-request", new Map([
    ["2.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cacheable-request-2.1.4-0d808801b6342ad33c91df9d0b44dc09b91e5c3d/node_modules/cacheable-request/"),
      packageDependencies: new Map([
        ["clone-response", "1.0.2"],
        ["get-stream", "3.0.0"],
        ["http-cache-semantics", "3.8.1"],
        ["keyv", "3.0.0"],
        ["lowercase-keys", "1.0.0"],
        ["normalize-url", "2.0.1"],
        ["responselike", "1.0.2"],
        ["cacheable-request", "2.1.4"],
      ]),
    }],
    ["6.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cacheable-request-6.0.0-4a1727414e02ac4af82560c4da1b61daa3fa2b63/node_modules/cacheable-request/"),
      packageDependencies: new Map([
        ["clone-response", "1.0.2"],
        ["get-stream", "4.1.0"],
        ["http-cache-semantics", "4.0.3"],
        ["keyv", "3.1.0"],
        ["lowercase-keys", "1.0.1"],
        ["normalize-url", "3.3.0"],
        ["responselike", "1.0.2"],
        ["cacheable-request", "6.0.0"],
      ]),
    }],
  ])],
  ["clone-response", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-clone-response-1.0.2-d1dc973920314df67fbeb94223b4ee350239e96b/node_modules/clone-response/"),
      packageDependencies: new Map([
        ["mimic-response", "1.0.1"],
        ["clone-response", "1.0.2"],
      ]),
    }],
  ])],
  ["mimic-response", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mimic-response-1.0.1-4923538878eef42063cb8a3e3b0798781487ab1b/node_modules/mimic-response/"),
      packageDependencies: new Map([
        ["mimic-response", "1.0.1"],
      ]),
    }],
  ])],
  ["http-cache-semantics", new Map([
    ["3.8.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-http-cache-semantics-3.8.1-39b0e16add9b605bf0a9ef3d9daaf4843b4cacd2/node_modules/http-cache-semantics/"),
      packageDependencies: new Map([
        ["http-cache-semantics", "3.8.1"],
      ]),
    }],
    ["4.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-http-cache-semantics-4.0.3-495704773277eeef6e43f9ab2c2c7d259dda25c5/node_modules/http-cache-semantics/"),
      packageDependencies: new Map([
        ["http-cache-semantics", "4.0.3"],
      ]),
    }],
  ])],
  ["keyv", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-keyv-3.0.0-44923ba39e68b12a7cec7df6c3268c031f2ef373/node_modules/keyv/"),
      packageDependencies: new Map([
        ["json-buffer", "3.0.0"],
        ["keyv", "3.0.0"],
      ]),
    }],
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-keyv-3.1.0-ecc228486f69991e49e9476485a5be1e8fc5c4d9/node_modules/keyv/"),
      packageDependencies: new Map([
        ["json-buffer", "3.0.0"],
        ["keyv", "3.1.0"],
      ]),
    }],
  ])],
  ["json-buffer", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json-buffer-3.0.0-5b1f397afc75d677bde8bcfc0e47e1f9a3d9a898/node_modules/json-buffer/"),
      packageDependencies: new Map([
        ["json-buffer", "3.0.0"],
      ]),
    }],
  ])],
  ["normalize-url", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-normalize-url-2.0.1-835a9da1551fa26f70e92329069a23aa6574d7e6/node_modules/normalize-url/"),
      packageDependencies: new Map([
        ["prepend-http", "2.0.0"],
        ["query-string", "5.1.1"],
        ["sort-keys", "2.0.0"],
        ["normalize-url", "2.0.1"],
      ]),
    }],
    ["3.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-normalize-url-3.3.0-b2e1c4dc4f7c6d57743df733a4f5978d18650559/node_modules/normalize-url/"),
      packageDependencies: new Map([
        ["normalize-url", "3.3.0"],
      ]),
    }],
  ])],
  ["query-string", new Map([
    ["5.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-query-string-5.1.1-a78c012b71c17e05f2e3fa2319dd330682efb3cb/node_modules/query-string/"),
      packageDependencies: new Map([
        ["decode-uri-component", "0.2.0"],
        ["object-assign", "4.1.1"],
        ["strict-uri-encode", "1.1.0"],
        ["query-string", "5.1.1"],
      ]),
    }],
  ])],
  ["strict-uri-encode", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-strict-uri-encode-1.1.0-279b225df1d582b1f54e65addd4352e18faa0713/node_modules/strict-uri-encode/"),
      packageDependencies: new Map([
        ["strict-uri-encode", "1.1.0"],
      ]),
    }],
  ])],
  ["sort-keys", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sort-keys-2.0.0-658535584861ec97d730d6cf41822e1f56684128/node_modules/sort-keys/"),
      packageDependencies: new Map([
        ["is-plain-obj", "1.1.0"],
        ["sort-keys", "2.0.0"],
      ]),
    }],
  ])],
  ["is-plain-obj", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-plain-obj-1.1.0-71a50c8429dfca773c92a390a4a03b39fcd51d3e/node_modules/is-plain-obj/"),
      packageDependencies: new Map([
        ["is-plain-obj", "1.1.0"],
      ]),
    }],
  ])],
  ["responselike", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-responselike-1.0.2-918720ef3b631c5642be068f15ade5a46f4ba1e7/node_modules/responselike/"),
      packageDependencies: new Map([
        ["lowercase-keys", "1.0.1"],
        ["responselike", "1.0.2"],
      ]),
    }],
  ])],
  ["decompress-response", new Map([
    ["3.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-decompress-response-3.3.0-80a4dd323748384bfa248083622aedec982adff3/node_modules/decompress-response/"),
      packageDependencies: new Map([
        ["mimic-response", "1.0.1"],
        ["decompress-response", "3.3.0"],
      ]),
    }],
  ])],
  ["into-stream", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-into-stream-3.1.0-96fb0a936c12babd6ff1752a17d05616abd094c6/node_modules/into-stream/"),
      packageDependencies: new Map([
        ["from2", "2.3.0"],
        ["p-is-promise", "1.1.0"],
        ["into-stream", "3.1.0"],
      ]),
    }],
  ])],
  ["from2", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-from2-2.3.0-8bfb5502bde4a4d36cfdeea007fcca21d7e382af/node_modules/from2/"),
      packageDependencies: new Map([
        ["inherits", "2.0.3"],
        ["readable-stream", "2.3.6"],
        ["from2", "2.3.0"],
      ]),
    }],
  ])],
  ["isurl", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isurl-1.0.0-b27f4f49f3cdaa3ea44a0a5b7f3462e6edc39d67/node_modules/isurl/"),
      packageDependencies: new Map([
        ["has-to-string-tag-x", "1.4.1"],
        ["is-object", "1.0.1"],
        ["isurl", "1.0.0"],
      ]),
    }],
  ])],
  ["has-to-string-tag-x", new Map([
    ["1.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-to-string-tag-x-1.4.1-a045ab383d7b4b2012a00148ab0aa5f290044d4d/node_modules/has-to-string-tag-x/"),
      packageDependencies: new Map([
        ["has-symbol-support-x", "1.4.2"],
        ["has-to-string-tag-x", "1.4.1"],
      ]),
    }],
  ])],
  ["has-symbol-support-x", new Map([
    ["1.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-symbol-support-x-1.4.2-1409f98bc00247da45da67cee0a36f282ff26455/node_modules/has-symbol-support-x/"),
      packageDependencies: new Map([
        ["has-symbol-support-x", "1.4.2"],
      ]),
    }],
  ])],
  ["is-object", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-object-1.0.1-8952688c5ec2ffd6b03ecc85e769e02903083470/node_modules/is-object/"),
      packageDependencies: new Map([
        ["is-object", "1.0.1"],
      ]),
    }],
  ])],
  ["p-cancelable", new Map([
    ["0.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-cancelable-0.4.1-35f363d67d52081c8d9585e37bcceb7e0bbcb2a0/node_modules/p-cancelable/"),
      packageDependencies: new Map([
        ["p-cancelable", "0.4.1"],
      ]),
    }],
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-cancelable-1.1.0-d078d15a3af409220c886f1d9a0ca2e441ab26cc/node_modules/p-cancelable/"),
      packageDependencies: new Map([
        ["p-cancelable", "1.1.0"],
      ]),
    }],
  ])],
  ["p-timeout", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-timeout-2.0.1-d8dd1979595d2dc0139e1fe46b8b646cb3cdf038/node_modules/p-timeout/"),
      packageDependencies: new Map([
        ["p-finally", "1.0.0"],
        ["p-timeout", "2.0.1"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-timeout-3.0.0-1bbd42db28c669efd02e1a82ccf14dc59eb57ed1/node_modules/p-timeout/"),
      packageDependencies: new Map([
        ["p-finally", "1.0.0"],
        ["p-timeout", "3.0.0"],
      ]),
    }],
  ])],
  ["url-to-options", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-url-to-options-1.0.1-1505a03a289a48cbd7a434efbaeec5055f5633a9/node_modules/url-to-options/"),
      packageDependencies: new Map([
        ["url-to-options", "1.0.1"],
      ]),
    }],
  ])],
  ["npm-package-arg", new Map([
    ["6.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-package-arg-6.1.0-15ae1e2758a5027efb4c250554b85a737db7fcc1/node_modules/npm-package-arg/"),
      packageDependencies: new Map([
        ["hosted-git-info", "2.7.1"],
        ["osenv", "0.1.5"],
        ["semver", "5.6.0"],
        ["validate-npm-package-name", "3.0.0"],
        ["npm-package-arg", "6.1.0"],
      ]),
    }],
  ])],
  ["osenv", new Map([
    ["0.1.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-osenv-0.1.5-85cdfafaeb28e8677f416e287592b5f3f49ea410/node_modules/osenv/"),
      packageDependencies: new Map([
        ["os-homedir", "1.0.2"],
        ["os-tmpdir", "1.0.2"],
        ["osenv", "0.1.5"],
      ]),
    }],
  ])],
  ["os-homedir", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-os-homedir-1.0.2-ffbc4988336e0e833de0c168c7ef152121aa7fb3/node_modules/os-homedir/"),
      packageDependencies: new Map([
        ["os-homedir", "1.0.2"],
      ]),
    }],
  ])],
  ["os-tmpdir", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-os-tmpdir-1.0.2-bbe67406c79aa85c5cfec766fe5734555dfa1274/node_modules/os-tmpdir/"),
      packageDependencies: new Map([
        ["os-tmpdir", "1.0.2"],
      ]),
    }],
  ])],
  ["validate-npm-package-name", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-validate-npm-package-name-3.0.0-5fa912d81eb7d0c74afc140de7317f0ca7df437e/node_modules/validate-npm-package-name/"),
      packageDependencies: new Map([
        ["builtins", "1.0.3"],
        ["validate-npm-package-name", "3.0.0"],
      ]),
    }],
  ])],
  ["builtins", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-builtins-1.0.3-cb94faeb61c8696451db36534e1422f94f0aee88/node_modules/builtins/"),
      packageDependencies: new Map([
        ["builtins", "1.0.3"],
      ]),
    }],
  ])],
  ["pacote", new Map([
    ["9.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pacote-9.5.0-85f3013a3f6dd51c108b0ccabd3de8102ddfaeda/node_modules/pacote/"),
      packageDependencies: new Map([
        ["bluebird", "3.5.3"],
        ["cacache", "11.3.2"],
        ["figgy-pudding", "3.5.1"],
        ["get-stream", "4.1.0"],
        ["glob", "7.1.3"],
        ["lru-cache", "5.1.1"],
        ["make-fetch-happen", "4.0.1"],
        ["minimatch", "3.0.4"],
        ["minipass", "2.3.5"],
        ["mississippi", "3.0.0"],
        ["mkdirp", "0.5.1"],
        ["normalize-package-data", "2.5.0"],
        ["npm-package-arg", "6.1.0"],
        ["npm-packlist", "1.3.0"],
        ["npm-pick-manifest", "2.2.3"],
        ["npm-registry-fetch", "3.9.0"],
        ["osenv", "0.1.5"],
        ["promise-inflight", "1.0.1"],
        ["promise-retry", "1.1.1"],
        ["protoduck", "5.0.1"],
        ["rimraf", "2.6.3"],
        ["safe-buffer", "5.1.2"],
        ["semver", "5.6.0"],
        ["ssri", "6.0.1"],
        ["tar", "4.4.8"],
        ["unique-filename", "1.1.1"],
        ["which", "1.3.1"],
        ["pacote", "9.5.0"],
      ]),
    }],
  ])],
  ["bluebird", new Map([
    ["3.5.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-bluebird-3.5.3-7d01c6f9616c9a51ab0f8c549a79dfe6ec33efa7/node_modules/bluebird/"),
      packageDependencies: new Map([
        ["bluebird", "3.5.3"],
      ]),
    }],
  ])],
  ["cacache", new Map([
    ["11.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cacache-11.3.2-2d81e308e3d258ca38125b676b98b2ac9ce69bfa/node_modules/cacache/"),
      packageDependencies: new Map([
        ["bluebird", "3.5.3"],
        ["chownr", "1.1.1"],
        ["figgy-pudding", "3.5.1"],
        ["glob", "7.1.3"],
        ["graceful-fs", "4.1.15"],
        ["lru-cache", "5.1.1"],
        ["mississippi", "3.0.0"],
        ["mkdirp", "0.5.1"],
        ["move-concurrently", "1.0.1"],
        ["promise-inflight", "1.0.1"],
        ["rimraf", "2.6.3"],
        ["ssri", "6.0.1"],
        ["unique-filename", "1.1.1"],
        ["y18n", "4.0.0"],
        ["cacache", "11.3.2"],
      ]),
    }],
  ])],
  ["chownr", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chownr-1.1.1-54726b8b8fff4df053c42187e801fb4412df1494/node_modules/chownr/"),
      packageDependencies: new Map([
        ["chownr", "1.1.1"],
      ]),
    }],
  ])],
  ["figgy-pudding", new Map([
    ["3.5.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-figgy-pudding-3.5.1-862470112901c727a0e495a80744bd5baa1d6790/node_modules/figgy-pudding/"),
      packageDependencies: new Map([
        ["figgy-pudding", "3.5.1"],
      ]),
    }],
  ])],
  ["mississippi", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mississippi-3.0.0-ea0a3291f97e0b5e8776b363d5f0a12d94c67022/node_modules/mississippi/"),
      packageDependencies: new Map([
        ["concat-stream", "1.6.2"],
        ["duplexify", "3.7.1"],
        ["end-of-stream", "1.4.1"],
        ["flush-write-stream", "1.1.1"],
        ["from2", "2.3.0"],
        ["parallel-transform", "1.1.0"],
        ["pump", "3.0.0"],
        ["pumpify", "1.5.1"],
        ["stream-each", "1.2.3"],
        ["through2", "2.0.5"],
        ["mississippi", "3.0.0"],
      ]),
    }],
  ])],
  ["concat-stream", new Map([
    ["1.6.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-concat-stream-1.6.2-904bdf194cd3122fc675c77fc4ac3d4ff0fd1a34/node_modules/concat-stream/"),
      packageDependencies: new Map([
        ["buffer-from", "1.1.1"],
        ["inherits", "2.0.3"],
        ["readable-stream", "2.3.6"],
        ["typedarray", "0.0.6"],
        ["concat-stream", "1.6.2"],
      ]),
    }],
  ])],
  ["buffer-from", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-buffer-from-1.1.1-32713bc028f75c02fdb710d7c7bcec1f2c6070ef/node_modules/buffer-from/"),
      packageDependencies: new Map([
        ["buffer-from", "1.1.1"],
      ]),
    }],
  ])],
  ["typedarray", new Map([
    ["0.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-typedarray-0.0.6-867ac74e3864187b1d3d47d996a78ec5c8830777/node_modules/typedarray/"),
      packageDependencies: new Map([
        ["typedarray", "0.0.6"],
      ]),
    }],
  ])],
  ["duplexify", new Map([
    ["3.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-duplexify-3.7.1-2a4df5317f6ccfd91f86d6fd25d8d8a103b88309/node_modules/duplexify/"),
      packageDependencies: new Map([
        ["end-of-stream", "1.4.1"],
        ["inherits", "2.0.3"],
        ["readable-stream", "2.3.6"],
        ["stream-shift", "1.0.0"],
        ["duplexify", "3.7.1"],
      ]),
    }],
  ])],
  ["stream-shift", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-stream-shift-1.0.0-d5c752825e5367e786f78e18e445ea223a155952/node_modules/stream-shift/"),
      packageDependencies: new Map([
        ["stream-shift", "1.0.0"],
      ]),
    }],
  ])],
  ["flush-write-stream", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-flush-write-stream-1.1.1-8dd7d873a1babc207d94ead0c2e0e44276ebf2e8/node_modules/flush-write-stream/"),
      packageDependencies: new Map([
        ["inherits", "2.0.3"],
        ["readable-stream", "2.3.6"],
        ["flush-write-stream", "1.1.1"],
      ]),
    }],
  ])],
  ["parallel-transform", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parallel-transform-1.1.0-d410f065b05da23081fcd10f28854c29bda33b06/node_modules/parallel-transform/"),
      packageDependencies: new Map([
        ["cyclist", "0.2.2"],
        ["inherits", "2.0.3"],
        ["readable-stream", "2.3.6"],
        ["parallel-transform", "1.1.0"],
      ]),
    }],
  ])],
  ["cyclist", new Map([
    ["0.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cyclist-0.2.2-1b33792e11e914a2fd6d6ed6447464444e5fa640/node_modules/cyclist/"),
      packageDependencies: new Map([
        ["cyclist", "0.2.2"],
      ]),
    }],
  ])],
  ["pumpify", new Map([
    ["1.5.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pumpify-1.5.1-36513be246ab27570b1a374a5ce278bfd74370ce/node_modules/pumpify/"),
      packageDependencies: new Map([
        ["duplexify", "3.7.1"],
        ["inherits", "2.0.3"],
        ["pump", "2.0.1"],
        ["pumpify", "1.5.1"],
      ]),
    }],
  ])],
  ["stream-each", new Map([
    ["1.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-stream-each-1.2.3-ebe27a0c389b04fbcc233642952e10731afa9bae/node_modules/stream-each/"),
      packageDependencies: new Map([
        ["end-of-stream", "1.4.1"],
        ["stream-shift", "1.0.0"],
        ["stream-each", "1.2.3"],
      ]),
    }],
  ])],
  ["through2", new Map([
    ["2.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-through2-2.0.5-01c1e39eb31d07cb7d03a96a70823260b23132cd/node_modules/through2/"),
      packageDependencies: new Map([
        ["readable-stream", "2.3.6"],
        ["xtend", "4.0.1"],
        ["through2", "2.0.5"],
      ]),
    }],
  ])],
  ["xtend", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-xtend-4.0.1-a5c6d532be656e23db820efb943a1f04998d63af/node_modules/xtend/"),
      packageDependencies: new Map([
        ["xtend", "4.0.1"],
      ]),
    }],
  ])],
  ["move-concurrently", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-move-concurrently-1.0.1-be2c005fda32e0b29af1f05d7c4b33214c701f92/node_modules/move-concurrently/"),
      packageDependencies: new Map([
        ["aproba", "1.2.0"],
        ["copy-concurrently", "1.0.5"],
        ["fs-write-stream-atomic", "1.0.10"],
        ["mkdirp", "0.5.1"],
        ["rimraf", "2.6.3"],
        ["run-queue", "1.0.3"],
        ["move-concurrently", "1.0.1"],
      ]),
    }],
  ])],
  ["aproba", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-aproba-1.2.0-6802e6264efd18c790a1b0d517f0f2627bf2c94a/node_modules/aproba/"),
      packageDependencies: new Map([
        ["aproba", "1.2.0"],
      ]),
    }],
  ])],
  ["copy-concurrently", new Map([
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-copy-concurrently-1.0.5-92297398cae34937fcafd6ec8139c18051f0b5e0/node_modules/copy-concurrently/"),
      packageDependencies: new Map([
        ["aproba", "1.2.0"],
        ["fs-write-stream-atomic", "1.0.10"],
        ["iferr", "0.1.5"],
        ["mkdirp", "0.5.1"],
        ["rimraf", "2.6.3"],
        ["run-queue", "1.0.3"],
        ["copy-concurrently", "1.0.5"],
      ]),
    }],
  ])],
  ["fs-write-stream-atomic", new Map([
    ["1.0.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fs-write-stream-atomic-1.0.10-b47df53493ef911df75731e70a9ded0189db40c9/node_modules/fs-write-stream-atomic/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["iferr", "0.1.5"],
        ["imurmurhash", "0.1.4"],
        ["readable-stream", "2.3.6"],
        ["fs-write-stream-atomic", "1.0.10"],
      ]),
    }],
  ])],
  ["iferr", new Map([
    ["0.1.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-iferr-0.1.5-c60eed69e6d8fdb6b3104a1fcbca1c192dc5b501/node_modules/iferr/"),
      packageDependencies: new Map([
        ["iferr", "0.1.5"],
      ]),
    }],
  ])],
  ["rimraf", new Map([
    ["2.6.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rimraf-2.6.3-b2d104fe0d8fb27cf9e0a1cda8262dd3833c6cab/node_modules/rimraf/"),
      packageDependencies: new Map([
        ["glob", "7.1.3"],
        ["rimraf", "2.6.3"],
      ]),
    }],
  ])],
  ["run-queue", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-run-queue-1.0.3-e848396f057d223f24386924618e25694161ec47/node_modules/run-queue/"),
      packageDependencies: new Map([
        ["aproba", "1.2.0"],
        ["run-queue", "1.0.3"],
      ]),
    }],
  ])],
  ["promise-inflight", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-promise-inflight-1.0.1-98472870bf228132fcbdd868129bad12c3c029e3/node_modules/promise-inflight/"),
      packageDependencies: new Map([
        ["promise-inflight", "1.0.1"],
      ]),
    }],
  ])],
  ["ssri", new Map([
    ["6.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ssri-6.0.1-2a3c41b28dd45b62b63676ecb74001265ae9edd8/node_modules/ssri/"),
      packageDependencies: new Map([
        ["figgy-pudding", "3.5.1"],
        ["ssri", "6.0.1"],
      ]),
    }],
  ])],
  ["unique-filename", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unique-filename-1.1.1-1d69769369ada0583103a1e6ae87681b56573230/node_modules/unique-filename/"),
      packageDependencies: new Map([
        ["unique-slug", "2.0.1"],
        ["unique-filename", "1.1.1"],
      ]),
    }],
  ])],
  ["unique-slug", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-unique-slug-2.0.1-5e9edc6d1ce8fb264db18a507ef9bd8544451ca6/node_modules/unique-slug/"),
      packageDependencies: new Map([
        ["imurmurhash", "0.1.4"],
        ["unique-slug", "2.0.1"],
      ]),
    }],
  ])],
  ["make-fetch-happen", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-make-fetch-happen-4.0.1-141497cb878f243ba93136c83d8aba12c216c083/node_modules/make-fetch-happen/"),
      packageDependencies: new Map([
        ["agentkeepalive", "3.5.2"],
        ["cacache", "11.3.2"],
        ["http-cache-semantics", "3.8.1"],
        ["http-proxy-agent", "2.1.0"],
        ["https-proxy-agent", "2.2.1"],
        ["lru-cache", "4.1.5"],
        ["mississippi", "3.0.0"],
        ["node-fetch-npm", "2.0.2"],
        ["promise-retry", "1.1.1"],
        ["socks-proxy-agent", "4.0.1"],
        ["ssri", "6.0.1"],
        ["make-fetch-happen", "4.0.1"],
      ]),
    }],
  ])],
  ["agentkeepalive", new Map([
    ["3.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-agentkeepalive-3.5.2-a113924dd3fa24a0bc3b78108c450c2abee00f67/node_modules/agentkeepalive/"),
      packageDependencies: new Map([
        ["humanize-ms", "1.2.1"],
        ["agentkeepalive", "3.5.2"],
      ]),
    }],
  ])],
  ["humanize-ms", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-humanize-ms-1.2.1-c46e3159a293f6b896da29316d8b6fe8bb79bbed/node_modules/humanize-ms/"),
      packageDependencies: new Map([
        ["ms", "2.1.1"],
        ["humanize-ms", "1.2.1"],
      ]),
    }],
  ])],
  ["http-proxy-agent", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-http-proxy-agent-2.1.0-e4821beef5b2142a2026bd73926fe537631c5405/node_modules/http-proxy-agent/"),
      packageDependencies: new Map([
        ["agent-base", "4.2.1"],
        ["debug", "3.1.0"],
        ["http-proxy-agent", "2.1.0"],
      ]),
    }],
  ])],
  ["agent-base", new Map([
    ["4.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-agent-base-4.2.1-d89e5999f797875674c07d87f260fc41e83e8ca9/node_modules/agent-base/"),
      packageDependencies: new Map([
        ["es6-promisify", "5.0.0"],
        ["agent-base", "4.2.1"],
      ]),
    }],
  ])],
  ["es6-promisify", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-es6-promisify-5.0.0-5109d62f3e56ea967c4b63505aef08291c8a5203/node_modules/es6-promisify/"),
      packageDependencies: new Map([
        ["es6-promise", "4.2.5"],
        ["es6-promisify", "5.0.0"],
      ]),
    }],
  ])],
  ["https-proxy-agent", new Map([
    ["2.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-https-proxy-agent-2.2.1-51552970fa04d723e04c56d04178c3f92592bbc0/node_modules/https-proxy-agent/"),
      packageDependencies: new Map([
        ["agent-base", "4.2.1"],
        ["debug", "3.2.6"],
        ["https-proxy-agent", "2.2.1"],
      ]),
    }],
  ])],
  ["node-fetch-npm", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-fetch-npm-2.0.2-7258c9046182dca345b4208eda918daf33697ff7/node_modules/node-fetch-npm/"),
      packageDependencies: new Map([
        ["encoding", "0.1.12"],
        ["json-parse-better-errors", "1.0.2"],
        ["safe-buffer", "5.1.2"],
        ["node-fetch-npm", "2.0.2"],
      ]),
    }],
  ])],
  ["encoding", new Map([
    ["0.1.12", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-encoding-0.1.12-538b66f3ee62cd1ab51ec323829d1f9480c74beb/node_modules/encoding/"),
      packageDependencies: new Map([
        ["iconv-lite", "0.4.24"],
        ["encoding", "0.1.12"],
      ]),
    }],
  ])],
  ["iconv-lite", new Map([
    ["0.4.24", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-iconv-lite-0.4.24-2022b4b25fbddc21d2f524974a474aafe733908b/node_modules/iconv-lite/"),
      packageDependencies: new Map([
        ["safer-buffer", "2.1.2"],
        ["iconv-lite", "0.4.24"],
      ]),
    }],
  ])],
  ["safer-buffer", new Map([
    ["2.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-safer-buffer-2.1.2-44fa161b0187b9549dd84bb91802f9bd8385cd6a/node_modules/safer-buffer/"),
      packageDependencies: new Map([
        ["safer-buffer", "2.1.2"],
      ]),
    }],
  ])],
  ["promise-retry", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-promise-retry-1.1.1-6739e968e3051da20ce6497fb2b50f6911df3d6d/node_modules/promise-retry/"),
      packageDependencies: new Map([
        ["err-code", "1.1.2"],
        ["retry", "0.10.1"],
        ["promise-retry", "1.1.1"],
      ]),
    }],
  ])],
  ["err-code", new Map([
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-err-code-1.1.2-06e0116d3028f6aef4806849eb0ea6a748ae6960/node_modules/err-code/"),
      packageDependencies: new Map([
        ["err-code", "1.1.2"],
      ]),
    }],
  ])],
  ["retry", new Map([
    ["0.10.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-retry-0.10.1-e76388d217992c252750241d3d3956fed98d8ff4/node_modules/retry/"),
      packageDependencies: new Map([
        ["retry", "0.10.1"],
      ]),
    }],
  ])],
  ["socks-proxy-agent", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-socks-proxy-agent-4.0.1-5936bf8b707a993079c6f37db2091821bffa6473/node_modules/socks-proxy-agent/"),
      packageDependencies: new Map([
        ["agent-base", "4.2.1"],
        ["socks", "2.2.3"],
        ["socks-proxy-agent", "4.0.1"],
      ]),
    }],
  ])],
  ["socks", new Map([
    ["2.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-socks-2.2.3-7399ce11e19b2a997153c983a9ccb6306721f2dc/node_modules/socks/"),
      packageDependencies: new Map([
        ["ip", "1.1.5"],
        ["smart-buffer", "4.0.2"],
        ["socks", "2.2.3"],
      ]),
    }],
  ])],
  ["ip", new Map([
    ["1.1.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ip-1.1.5-bdded70114290828c0a039e72ef25f5aaec4354a/node_modules/ip/"),
      packageDependencies: new Map([
        ["ip", "1.1.5"],
      ]),
    }],
  ])],
  ["smart-buffer", new Map([
    ["4.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-smart-buffer-4.0.2-5207858c3815cc69110703c6b94e46c15634395d/node_modules/smart-buffer/"),
      packageDependencies: new Map([
        ["smart-buffer", "4.0.2"],
      ]),
    }],
  ])],
  ["minipass", new Map([
    ["2.3.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-minipass-2.3.5-cacebe492022497f656b0f0f51e2682a9ed2d848/node_modules/minipass/"),
      packageDependencies: new Map([
        ["safe-buffer", "5.1.2"],
        ["yallist", "3.0.3"],
        ["minipass", "2.3.5"],
      ]),
    }],
  ])],
  ["npm-packlist", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-packlist-1.3.0-7f01e8e44408341379ca98cfd756e7b29bd2626c/node_modules/npm-packlist/"),
      packageDependencies: new Map([
        ["ignore-walk", "3.0.1"],
        ["npm-bundled", "1.0.6"],
        ["npm-packlist", "1.3.0"],
      ]),
    }],
  ])],
  ["ignore-walk", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ignore-walk-3.0.1-a83e62e7d272ac0e3b551aaa82831a19b69f82f8/node_modules/ignore-walk/"),
      packageDependencies: new Map([
        ["minimatch", "3.0.4"],
        ["ignore-walk", "3.0.1"],
      ]),
    }],
  ])],
  ["npm-bundled", new Map([
    ["1.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-bundled-1.0.6-e7ba9aadcef962bb61248f91721cd932b3fe6bdd/node_modules/npm-bundled/"),
      packageDependencies: new Map([
        ["npm-bundled", "1.0.6"],
      ]),
    }],
  ])],
  ["npm-pick-manifest", new Map([
    ["2.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-pick-manifest-2.2.3-32111d2a9562638bb2c8f2bf27f7f3092c8fae40/node_modules/npm-pick-manifest/"),
      packageDependencies: new Map([
        ["figgy-pudding", "3.5.1"],
        ["npm-package-arg", "6.1.0"],
        ["semver", "5.6.0"],
        ["npm-pick-manifest", "2.2.3"],
      ]),
    }],
  ])],
  ["npm-registry-fetch", new Map([
    ["3.9.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-registry-fetch-3.9.0-44d841780e2833f06accb34488f8c7450d1a6856/node_modules/npm-registry-fetch/"),
      packageDependencies: new Map([
        ["JSONStream", "1.3.5"],
        ["bluebird", "3.5.3"],
        ["figgy-pudding", "3.5.1"],
        ["lru-cache", "4.1.5"],
        ["make-fetch-happen", "4.0.1"],
        ["npm-package-arg", "6.1.0"],
        ["npm-registry-fetch", "3.9.0"],
      ]),
    }],
  ])],
  ["JSONStream", new Map([
    ["1.3.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tream-1.3.5-3208c1f08d3a4d99261ab64f92302bc15e111ca0/node_modules/JSONStream/"),
      packageDependencies: new Map([
        ["jsonparse", "1.3.1"],
        ["through", "2.3.8"],
        ["JSONStream", "1.3.5"],
      ]),
    }],
  ])],
  ["jsonparse", new Map([
    ["1.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsonparse-1.3.1-3f4dae4a91fac315f71062f8521cc239f1366280/node_modules/jsonparse/"),
      packageDependencies: new Map([
        ["jsonparse", "1.3.1"],
      ]),
    }],
  ])],
  ["through", new Map([
    ["2.3.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-through-2.3.8-0dd4c9ffaabc357960b1b724115d7e0e86a2e1f5/node_modules/through/"),
      packageDependencies: new Map([
        ["through", "2.3.8"],
      ]),
    }],
  ])],
  ["protoduck", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-protoduck-5.0.1-03c3659ca18007b69a50fd82a7ebcc516261151f/node_modules/protoduck/"),
      packageDependencies: new Map([
        ["genfun", "5.0.0"],
        ["protoduck", "5.0.1"],
      ]),
    }],
  ])],
  ["genfun", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-genfun-5.0.0-9dd9710a06900a5c4a5bf57aca5da4e52fe76537/node_modules/genfun/"),
      packageDependencies: new Map([
        ["genfun", "5.0.0"],
      ]),
    }],
  ])],
  ["tar", new Map([
    ["4.4.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tar-4.4.8-b19eec3fde2a96e64666df9fdb40c5ca1bc3747d/node_modules/tar/"),
      packageDependencies: new Map([
        ["chownr", "1.1.1"],
        ["fs-minipass", "1.2.5"],
        ["minipass", "2.3.5"],
        ["minizlib", "1.2.1"],
        ["mkdirp", "0.5.1"],
        ["safe-buffer", "5.1.2"],
        ["yallist", "3.0.3"],
        ["tar", "4.4.8"],
      ]),
    }],
  ])],
  ["fs-minipass", new Map([
    ["1.2.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fs-minipass-1.2.5-06c277218454ec288df77ada54a03b8702aacb9d/node_modules/fs-minipass/"),
      packageDependencies: new Map([
        ["minipass", "2.3.5"],
        ["fs-minipass", "1.2.5"],
      ]),
    }],
  ])],
  ["minizlib", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-minizlib-1.2.1-dd27ea6136243c7c880684e8672bb3a45fd9b614/node_modules/minizlib/"),
      packageDependencies: new Map([
        ["minipass", "2.3.5"],
        ["minizlib", "1.2.1"],
      ]),
    }],
  ])],
  ["symlink-dir", new Map([
    ["1.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-symlink-dir-1.1.3-b09af9599af5310c2fb77adc0c1613dee382ce4e/node_modules/symlink-dir/"),
      packageDependencies: new Map([
        ["@types/mz", "0.0.32"],
        ["@types/node", "10.14.3"],
        ["graceful-fs", "4.1.15"],
        ["is-windows", "1.0.2"],
        ["mkdirp-promise", "5.0.1"],
        ["mz", "2.7.0"],
        ["symlink-dir", "1.1.3"],
      ]),
    }],
  ])],
  ["@types/mz", new Map([
    ["0.0.32", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-mz-0.0.32-e8248b4e41424c052edc1725dd33650c313a3659/node_modules/@types/mz/"),
      packageDependencies: new Map([
        ["@types/node", "11.11.6"],
        ["@types/mz", "0.0.32"],
      ]),
    }],
  ])],
  ["write-json-file", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-write-json-file-2.3.0-2b64c8a33004d54b8698c76d585a77ceb61da32f/node_modules/write-json-file/"),
      packageDependencies: new Map([
        ["detect-indent", "5.0.0"],
        ["graceful-fs", "4.1.15"],
        ["make-dir", "1.3.0"],
        ["pify", "3.0.0"],
        ["sort-keys", "2.0.0"],
        ["write-file-atomic", "2.4.2"],
        ["write-json-file", "2.3.0"],
      ]),
    }],
  ])],
  ["detect-indent", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-detect-indent-5.0.0-3871cc0a6a002e8c3e5b3cf7f336264675f06b9d/node_modules/detect-indent/"),
      packageDependencies: new Map([
        ["detect-indent", "5.0.0"],
      ]),
    }],
  ])],
  ["write-pkg", new Map([
    ["3.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-write-pkg-3.2.0-0e178fe97820d389a8928bc79535dbe68c2cff21/node_modules/write-pkg/"),
      packageDependencies: new Map([
        ["sort-keys", "2.0.0"],
        ["write-json-file", "2.3.0"],
        ["write-pkg", "3.2.0"],
      ]),
    }],
  ])],
  ["@quase/pathname", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/pathname/"),
      packageDependencies: new Map([
      ]),
    }],
  ])],
  ["@quase/publisher", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/publisher/"),
      packageDependencies: new Map([
        ["@quase/cli", "0.4.0-0"],
        ["@samverschueren/stream-to-observable", "0.3.0"],
        ["any-observable", "0.3.0"],
        ["colorette", "1.0.7"],
        ["del", "4.0.0"],
        ["execa", "1.0.0"],
        ["fs-extra", "7.0.1"],
        ["github-url-from-git", "1.5.0"],
        ["has-yarn", "2.0.0"],
        ["inquirer", "6.2.2"],
        ["issue-regex", "3.0.0"],
        ["npm-name", "5.2.0"],
        ["p-timeout", "3.0.0"],
        ["pretty-version-diff", "1.0.0"],
        ["listr", "0.14.3"],
        ["listr-input", "0.1.3"],
        ["log-symbols", "2.2.0"],
        ["read-pkg", "5.0.0"],
        ["rxjs", "6.4.0"],
        ["semver", "5.6.0"],
        ["slash", "2.0.0"],
        ["split", "1.0.1"],
        ["symbol-observable", "1.2.0"],
        ["terminal-link", "1.2.0"],
      ]),
    }],
  ])],
  ["@samverschueren/stream-to-observable", new Map([
    ["0.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@samverschueren-stream-to-observable-0.3.0-ecdf48d532c58ea477acfcab80348424f8d0662f/node_modules/@samverschueren/stream-to-observable/"),
      packageDependencies: new Map([
        ["any-observable", "0.3.0"],
        ["@samverschueren/stream-to-observable", "0.3.0"],
      ]),
    }],
  ])],
  ["any-observable", new Map([
    ["0.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-any-observable-0.3.0-af933475e5806a67d0d7df090dd5e8bef65d119b/node_modules/any-observable/"),
      packageDependencies: new Map([
        ["any-observable", "0.3.0"],
      ]),
    }],
  ])],
  ["del", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-del-4.0.0-4fa27e92c366cb45b9bdaa56a9b8703dced17437/node_modules/del/"),
      packageDependencies: new Map([
        ["globby", "6.1.0"],
        ["is-path-cwd", "2.0.0"],
        ["is-path-in-cwd", "2.0.0"],
        ["p-map", "2.0.0"],
        ["pify", "4.0.1"],
        ["rimraf", "2.6.3"],
        ["del", "4.0.0"],
      ]),
    }],
  ])],
  ["globby", new Map([
    ["6.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-globby-6.1.0-f5a6d70e8395e21c858fb0489d64df02424d506c/node_modules/globby/"),
      packageDependencies: new Map([
        ["array-union", "1.0.2"],
        ["glob", "7.1.3"],
        ["object-assign", "4.1.1"],
        ["pify", "2.3.0"],
        ["pinkie-promise", "2.0.1"],
        ["globby", "6.1.0"],
      ]),
    }],
    ["8.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-globby-8.0.2-5697619ccd95c5275dbb2d6faa42087c1a941d8d/node_modules/globby/"),
      packageDependencies: new Map([
        ["array-union", "1.0.2"],
        ["dir-glob", "2.0.0"],
        ["fast-glob", "2.2.6"],
        ["glob", "7.1.3"],
        ["ignore", "3.3.10"],
        ["pify", "3.0.0"],
        ["slash", "1.0.0"],
        ["globby", "8.0.2"],
      ]),
    }],
  ])],
  ["array-union", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-array-union-1.0.2-9a34410e4f4e3da23dea375be5be70f24778ec39/node_modules/array-union/"),
      packageDependencies: new Map([
        ["array-uniq", "1.0.3"],
        ["array-union", "1.0.2"],
      ]),
    }],
  ])],
  ["array-uniq", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-array-uniq-1.0.3-af6ac877a25cc7f74e058894753858dfdb24fdb6/node_modules/array-uniq/"),
      packageDependencies: new Map([
        ["array-uniq", "1.0.3"],
      ]),
    }],
  ])],
  ["is-path-cwd", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-path-cwd-2.0.0-d4777a8e227a00096a31f030db3770f84b116c02/node_modules/is-path-cwd/"),
      packageDependencies: new Map([
        ["is-path-cwd", "2.0.0"],
      ]),
    }],
  ])],
  ["is-path-in-cwd", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-path-in-cwd-2.0.0-68e452a6eec260500cec21e029c0a44cc0dcd2ea/node_modules/is-path-in-cwd/"),
      packageDependencies: new Map([
        ["is-path-inside", "1.0.1"],
        ["is-path-in-cwd", "2.0.0"],
      ]),
    }],
  ])],
  ["p-map", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-map-2.0.0-be18c5a5adeb8e156460651421aceca56c213a50/node_modules/p-map/"),
      packageDependencies: new Map([
        ["p-map", "2.0.0"],
      ]),
    }],
  ])],
  ["github-url-from-git", new Map([
    ["1.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-github-url-from-git-1.5.0-f985fedcc0a9aa579dc88d7aff068d55cc6251a0/node_modules/github-url-from-git/"),
      packageDependencies: new Map([
        ["github-url-from-git", "1.5.0"],
      ]),
    }],
  ])],
  ["inquirer", new Map([
    ["6.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-inquirer-6.2.2-46941176f65c9eb20804627149b743a218f25406/node_modules/inquirer/"),
      packageDependencies: new Map([
        ["ansi-escapes", "3.2.0"],
        ["chalk", "2.4.2"],
        ["cli-cursor", "2.1.0"],
        ["cli-width", "2.2.0"],
        ["external-editor", "3.0.3"],
        ["figures", "2.0.0"],
        ["lodash", "4.17.11"],
        ["mute-stream", "0.0.7"],
        ["run-async", "2.3.0"],
        ["rxjs", "6.4.0"],
        ["string-width", "2.1.1"],
        ["strip-ansi", "5.0.0"],
        ["through", "2.3.8"],
        ["inquirer", "6.2.2"],
      ]),
    }],
    ["3.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-inquirer-3.3.0-9dd2f2ad765dcab1ff0443b491442a20ba227dc9/node_modules/inquirer/"),
      packageDependencies: new Map([
        ["ansi-escapes", "3.2.0"],
        ["chalk", "2.4.2"],
        ["cli-cursor", "2.1.0"],
        ["cli-width", "2.2.0"],
        ["external-editor", "2.2.0"],
        ["figures", "2.0.0"],
        ["lodash", "4.17.11"],
        ["mute-stream", "0.0.7"],
        ["run-async", "2.3.0"],
        ["rx-lite", "4.0.8"],
        ["rx-lite-aggregates", "4.0.8"],
        ["string-width", "2.1.1"],
        ["strip-ansi", "4.0.0"],
        ["through", "2.3.8"],
        ["inquirer", "3.3.0"],
      ]),
    }],
  ])],
  ["ansi-escapes", new Map([
    ["3.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ansi-escapes-3.2.0-8780b98ff9dbf5638152d1f1fe5c1d7b4442976b/node_modules/ansi-escapes/"),
      packageDependencies: new Map([
        ["ansi-escapes", "3.2.0"],
      ]),
    }],
  ])],
  ["cli-width", new Map([
    ["2.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-width-2.2.0-ff19ede8a9a5e579324147b0c11f0fbcbabed639/node_modules/cli-width/"),
      packageDependencies: new Map([
        ["cli-width", "2.2.0"],
      ]),
    }],
  ])],
  ["external-editor", new Map([
    ["3.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-external-editor-3.0.3-5866db29a97826dbe4bf3afd24070ead9ea43a27/node_modules/external-editor/"),
      packageDependencies: new Map([
        ["chardet", "0.7.0"],
        ["iconv-lite", "0.4.24"],
        ["tmp", "0.0.33"],
        ["external-editor", "3.0.3"],
      ]),
    }],
    ["2.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-external-editor-2.2.0-045511cfd8d133f3846673d1047c154e214ad3d5/node_modules/external-editor/"),
      packageDependencies: new Map([
        ["chardet", "0.4.2"],
        ["iconv-lite", "0.4.24"],
        ["tmp", "0.0.33"],
        ["external-editor", "2.2.0"],
      ]),
    }],
  ])],
  ["chardet", new Map([
    ["0.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chardet-0.7.0-90094849f0937f2eedc2425d0d28a9e5f0cbad9e/node_modules/chardet/"),
      packageDependencies: new Map([
        ["chardet", "0.7.0"],
      ]),
    }],
    ["0.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-chardet-0.4.2-b5473b33dc97c424e5d98dc87d55d4d8a29c8bf2/node_modules/chardet/"),
      packageDependencies: new Map([
        ["chardet", "0.4.2"],
      ]),
    }],
  ])],
  ["tmp", new Map([
    ["0.0.33", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tmp-0.0.33-6d34335889768d21b2bcda0aa277ced3b1bfadf9/node_modules/tmp/"),
      packageDependencies: new Map([
        ["os-tmpdir", "1.0.2"],
        ["tmp", "0.0.33"],
      ]),
    }],
    ["0.0.31", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tmp-0.0.31-8f38ab9438e17315e5dbd8b3657e8bfb277ae4a7/node_modules/tmp/"),
      packageDependencies: new Map([
        ["os-tmpdir", "1.0.2"],
        ["tmp", "0.0.31"],
      ]),
    }],
  ])],
  ["figures", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-figures-2.0.0-3ab1a2d2a62c8bfb431a0c94cb797a2fce27c962/node_modules/figures/"),
      packageDependencies: new Map([
        ["escape-string-regexp", "1.0.5"],
        ["figures", "2.0.0"],
      ]),
    }],
    ["1.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-figures-1.7.0-cbe1e3affcf1cd44b80cadfed28dc793a9701d2e/node_modules/figures/"),
      packageDependencies: new Map([
        ["escape-string-regexp", "1.0.5"],
        ["object-assign", "4.1.1"],
        ["figures", "1.7.0"],
      ]),
    }],
  ])],
  ["mute-stream", new Map([
    ["0.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mute-stream-0.0.7-3075ce93bc21b8fab43e1bc4da7e8115ed1e7bab/node_modules/mute-stream/"),
      packageDependencies: new Map([
        ["mute-stream", "0.0.7"],
      ]),
    }],
  ])],
  ["run-async", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-run-async-2.3.0-0371ab4ae0bdd720d4166d7dfda64ff7a445a6c0/node_modules/run-async/"),
      packageDependencies: new Map([
        ["is-promise", "2.1.0"],
        ["run-async", "2.3.0"],
      ]),
    }],
  ])],
  ["is-promise", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-promise-2.1.0-79a2a9ece7f096e80f36d2b2f3bc16c1ff4bf3fa/node_modules/is-promise/"),
      packageDependencies: new Map([
        ["is-promise", "2.1.0"],
      ]),
    }],
  ])],
  ["rxjs", new Map([
    ["6.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rxjs-6.4.0-f3bb0fe7bda7fb69deac0c16f17b50b0b8790504/node_modules/rxjs/"),
      packageDependencies: new Map([
        ["tslib", "1.9.3"],
        ["rxjs", "6.4.0"],
      ]),
    }],
    ["5.5.12", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rxjs-5.5.12-6fa61b8a77c3d793dbaf270bee2f43f652d741cc/node_modules/rxjs/"),
      packageDependencies: new Map([
        ["symbol-observable", "1.0.1"],
        ["rxjs", "5.5.12"],
      ]),
    }],
  ])],
  ["tslib", new Map([
    ["1.9.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tslib-1.9.3-d7e4dd79245d85428c4d7e4822a79917954ca286/node_modules/tslib/"),
      packageDependencies: new Map([
        ["tslib", "1.9.3"],
      ]),
    }],
  ])],
  ["issue-regex", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-issue-regex-3.0.0-275c5dac460e7827819f749747baf686109695b7/node_modules/issue-regex/"),
      packageDependencies: new Map([
        ["issue-regex", "3.0.0"],
      ]),
    }],
  ])],
  ["npm-name", new Map([
    ["5.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-npm-name-5.2.0-652e53c2b007d4cc0a685014885ca478d7886f6a/node_modules/npm-name/"),
      packageDependencies: new Map([
        ["got", "9.6.0"],
        ["is-scoped", "1.0.0"],
        ["lodash.zip", "4.2.0"],
        ["registry-auth-token", "3.4.0"],
        ["registry-url", "4.0.0"],
        ["validate-npm-package-name", "3.0.0"],
        ["npm-name", "5.2.0"],
      ]),
    }],
  ])],
  ["@szmarczak/http-timer", new Map([
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@szmarczak-http-timer-1.1.2-b1665e2c461a2cd92f4c1bbf50d5454de0d4b421/node_modules/@szmarczak/http-timer/"),
      packageDependencies: new Map([
        ["defer-to-connect", "1.0.2"],
        ["@szmarczak/http-timer", "1.1.2"],
      ]),
    }],
  ])],
  ["defer-to-connect", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-defer-to-connect-1.0.2-4bae758a314b034ae33902b5aac25a8dd6a8633e/node_modules/defer-to-connect/"),
      packageDependencies: new Map([
        ["defer-to-connect", "1.0.2"],
      ]),
    }],
  ])],
  ["to-readable-stream", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-to-readable-stream-1.0.0-ce0aa0c2f3df6adf852efb404a783e77c0475771/node_modules/to-readable-stream/"),
      packageDependencies: new Map([
        ["to-readable-stream", "1.0.0"],
      ]),
    }],
  ])],
  ["is-scoped", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-scoped-1.0.0-449ca98299e713038256289ecb2b540dc437cb30/node_modules/is-scoped/"),
      packageDependencies: new Map([
        ["scoped-regex", "1.0.0"],
        ["is-scoped", "1.0.0"],
      ]),
    }],
  ])],
  ["scoped-regex", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-scoped-regex-1.0.0-a346bb1acd4207ae70bd7c0c7ca9e566b6baddb8/node_modules/scoped-regex/"),
      packageDependencies: new Map([
        ["scoped-regex", "1.0.0"],
      ]),
    }],
  ])],
  ["lodash.zip", new Map([
    ["4.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-zip-4.2.0-ec6662e4896408ed4ab6c542a3990b72cc080020/node_modules/lodash.zip/"),
      packageDependencies: new Map([
        ["lodash.zip", "4.2.0"],
      ]),
    }],
  ])],
  ["pretty-version-diff", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pretty-version-diff-1.0.0-d9a0a3acc1a1332366a8da2f85c8bbf62724652d/node_modules/pretty-version-diff/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["semver", "5.6.0"],
        ["pretty-version-diff", "1.0.0"],
      ]),
    }],
  ])],
  ["listr", new Map([
    ["0.14.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-listr-0.14.3-2fea909604e434be464c50bddba0d496928fa586/node_modules/listr/"),
      packageDependencies: new Map([
        ["@samverschueren/stream-to-observable", "0.3.0"],
        ["is-observable", "1.1.0"],
        ["is-promise", "2.1.0"],
        ["is-stream", "1.1.0"],
        ["listr-silent-renderer", "1.1.1"],
        ["listr-update-renderer", "0.5.0"],
        ["listr-verbose-renderer", "0.5.0"],
        ["p-map", "2.0.0"],
        ["rxjs", "6.4.0"],
        ["listr", "0.14.3"],
      ]),
    }],
  ])],
  ["is-observable", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-observable-1.1.0-b3e986c8f44de950867cab5403f5a3465005975e/node_modules/is-observable/"),
      packageDependencies: new Map([
        ["symbol-observable", "1.2.0"],
        ["is-observable", "1.1.0"],
      ]),
    }],
  ])],
  ["symbol-observable", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-symbol-observable-1.2.0-c22688aed4eab3cdc2dfeacbb561660560a00804/node_modules/symbol-observable/"),
      packageDependencies: new Map([
        ["symbol-observable", "1.2.0"],
      ]),
    }],
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-symbol-observable-1.0.1-8340fc4702c3122df5d22288f88283f513d3fdd4/node_modules/symbol-observable/"),
      packageDependencies: new Map([
        ["symbol-observable", "1.0.1"],
      ]),
    }],
  ])],
  ["listr-silent-renderer", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-listr-silent-renderer-1.1.1-924b5a3757153770bf1a8e3fbf74b8bbf3f9242e/node_modules/listr-silent-renderer/"),
      packageDependencies: new Map([
        ["listr-silent-renderer", "1.1.1"],
      ]),
    }],
  ])],
  ["listr-update-renderer", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-listr-update-renderer-0.5.0-4ea8368548a7b8aecb7e06d8c95cb45ae2ede6a2/node_modules/listr-update-renderer/"),
      packageDependencies: new Map([
        ["chalk", "1.1.3"],
        ["cli-truncate", "0.2.1"],
        ["elegant-spinner", "1.0.1"],
        ["figures", "1.7.0"],
        ["indent-string", "3.2.0"],
        ["log-symbols", "1.0.2"],
        ["log-update", "2.3.0"],
        ["strip-ansi", "3.0.1"],
        ["listr-update-renderer", "0.5.0"],
      ]),
    }],
  ])],
  ["has-ansi", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-ansi-2.0.0-34f5049ce1ecdf2b0649af3ef24e45ed35416d91/node_modules/has-ansi/"),
      packageDependencies: new Map([
        ["ansi-regex", "2.1.1"],
        ["has-ansi", "2.0.0"],
      ]),
    }],
  ])],
  ["cli-truncate", new Map([
    ["0.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cli-truncate-0.2.1-9f15cfbb0705005369216c626ac7d05ab90dd574/node_modules/cli-truncate/"),
      packageDependencies: new Map([
        ["slice-ansi", "0.0.4"],
        ["string-width", "1.0.2"],
        ["cli-truncate", "0.2.1"],
      ]),
    }],
  ])],
  ["slice-ansi", new Map([
    ["0.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-slice-ansi-0.0.4-edbf8903f66f7ce2f8eafd6ceed65e264c831b35/node_modules/slice-ansi/"),
      packageDependencies: new Map([
        ["slice-ansi", "0.0.4"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-slice-ansi-2.1.0-cacd7693461a637a5788d92a7dd4fba068e81636/node_modules/slice-ansi/"),
      packageDependencies: new Map([
        ["ansi-styles", "3.2.1"],
        ["astral-regex", "1.0.0"],
        ["is-fullwidth-code-point", "2.0.0"],
        ["slice-ansi", "2.1.0"],
      ]),
    }],
  ])],
  ["elegant-spinner", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-elegant-spinner-1.0.1-db043521c95d7e303fd8f345bedc3349cfb0729e/node_modules/elegant-spinner/"),
      packageDependencies: new Map([
        ["elegant-spinner", "1.0.1"],
      ]),
    }],
  ])],
  ["log-update", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-log-update-2.3.0-88328fd7d1ce7938b29283746f0b1bc126b24708/node_modules/log-update/"),
      packageDependencies: new Map([
        ["ansi-escapes", "3.2.0"],
        ["cli-cursor", "2.1.0"],
        ["wrap-ansi", "3.0.1"],
        ["log-update", "2.3.0"],
      ]),
    }],
  ])],
  ["listr-verbose-renderer", new Map([
    ["0.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-listr-verbose-renderer-0.5.0-f1132167535ea4c1261102b9f28dac7cba1e03db/node_modules/listr-verbose-renderer/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["cli-cursor", "2.1.0"],
        ["date-fns", "1.30.1"],
        ["figures", "2.0.0"],
        ["listr-verbose-renderer", "0.5.0"],
      ]),
    }],
  ])],
  ["date-fns", new Map([
    ["1.30.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-date-fns-1.30.1-2e71bf0b119153dbb4cc4e88d9ea5acfb50dc05c/node_modules/date-fns/"),
      packageDependencies: new Map([
        ["date-fns", "1.30.1"],
      ]),
    }],
  ])],
  ["listr-input", new Map([
    ["0.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-listr-input-0.1.3-0c313967b6d179ebe964a81e9363ce2a5a39d25c/node_modules/listr-input/"),
      packageDependencies: new Map([
        ["inquirer", "3.3.0"],
        ["rxjs", "5.5.12"],
        ["through", "2.3.8"],
        ["listr-input", "0.1.3"],
      ]),
    }],
  ])],
  ["rx-lite", new Map([
    ["4.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rx-lite-4.0.8-0b1e11af8bc44836f04a6407e92da42467b79444/node_modules/rx-lite/"),
      packageDependencies: new Map([
        ["rx-lite", "4.0.8"],
      ]),
    }],
  ])],
  ["rx-lite-aggregates", new Map([
    ["4.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rx-lite-aggregates-4.0.8-753b87a89a11c95467c4ac1626c4efc4e05c67be/node_modules/rx-lite-aggregates/"),
      packageDependencies: new Map([
        ["rx-lite", "4.0.8"],
        ["rx-lite-aggregates", "4.0.8"],
      ]),
    }],
  ])],
  ["split", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-split-1.0.1-605bd9be303aa59fb35f9229fbea0ddec9ea07d9/node_modules/split/"),
      packageDependencies: new Map([
        ["through", "2.3.8"],
        ["split", "1.0.1"],
      ]),
    }],
  ])],
  ["terminal-link", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-terminal-link-1.2.0-ed1ac495da75a8c3eadc8a5db985226e451edffd/node_modules/terminal-link/"),
      packageDependencies: new Map([
        ["ansi-escapes", "3.2.0"],
        ["supports-hyperlinks", "1.0.1"],
        ["terminal-link", "1.2.0"],
      ]),
    }],
  ])],
  ["supports-hyperlinks", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-supports-hyperlinks-1.0.1-71daedf36cc1060ac5100c351bb3da48c29c0ef7/node_modules/supports-hyperlinks/"),
      packageDependencies: new Map([
        ["has-flag", "2.0.0"],
        ["supports-color", "5.5.0"],
        ["supports-hyperlinks", "1.0.1"],
      ]),
    }],
  ])],
  ["@quase/unit", new Map([
    ["0.1.0-0", {
      packageLocation: path.resolve(__dirname, "./packages/unit/"),
      packageDependencies: new Map([
        ["@quase/cli", "0.4.0-0"],
        ["@quase/error", "0.1.0-0"],
        ["@quase/cacheable-fs", "0.1.0-0"],
        ["@quase/config", "0.2.0-0"],
        ["@quase/get-plugins", "0.1.0-0"],
        ["@quase/path-url", "0.1.0"],
        ["@quase/source-map", "0.2.0-0"],
        ["@babel/code-frame", "7.0.0"],
        ["circular-json", "0.5.9"],
        ["concordance", "3.0.0"],
        ["fs-extra", "7.0.1"],
        ["globby", "8.0.2"],
        ["import-fresh", "2.0.0"],
        ["is-ci", "1.2.1"],
        ["matcher", "1.1.1"],
        ["log-symbols", "2.2.0"],
        ["ora", "3.2.0"],
        ["random-js", "1.0.8"],
        ["turbocolor", "2.6.1"],
        ["write-file-atomic", "2.4.2"],
        ["zen-observable", "0.8.13"],
      ]),
    }],
  ])],
  ["circular-json", new Map([
    ["0.5.9", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-circular-json-0.5.9-932763ae88f4f7dead7a0d09c8a51a4743a53b1d/node_modules/circular-json/"),
      packageDependencies: new Map([
        ["circular-json", "0.5.9"],
      ]),
    }],
  ])],
  ["concordance", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-concordance-3.0.0-b2286af54405fc995fc7345b0b106d8dd073cb29/node_modules/concordance/"),
      packageDependencies: new Map([
        ["date-time", "2.1.0"],
        ["esutils", "2.0.2"],
        ["fast-diff", "1.2.0"],
        ["function-name-support", "0.2.0"],
        ["js-string-escape", "1.0.1"],
        ["lodash.clonedeep", "4.5.0"],
        ["lodash.flattendeep", "4.4.0"],
        ["lodash.merge", "4.6.1"],
        ["md5-hex", "2.0.0"],
        ["semver", "5.6.0"],
        ["well-known-symbols", "1.0.0"],
        ["concordance", "3.0.0"],
      ]),
    }],
  ])],
  ["date-time", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-date-time-2.1.0-0286d1b4c769633b3ca13e1e62558d2dbdc2eba2/node_modules/date-time/"),
      packageDependencies: new Map([
        ["time-zone", "1.0.0"],
        ["date-time", "2.1.0"],
      ]),
    }],
  ])],
  ["time-zone", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-time-zone-1.0.0-99c5bf55958966af6d06d83bdf3800dc82faec5d/node_modules/time-zone/"),
      packageDependencies: new Map([
        ["time-zone", "1.0.0"],
      ]),
    }],
  ])],
  ["fast-diff", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fast-diff-1.2.0-73ee11982d86caaf7959828d519cfe927fac5f03/node_modules/fast-diff/"),
      packageDependencies: new Map([
        ["fast-diff", "1.2.0"],
      ]),
    }],
  ])],
  ["function-name-support", new Map([
    ["0.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-function-name-support-0.2.0-55d3bfaa6eafd505a50f9bc81fdf57564a0bb071/node_modules/function-name-support/"),
      packageDependencies: new Map([
        ["function-name-support", "0.2.0"],
      ]),
    }],
  ])],
  ["js-string-escape", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-js-string-escape-1.0.1-e2625badbc0d67c7533e9edc1068c587ae4137ef/node_modules/js-string-escape/"),
      packageDependencies: new Map([
        ["js-string-escape", "1.0.1"],
      ]),
    }],
  ])],
  ["lodash.clonedeep", new Map([
    ["4.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-clonedeep-4.5.0-e23f3f9c4f8fbdde872529c1071857a086e5ccef/node_modules/lodash.clonedeep/"),
      packageDependencies: new Map([
        ["lodash.clonedeep", "4.5.0"],
      ]),
    }],
  ])],
  ["lodash.flattendeep", new Map([
    ["4.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-flattendeep-4.4.0-fb030917f86a3134e5bc9bec0d69e0013ddfedb2/node_modules/lodash.flattendeep/"),
      packageDependencies: new Map([
        ["lodash.flattendeep", "4.4.0"],
      ]),
    }],
  ])],
  ["lodash.merge", new Map([
    ["4.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-merge-4.6.1-adc25d9cb99b9391c59624f379fbba60d7111d54/node_modules/lodash.merge/"),
      packageDependencies: new Map([
        ["lodash.merge", "4.6.1"],
      ]),
    }],
  ])],
  ["md5-hex", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-md5-hex-2.0.0-d0588e9f1c74954492ecd24ac0ac6ce997d92e33/node_modules/md5-hex/"),
      packageDependencies: new Map([
        ["md5-o-matic", "0.1.1"],
        ["md5-hex", "2.0.0"],
      ]),
    }],
  ])],
  ["md5-o-matic", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-md5-o-matic-0.1.1-822bccd65e117c514fab176b25945d54100a03c3/node_modules/md5-o-matic/"),
      packageDependencies: new Map([
        ["md5-o-matic", "0.1.1"],
      ]),
    }],
  ])],
  ["well-known-symbols", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-well-known-symbols-1.0.0-73c78ae81a7726a8fa598e2880801c8b16225518/node_modules/well-known-symbols/"),
      packageDependencies: new Map([
        ["well-known-symbols", "1.0.0"],
      ]),
    }],
  ])],
  ["dir-glob", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-dir-glob-2.0.0-0b205d2b6aef98238ca286598a8204d29d0a0034/node_modules/dir-glob/"),
      packageDependencies: new Map([
        ["arrify", "1.0.1"],
        ["path-type", "3.0.0"],
        ["dir-glob", "2.0.0"],
      ]),
    }],
  ])],
  ["arrify", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-arrify-1.0.1-898508da2226f380df904728456849c1501a4b0d/node_modules/arrify/"),
      packageDependencies: new Map([
        ["arrify", "1.0.1"],
      ]),
    }],
  ])],
  ["fast-glob", new Map([
    ["2.2.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fast-glob-2.2.6-a5d5b697ec8deda468d85a74035290a025a95295/node_modules/fast-glob/"),
      packageDependencies: new Map([
        ["@mrmlnc/readdir-enhanced", "2.2.1"],
        ["@nodelib/fs.stat", "1.1.3"],
        ["glob-parent", "3.1.0"],
        ["is-glob", "4.0.0"],
        ["merge2", "1.2.3"],
        ["micromatch", "3.1.10"],
        ["fast-glob", "2.2.6"],
      ]),
    }],
  ])],
  ["@mrmlnc/readdir-enhanced", new Map([
    ["2.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@mrmlnc-readdir-enhanced-2.2.1-524af240d1a360527b730475ecfa1344aa540dde/node_modules/@mrmlnc/readdir-enhanced/"),
      packageDependencies: new Map([
        ["call-me-maybe", "1.0.1"],
        ["glob-to-regexp", "0.3.0"],
        ["@mrmlnc/readdir-enhanced", "2.2.1"],
      ]),
    }],
  ])],
  ["call-me-maybe", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-call-me-maybe-1.0.1-26d208ea89e37b5cbde60250a15f031c16a4d66b/node_modules/call-me-maybe/"),
      packageDependencies: new Map([
        ["call-me-maybe", "1.0.1"],
      ]),
    }],
  ])],
  ["glob-to-regexp", new Map([
    ["0.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-glob-to-regexp-0.3.0-8c5a1494d2066c570cc3bfe4496175acc4d502ab/node_modules/glob-to-regexp/"),
      packageDependencies: new Map([
        ["glob-to-regexp", "0.3.0"],
      ]),
    }],
  ])],
  ["@nodelib/fs.stat", new Map([
    ["1.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@nodelib-fs-stat-1.1.3-2b5a3ab3f918cca48a8c754c08168e3f03eba61b/node_modules/@nodelib/fs.stat/"),
      packageDependencies: new Map([
        ["@nodelib/fs.stat", "1.1.3"],
      ]),
    }],
  ])],
  ["merge2", new Map([
    ["1.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-merge2-1.2.3-7ee99dbd69bb6481689253f018488a1b902b0ed5/node_modules/merge2/"),
      packageDependencies: new Map([
        ["merge2", "1.2.3"],
      ]),
    }],
  ])],
  ["ignore", new Map([
    ["3.3.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ignore-3.3.10-0a97fb876986e8081c631160f8f9f389157f0043/node_modules/ignore/"),
      packageDependencies: new Map([
        ["ignore", "3.3.10"],
      ]),
    }],
    ["5.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ignore-5.0.5-c663c548d6ce186fb33616a8ccb5d46e56bdbbf9/node_modules/ignore/"),
      packageDependencies: new Map([
        ["ignore", "5.0.5"],
      ]),
    }],
    ["4.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ignore-4.0.6-750e3db5862087b4737ebac8207ffd1ef27b25fc/node_modules/ignore/"),
      packageDependencies: new Map([
        ["ignore", "4.0.6"],
      ]),
    }],
    ["5.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ignore-5.1.2-e28e584d43ad7e92f96995019cc43b9e1ac49558/node_modules/ignore/"),
      packageDependencies: new Map([
        ["ignore", "5.1.2"],
      ]),
    }],
  ])],
  ["import-fresh", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-import-fresh-2.0.0-d81355c15612d386c61f9ddd3922d4304822a546/node_modules/import-fresh/"),
      packageDependencies: new Map([
        ["caller-path", "2.0.0"],
        ["resolve-from", "3.0.0"],
        ["import-fresh", "2.0.0"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-import-fresh-3.0.0-a3d897f420cab0e671236897f75bc14b4885c390/node_modules/import-fresh/"),
      packageDependencies: new Map([
        ["parent-module", "1.0.0"],
        ["resolve-from", "4.0.0"],
        ["import-fresh", "3.0.0"],
      ]),
    }],
  ])],
  ["caller-path", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-caller-path-2.0.0-468f83044e369ab2010fac5f06ceee15bb2cb1f4/node_modules/caller-path/"),
      packageDependencies: new Map([
        ["caller-callsite", "2.0.0"],
        ["caller-path", "2.0.0"],
      ]),
    }],
  ])],
  ["caller-callsite", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-caller-callsite-2.0.0-847e0fce0a223750a9a027c54b33731ad3154134/node_modules/caller-callsite/"),
      packageDependencies: new Map([
        ["callsites", "2.0.0"],
        ["caller-callsite", "2.0.0"],
      ]),
    }],
  ])],
  ["callsites", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-callsites-2.0.0-06eb84f00eea413da86affefacbffb36093b3c50/node_modules/callsites/"),
      packageDependencies: new Map([
        ["callsites", "2.0.0"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-callsites-3.0.0-fb7eb569b72ad7a45812f93fd9430a3e410b3dd3/node_modules/callsites/"),
      packageDependencies: new Map([
        ["callsites", "3.0.0"],
      ]),
    }],
  ])],
  ["matcher", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-matcher-1.1.1-51d8301e138f840982b338b116bb0c09af62c1c2/node_modules/matcher/"),
      packageDependencies: new Map([
        ["escape-string-regexp", "1.0.5"],
        ["matcher", "1.1.1"],
      ]),
    }],
  ])],
  ["random-js", new Map([
    ["1.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-random-js-1.0.8-968fd689a6f25d6c0aac766283de2f688c9c190a/node_modules/random-js/"),
      packageDependencies: new Map([
        ["random-js", "1.0.8"],
      ]),
    }],
  ])],
  ["@quase/view", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "./packages/view/"),
      packageDependencies: new Map([
        ["@babel/plugin-syntax-jsx", "7.2.0"],
        ["he", "1.2.0"],
        ["@babel/core", "7.4.5"],
        ["jsdom", "15.1.1"],
      ]),
    }],
    ["pnp:f6c2e49fe52de5adc21cf52765acc9aa2dc1178b", {
      packageLocation: path.resolve(__dirname, "./.pnp/workspaces/pnp-f6c2e49fe52de5adc21cf52765acc9aa2dc1178b/@quase/view/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/plugin-syntax-jsx", "7.2.0"],
        ["he", "1.2.0"],
        ["jsdom", "15.1.1"],
        ["@quase/view", "pnp:f6c2e49fe52de5adc21cf52765acc9aa2dc1178b"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-jsx", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-syntax-jsx-7.2.0-0b85a3b4bc7cdf4cc4b8bf236335b907ca22e7c7/node_modules/@babel/plugin-syntax-jsx/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-jsx", "7.2.0"],
      ]),
    }],
  ])],
  ["he", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-he-1.2.0-84ae65fa7eafb165fddb61566ae14baf05664f0f/node_modules/he/"),
      packageDependencies: new Map([
        ["he", "1.2.0"],
      ]),
    }],
  ])],
  ["jsdom", new Map([
    ["15.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsdom-15.1.1-21ed01f81d95ef4327f3e564662aef5e65881252/node_modules/jsdom/"),
      packageDependencies: new Map([
        ["abab", "2.0.0"],
        ["acorn", "6.1.1"],
        ["acorn-globals", "4.3.2"],
        ["array-equal", "1.0.0"],
        ["cssom", "0.3.6"],
        ["cssstyle", "1.2.2"],
        ["data-urls", "1.1.0"],
        ["domexception", "1.0.1"],
        ["escodegen", "1.11.1"],
        ["html-encoding-sniffer", "1.0.2"],
        ["nwsapi", "2.1.4"],
        ["parse5", "5.1.0"],
        ["pn", "1.1.0"],
        ["request", "2.88.0"],
        ["request-promise-native", "1.0.7"],
        ["saxes", "3.1.10"],
        ["symbol-tree", "3.2.2"],
        ["tough-cookie", "3.0.1"],
        ["w3c-hr-time", "1.0.1"],
        ["w3c-xmlserializer", "1.1.2"],
        ["webidl-conversions", "4.0.2"],
        ["whatwg-encoding", "1.0.5"],
        ["whatwg-mimetype", "2.3.0"],
        ["whatwg-url", "7.0.0"],
        ["ws", "7.0.0"],
        ["xml-name-validator", "3.0.0"],
        ["jsdom", "15.1.1"],
      ]),
    }],
    ["11.12.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsdom-11.12.0-1a80d40ddd378a1de59656e9e6dc5a3ba8657bc8/node_modules/jsdom/"),
      packageDependencies: new Map([
        ["abab", "2.0.0"],
        ["acorn", "5.7.3"],
        ["acorn-globals", "4.3.0"],
        ["array-equal", "1.0.0"],
        ["cssom", "0.3.6"],
        ["cssstyle", "1.1.1"],
        ["data-urls", "1.1.0"],
        ["domexception", "1.0.1"],
        ["escodegen", "1.11.0"],
        ["html-encoding-sniffer", "1.0.2"],
        ["left-pad", "1.3.0"],
        ["nwsapi", "2.1.0"],
        ["parse5", "4.0.0"],
        ["pn", "1.1.0"],
        ["request", "2.88.0"],
        ["request-promise-native", "1.0.5"],
        ["sax", "1.2.4"],
        ["symbol-tree", "3.2.2"],
        ["tough-cookie", "2.5.0"],
        ["w3c-hr-time", "1.0.1"],
        ["webidl-conversions", "4.0.2"],
        ["whatwg-encoding", "1.0.5"],
        ["whatwg-mimetype", "2.3.0"],
        ["whatwg-url", "6.5.0"],
        ["ws", "5.2.2"],
        ["xml-name-validator", "3.0.0"],
        ["jsdom", "11.12.0"],
      ]),
    }],
  ])],
  ["abab", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-abab-2.0.0-aba0ab4c5eee2d4c79d3487d85450fb2376ebb0f/node_modules/abab/"),
      packageDependencies: new Map([
        ["abab", "2.0.0"],
      ]),
    }],
  ])],
  ["acorn-globals", new Map([
    ["4.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-globals-4.3.2-4e2c2313a597fd589720395f6354b41cd5ec8006/node_modules/acorn-globals/"),
      packageDependencies: new Map([
        ["acorn", "6.1.0"],
        ["acorn-walk", "6.1.1"],
        ["acorn-globals", "4.3.2"],
      ]),
    }],
    ["4.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-globals-4.3.0-e3b6f8da3c1552a95ae627571f7dd6923bb54103/node_modules/acorn-globals/"),
      packageDependencies: new Map([
        ["acorn", "6.1.0"],
        ["acorn-walk", "6.1.1"],
        ["acorn-globals", "4.3.0"],
      ]),
    }],
  ])],
  ["acorn-walk", new Map([
    ["6.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-walk-6.1.1-d363b66f5fac5f018ff9c3a1e7b6f8e310cc3913/node_modules/acorn-walk/"),
      packageDependencies: new Map([
        ["acorn-walk", "6.1.1"],
      ]),
    }],
  ])],
  ["array-equal", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-array-equal-1.0.0-8c2a5ef2472fd9ea742b04c77a75093ba2757c93/node_modules/array-equal/"),
      packageDependencies: new Map([
        ["array-equal", "1.0.0"],
      ]),
    }],
  ])],
  ["cssom", new Map([
    ["0.3.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cssom-0.3.6-f85206cee04efa841f3c5982a74ba96ab20d65ad/node_modules/cssom/"),
      packageDependencies: new Map([
        ["cssom", "0.3.6"],
      ]),
    }],
  ])],
  ["cssstyle", new Map([
    ["1.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cssstyle-1.2.2-427ea4d585b18624f6fdbf9de7a2a1a3ba713077/node_modules/cssstyle/"),
      packageDependencies: new Map([
        ["cssom", "0.3.6"],
        ["cssstyle", "1.2.2"],
      ]),
    }],
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-cssstyle-1.1.1-18b038a9c44d65f7a8e428a653b9f6fe42faf5fb/node_modules/cssstyle/"),
      packageDependencies: new Map([
        ["cssom", "0.3.6"],
        ["cssstyle", "1.1.1"],
      ]),
    }],
  ])],
  ["data-urls", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-data-urls-1.1.0-15ee0582baa5e22bb59c77140da8f9c76963bbfe/node_modules/data-urls/"),
      packageDependencies: new Map([
        ["abab", "2.0.0"],
        ["whatwg-mimetype", "2.3.0"],
        ["whatwg-url", "7.0.0"],
        ["data-urls", "1.1.0"],
      ]),
    }],
  ])],
  ["whatwg-mimetype", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-mimetype-2.3.0-3d4b1e0312d2079879f826aff18dbeeca5960fbf/node_modules/whatwg-mimetype/"),
      packageDependencies: new Map([
        ["whatwg-mimetype", "2.3.0"],
      ]),
    }],
  ])],
  ["domexception", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-domexception-1.0.1-937442644ca6a31261ef36e3ec677fe805582c90/node_modules/domexception/"),
      packageDependencies: new Map([
        ["webidl-conversions", "4.0.2"],
        ["domexception", "1.0.1"],
      ]),
    }],
  ])],
  ["escodegen", new Map([
    ["1.11.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-escodegen-1.11.1-c485ff8d6b4cdb89e27f4a856e91f118401ca510/node_modules/escodegen/"),
      packageDependencies: new Map([
        ["esprima", "3.1.3"],
        ["estraverse", "4.2.0"],
        ["esutils", "2.0.2"],
        ["optionator", "0.8.2"],
        ["source-map", "0.6.1"],
        ["escodegen", "1.11.1"],
      ]),
    }],
    ["1.11.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-escodegen-1.11.0-b27a9389481d5bfd5bec76f7bb1eb3f8f4556589/node_modules/escodegen/"),
      packageDependencies: new Map([
        ["esprima", "3.1.3"],
        ["estraverse", "4.2.0"],
        ["esutils", "2.0.2"],
        ["optionator", "0.8.2"],
        ["source-map", "0.6.1"],
        ["escodegen", "1.11.0"],
      ]),
    }],
  ])],
  ["esprima", new Map([
    ["3.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-esprima-3.1.3-fdca51cee6133895e3c88d535ce49dbff62a4633/node_modules/esprima/"),
      packageDependencies: new Map([
        ["esprima", "3.1.3"],
      ]),
    }],
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-esprima-4.0.1-13b04cdb3e6c5d19df91ab6987a8695619b0aa71/node_modules/esprima/"),
      packageDependencies: new Map([
        ["esprima", "4.0.1"],
      ]),
    }],
  ])],
  ["estraverse", new Map([
    ["4.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-estraverse-4.2.0-0dee3fed31fcd469618ce7342099fc1afa0bdb13/node_modules/estraverse/"),
      packageDependencies: new Map([
        ["estraverse", "4.2.0"],
      ]),
    }],
  ])],
  ["optionator", new Map([
    ["0.8.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-optionator-0.8.2-364c5e409d3f4d6301d6c0b4c05bba50180aeb64/node_modules/optionator/"),
      packageDependencies: new Map([
        ["deep-is", "0.1.3"],
        ["fast-levenshtein", "2.0.6"],
        ["levn", "0.3.0"],
        ["prelude-ls", "1.1.2"],
        ["type-check", "0.3.2"],
        ["wordwrap", "1.0.0"],
        ["optionator", "0.8.2"],
      ]),
    }],
  ])],
  ["deep-is", new Map([
    ["0.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-deep-is-0.1.3-b369d6fb5dbc13eecf524f91b070feedc357cf34/node_modules/deep-is/"),
      packageDependencies: new Map([
        ["deep-is", "0.1.3"],
      ]),
    }],
  ])],
  ["fast-levenshtein", new Map([
    ["2.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fast-levenshtein-2.0.6-3d8a5c66883a16a30ca8643e851f19baa7797917/node_modules/fast-levenshtein/"),
      packageDependencies: new Map([
        ["fast-levenshtein", "2.0.6"],
      ]),
    }],
  ])],
  ["levn", new Map([
    ["0.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-levn-0.3.0-3b09924edf9f083c0490fdd4c0bc4421e04764ee/node_modules/levn/"),
      packageDependencies: new Map([
        ["prelude-ls", "1.1.2"],
        ["type-check", "0.3.2"],
        ["levn", "0.3.0"],
      ]),
    }],
  ])],
  ["prelude-ls", new Map([
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-prelude-ls-1.1.2-21932a549f5e52ffd9a827f570e04be62a97da54/node_modules/prelude-ls/"),
      packageDependencies: new Map([
        ["prelude-ls", "1.1.2"],
      ]),
    }],
  ])],
  ["type-check", new Map([
    ["0.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-type-check-0.3.2-5884cab512cf1d355e3fb784f30804b2b520db72/node_modules/type-check/"),
      packageDependencies: new Map([
        ["prelude-ls", "1.1.2"],
        ["type-check", "0.3.2"],
      ]),
    }],
  ])],
  ["wordwrap", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-wordwrap-1.0.0-27584810891456a4171c8d0226441ade90cbcaeb/node_modules/wordwrap/"),
      packageDependencies: new Map([
        ["wordwrap", "1.0.0"],
      ]),
    }],
    ["0.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-wordwrap-0.0.3-a3d5da6cd5c0bc0008d37234bbaf1bed63059107/node_modules/wordwrap/"),
      packageDependencies: new Map([
        ["wordwrap", "0.0.3"],
      ]),
    }],
  ])],
  ["html-encoding-sniffer", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-html-encoding-sniffer-1.0.2-e70d84b94da53aa375e11fe3a351be6642ca46f8/node_modules/html-encoding-sniffer/"),
      packageDependencies: new Map([
        ["whatwg-encoding", "1.0.5"],
        ["html-encoding-sniffer", "1.0.2"],
      ]),
    }],
  ])],
  ["whatwg-encoding", new Map([
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-encoding-1.0.5-5abacf777c32166a51d085d6b4f3e7d27113ddb0/node_modules/whatwg-encoding/"),
      packageDependencies: new Map([
        ["iconv-lite", "0.4.24"],
        ["whatwg-encoding", "1.0.5"],
      ]),
    }],
  ])],
  ["nwsapi", new Map([
    ["2.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-nwsapi-2.1.4-e006a878db23636f8e8a67d33ca0e4edf61a842f/node_modules/nwsapi/"),
      packageDependencies: new Map([
        ["nwsapi", "2.1.4"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-nwsapi-2.1.0-781065940aed90d9bb01ca5d0ce0fcf81c32712f/node_modules/nwsapi/"),
      packageDependencies: new Map([
        ["nwsapi", "2.1.0"],
      ]),
    }],
  ])],
  ["pn", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pn-1.1.0-e2f4cef0e219f463c179ab37463e4e1ecdccbafb/node_modules/pn/"),
      packageDependencies: new Map([
        ["pn", "1.1.0"],
      ]),
    }],
  ])],
  ["request", new Map([
    ["2.88.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-request-2.88.0-9c2fca4f7d35b592efe57c7f0a55e81052124fef/node_modules/request/"),
      packageDependencies: new Map([
        ["aws-sign2", "0.7.0"],
        ["aws4", "1.8.0"],
        ["caseless", "0.12.0"],
        ["combined-stream", "1.0.7"],
        ["extend", "3.0.2"],
        ["forever-agent", "0.6.1"],
        ["form-data", "2.3.3"],
        ["har-validator", "5.1.3"],
        ["http-signature", "1.2.0"],
        ["is-typedarray", "1.0.0"],
        ["isstream", "0.1.2"],
        ["json-stringify-safe", "5.0.1"],
        ["mime-types", "2.1.21"],
        ["oauth-sign", "0.9.0"],
        ["performance-now", "2.1.0"],
        ["qs", "6.5.2"],
        ["safe-buffer", "5.1.2"],
        ["tough-cookie", "2.4.3"],
        ["tunnel-agent", "0.6.0"],
        ["uuid", "3.3.2"],
        ["request", "2.88.0"],
      ]),
    }],
  ])],
  ["aws-sign2", new Map([
    ["0.7.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-aws-sign2-0.7.0-b46e890934a9591f2d2f6f86d7e6a9f1b3fe76a8/node_modules/aws-sign2/"),
      packageDependencies: new Map([
        ["aws-sign2", "0.7.0"],
      ]),
    }],
  ])],
  ["aws4", new Map([
    ["1.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-aws4-1.8.0-f0e003d9ca9e7f59c7a508945d7b2ef9a04a542f/node_modules/aws4/"),
      packageDependencies: new Map([
        ["aws4", "1.8.0"],
      ]),
    }],
  ])],
  ["caseless", new Map([
    ["0.12.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-caseless-0.12.0-1b681c21ff84033c826543090689420d187151dc/node_modules/caseless/"),
      packageDependencies: new Map([
        ["caseless", "0.12.0"],
      ]),
    }],
  ])],
  ["combined-stream", new Map([
    ["1.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-combined-stream-1.0.7-2d1d24317afb8abe95d6d2c0b07b57813539d828/node_modules/combined-stream/"),
      packageDependencies: new Map([
        ["delayed-stream", "1.0.0"],
        ["combined-stream", "1.0.7"],
      ]),
    }],
  ])],
  ["delayed-stream", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-delayed-stream-1.0.0-df3ae199acadfb7d440aaae0b29e2272b24ec619/node_modules/delayed-stream/"),
      packageDependencies: new Map([
        ["delayed-stream", "1.0.0"],
      ]),
    }],
  ])],
  ["extend", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-extend-3.0.2-f8b1136b4071fbd8eb140aff858b1019ec2915fa/node_modules/extend/"),
      packageDependencies: new Map([
        ["extend", "3.0.2"],
      ]),
    }],
  ])],
  ["forever-agent", new Map([
    ["0.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-forever-agent-0.6.1-fbc71f0c41adeb37f96c577ad1ed42d8fdacca91/node_modules/forever-agent/"),
      packageDependencies: new Map([
        ["forever-agent", "0.6.1"],
      ]),
    }],
  ])],
  ["form-data", new Map([
    ["2.3.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-form-data-2.3.3-dcce52c05f644f298c6a7ab936bd724ceffbf3a6/node_modules/form-data/"),
      packageDependencies: new Map([
        ["asynckit", "0.4.0"],
        ["combined-stream", "1.0.7"],
        ["mime-types", "2.1.21"],
        ["form-data", "2.3.3"],
      ]),
    }],
  ])],
  ["asynckit", new Map([
    ["0.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-asynckit-0.4.0-c79ed97f7f34cb8f2ba1bc9790bcc366474b4b79/node_modules/asynckit/"),
      packageDependencies: new Map([
        ["asynckit", "0.4.0"],
      ]),
    }],
  ])],
  ["mime-types", new Map([
    ["2.1.21", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mime-types-2.1.21-28995aa1ecb770742fe6ae7e58f9181c744b3f96/node_modules/mime-types/"),
      packageDependencies: new Map([
        ["mime-db", "1.37.0"],
        ["mime-types", "2.1.21"],
      ]),
    }],
  ])],
  ["mime-db", new Map([
    ["1.37.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-mime-db-1.37.0-0b6a0ce6fdbe9576e25f1f2d2fde8830dc0ad0d8/node_modules/mime-db/"),
      packageDependencies: new Map([
        ["mime-db", "1.37.0"],
      ]),
    }],
  ])],
  ["har-validator", new Map([
    ["5.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-har-validator-5.1.3-1ef89ebd3e4996557675eed9893110dc350fa080/node_modules/har-validator/"),
      packageDependencies: new Map([
        ["ajv", "6.9.1"],
        ["har-schema", "2.0.0"],
        ["har-validator", "5.1.3"],
      ]),
    }],
  ])],
  ["ajv", new Map([
    ["6.9.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ajv-6.9.1-a4d3683d74abc5670e75f0b16520f70a20ea8dc1/node_modules/ajv/"),
      packageDependencies: new Map([
        ["fast-deep-equal", "2.0.1"],
        ["fast-json-stable-stringify", "2.0.0"],
        ["json-schema-traverse", "0.4.1"],
        ["uri-js", "4.2.2"],
        ["ajv", "6.9.1"],
      ]),
    }],
  ])],
  ["fast-deep-equal", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fast-deep-equal-2.0.1-7b05218ddf9667bf7f370bf7fdb2cb15fdd0aa49/node_modules/fast-deep-equal/"),
      packageDependencies: new Map([
        ["fast-deep-equal", "2.0.1"],
      ]),
    }],
  ])],
  ["fast-json-stable-stringify", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fast-json-stable-stringify-2.0.0-d5142c0caee6b1189f87d3a76111064f86c8bbf2/node_modules/fast-json-stable-stringify/"),
      packageDependencies: new Map([
        ["fast-json-stable-stringify", "2.0.0"],
      ]),
    }],
  ])],
  ["json-schema-traverse", new Map([
    ["0.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json-schema-traverse-0.4.1-69f6a87d9513ab8bb8fe63bdb0979c448e684660/node_modules/json-schema-traverse/"),
      packageDependencies: new Map([
        ["json-schema-traverse", "0.4.1"],
      ]),
    }],
  ])],
  ["uri-js", new Map([
    ["4.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-uri-js-4.2.2-94c540e1ff772956e2299507c010aea6c8838eb0/node_modules/uri-js/"),
      packageDependencies: new Map([
        ["punycode", "2.1.1"],
        ["uri-js", "4.2.2"],
      ]),
    }],
  ])],
  ["har-schema", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-har-schema-2.0.0-a94c2224ebcac04782a0d9035521f24735b7ec92/node_modules/har-schema/"),
      packageDependencies: new Map([
        ["har-schema", "2.0.0"],
      ]),
    }],
  ])],
  ["http-signature", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-http-signature-1.2.0-9aecd925114772f3d95b65a60abb8f7c18fbace1/node_modules/http-signature/"),
      packageDependencies: new Map([
        ["assert-plus", "1.0.0"],
        ["jsprim", "1.4.1"],
        ["sshpk", "1.16.1"],
        ["http-signature", "1.2.0"],
      ]),
    }],
  ])],
  ["assert-plus", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-assert-plus-1.0.0-f12e0f3c5d77b0b1cdd9146942e4e96c1e4dd525/node_modules/assert-plus/"),
      packageDependencies: new Map([
        ["assert-plus", "1.0.0"],
      ]),
    }],
  ])],
  ["jsprim", new Map([
    ["1.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsprim-1.4.1-313e66bc1e5cc06e438bc1b7499c2e5c56acb6a2/node_modules/jsprim/"),
      packageDependencies: new Map([
        ["assert-plus", "1.0.0"],
        ["extsprintf", "1.3.0"],
        ["json-schema", "0.2.3"],
        ["verror", "1.10.0"],
        ["jsprim", "1.4.1"],
      ]),
    }],
  ])],
  ["extsprintf", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-extsprintf-1.3.0-96918440e3041a7a414f8c52e3c574eb3c3e1e05/node_modules/extsprintf/"),
      packageDependencies: new Map([
        ["extsprintf", "1.3.0"],
      ]),
    }],
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-extsprintf-1.4.0-e2689f8f356fad62cca65a3a91c5df5f9551692f/node_modules/extsprintf/"),
      packageDependencies: new Map([
        ["extsprintf", "1.4.0"],
      ]),
    }],
  ])],
  ["json-schema", new Map([
    ["0.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json-schema-0.2.3-b480c892e59a2f05954ce727bd3f2a4e882f9e13/node_modules/json-schema/"),
      packageDependencies: new Map([
        ["json-schema", "0.2.3"],
      ]),
    }],
  ])],
  ["verror", new Map([
    ["1.10.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-verror-1.10.0-3a105ca17053af55d6e270c1f8288682e18da400/node_modules/verror/"),
      packageDependencies: new Map([
        ["assert-plus", "1.0.0"],
        ["core-util-is", "1.0.2"],
        ["extsprintf", "1.4.0"],
        ["verror", "1.10.0"],
      ]),
    }],
  ])],
  ["sshpk", new Map([
    ["1.16.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sshpk-1.16.1-fb661c0bef29b39db40769ee39fa70093d6f6877/node_modules/sshpk/"),
      packageDependencies: new Map([
        ["asn1", "0.2.4"],
        ["assert-plus", "1.0.0"],
        ["bcrypt-pbkdf", "1.0.2"],
        ["dashdash", "1.14.1"],
        ["ecc-jsbn", "0.1.2"],
        ["getpass", "0.1.7"],
        ["jsbn", "0.1.1"],
        ["safer-buffer", "2.1.2"],
        ["tweetnacl", "0.14.5"],
        ["sshpk", "1.16.1"],
      ]),
    }],
  ])],
  ["asn1", new Map([
    ["0.2.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-asn1-0.2.4-8d2475dfab553bb33e77b54e59e880bb8ce23136/node_modules/asn1/"),
      packageDependencies: new Map([
        ["safer-buffer", "2.1.2"],
        ["asn1", "0.2.4"],
      ]),
    }],
  ])],
  ["bcrypt-pbkdf", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-bcrypt-pbkdf-1.0.2-a4301d389b6a43f9b67ff3ca11a3f6637e360e9e/node_modules/bcrypt-pbkdf/"),
      packageDependencies: new Map([
        ["tweetnacl", "0.14.5"],
        ["bcrypt-pbkdf", "1.0.2"],
      ]),
    }],
  ])],
  ["tweetnacl", new Map([
    ["0.14.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tweetnacl-0.14.5-5ae68177f192d4456269d108afa93ff8743f4f64/node_modules/tweetnacl/"),
      packageDependencies: new Map([
        ["tweetnacl", "0.14.5"],
      ]),
    }],
  ])],
  ["dashdash", new Map([
    ["1.14.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-dashdash-1.14.1-853cfa0f7cbe2fed5de20326b8dd581035f6e2f0/node_modules/dashdash/"),
      packageDependencies: new Map([
        ["assert-plus", "1.0.0"],
        ["dashdash", "1.14.1"],
      ]),
    }],
  ])],
  ["ecc-jsbn", new Map([
    ["0.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-ecc-jsbn-0.1.2-3a83a904e54353287874c564b7549386849a98c9/node_modules/ecc-jsbn/"),
      packageDependencies: new Map([
        ["jsbn", "0.1.1"],
        ["safer-buffer", "2.1.2"],
        ["ecc-jsbn", "0.1.2"],
      ]),
    }],
  ])],
  ["jsbn", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jsbn-0.1.1-a5e654c2e5a2deb5f201d96cefbca80c0ef2f513/node_modules/jsbn/"),
      packageDependencies: new Map([
        ["jsbn", "0.1.1"],
      ]),
    }],
  ])],
  ["getpass", new Map([
    ["0.1.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-getpass-0.1.7-5eff8e3e684d569ae4cb2b1282604e8ba62149fa/node_modules/getpass/"),
      packageDependencies: new Map([
        ["assert-plus", "1.0.0"],
        ["getpass", "0.1.7"],
      ]),
    }],
  ])],
  ["is-typedarray", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-typedarray-1.0.0-e479c80858df0c1b11ddda6940f96011fcda4a9a/node_modules/is-typedarray/"),
      packageDependencies: new Map([
        ["is-typedarray", "1.0.0"],
      ]),
    }],
  ])],
  ["isstream", new Map([
    ["0.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-isstream-0.1.2-47e63f7af55afa6f92e1500e690eb8b8529c099a/node_modules/isstream/"),
      packageDependencies: new Map([
        ["isstream", "0.1.2"],
      ]),
    }],
  ])],
  ["json-stringify-safe", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json-stringify-safe-5.0.1-1296a2d58fd45f19a0f6ce01d65701e2c735b6eb/node_modules/json-stringify-safe/"),
      packageDependencies: new Map([
        ["json-stringify-safe", "5.0.1"],
      ]),
    }],
  ])],
  ["oauth-sign", new Map([
    ["0.9.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-oauth-sign-0.9.0-47a7b016baa68b5fa0ecf3dee08a85c679ac6455/node_modules/oauth-sign/"),
      packageDependencies: new Map([
        ["oauth-sign", "0.9.0"],
      ]),
    }],
  ])],
  ["performance-now", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-performance-now-2.1.0-6309f4e0e5fa913ec1c69307ae364b4b377c9e7b/node_modules/performance-now/"),
      packageDependencies: new Map([
        ["performance-now", "2.1.0"],
      ]),
    }],
  ])],
  ["qs", new Map([
    ["6.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-qs-6.5.2-cb3ae806e8740444584ef154ce8ee98d403f3e36/node_modules/qs/"),
      packageDependencies: new Map([
        ["qs", "6.5.2"],
      ]),
    }],
  ])],
  ["tough-cookie", new Map([
    ["2.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tough-cookie-2.4.3-53f36da3f47783b0925afa06ff9f3b165280f781/node_modules/tough-cookie/"),
      packageDependencies: new Map([
        ["psl", "1.1.31"],
        ["punycode", "1.4.1"],
        ["tough-cookie", "2.4.3"],
      ]),
    }],
    ["2.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tough-cookie-2.5.0-cd9fb2a0aa1d5a12b473bd9fb96fa3dcff65ade2/node_modules/tough-cookie/"),
      packageDependencies: new Map([
        ["psl", "1.1.31"],
        ["punycode", "2.1.1"],
        ["tough-cookie", "2.5.0"],
      ]),
    }],
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tough-cookie-3.0.1-9df4f57e739c26930a018184887f4adb7dca73b2/node_modules/tough-cookie/"),
      packageDependencies: new Map([
        ["ip-regex", "2.1.0"],
        ["psl", "1.1.31"],
        ["punycode", "2.1.1"],
        ["tough-cookie", "3.0.1"],
      ]),
    }],
  ])],
  ["psl", new Map([
    ["1.1.31", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-psl-1.1.31-e9aa86d0101b5b105cbe93ac6b784cd547276184/node_modules/psl/"),
      packageDependencies: new Map([
        ["psl", "1.1.31"],
      ]),
    }],
  ])],
  ["tunnel-agent", new Map([
    ["0.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tunnel-agent-0.6.0-27a5dea06b36b04a0a9966774b290868f0fc40fd/node_modules/tunnel-agent/"),
      packageDependencies: new Map([
        ["safe-buffer", "5.1.2"],
        ["tunnel-agent", "0.6.0"],
      ]),
    }],
  ])],
  ["uuid", new Map([
    ["3.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-uuid-3.3.2-1b4af4955eb3077c501c23872fc6513811587131/node_modules/uuid/"),
      packageDependencies: new Map([
        ["uuid", "3.3.2"],
      ]),
    }],
  ])],
  ["request-promise-native", new Map([
    ["1.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-native-1.0.7-a49868a624bdea5069f1251d0a836e0d89aa2c59/node_modules/request-promise-native/"),
      packageDependencies: new Map([
        ["request", "2.88.0"],
        ["request-promise-core", "1.1.2"],
        ["stealthy-require", "1.1.1"],
        ["tough-cookie", "2.5.0"],
        ["request-promise-native", "1.0.7"],
      ]),
    }],
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-native-1.0.5-5281770f68e0c9719e5163fd3fab482215f4fda5/node_modules/request-promise-native/"),
      packageDependencies: new Map([
        ["request", "2.88.0"],
        ["request-promise-core", "1.1.1"],
        ["stealthy-require", "1.1.1"],
        ["tough-cookie", "3.0.1"],
        ["request-promise-native", "1.0.5"],
      ]),
    }],
  ])],
  ["request-promise-core", new Map([
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-core-1.1.2-339f6aababcafdb31c799ff158700336301d3346/node_modules/request-promise-core/"),
      packageDependencies: new Map([
        ["request", "2.88.0"],
        ["lodash", "4.17.11"],
        ["request-promise-core", "1.1.2"],
      ]),
    }],
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-core-1.1.1-3eee00b2c5aa83239cfb04c5700da36f81cd08b6/node_modules/request-promise-core/"),
      packageDependencies: new Map([
        ["request", "2.88.0"],
        ["lodash", "4.17.11"],
        ["request-promise-core", "1.1.1"],
      ]),
    }],
  ])],
  ["stealthy-require", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-stealthy-require-1.1.1-35b09875b4ff49f26a777e509b3090a3226bf24b/node_modules/stealthy-require/"),
      packageDependencies: new Map([
        ["stealthy-require", "1.1.1"],
      ]),
    }],
  ])],
  ["saxes", new Map([
    ["3.1.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-saxes-3.1.10-6028a4d6d65f0b5f5b5d250c0500be6a7950fe13/node_modules/saxes/"),
      packageDependencies: new Map([
        ["xmlchars", "1.3.1"],
        ["saxes", "3.1.10"],
      ]),
    }],
  ])],
  ["xmlchars", new Map([
    ["1.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-xmlchars-1.3.1-1dda035f833dbb4f86a0c28eaa6ca769214793cf/node_modules/xmlchars/"),
      packageDependencies: new Map([
        ["xmlchars", "1.3.1"],
      ]),
    }],
  ])],
  ["symbol-tree", new Map([
    ["3.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-symbol-tree-3.2.2-ae27db38f660a7ae2e1c3b7d1bc290819b8519e6/node_modules/symbol-tree/"),
      packageDependencies: new Map([
        ["symbol-tree", "3.2.2"],
      ]),
    }],
  ])],
  ["w3c-hr-time", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-w3c-hr-time-1.0.1-82ac2bff63d950ea9e3189a58a65625fedf19045/node_modules/w3c-hr-time/"),
      packageDependencies: new Map([
        ["browser-process-hrtime", "0.1.3"],
        ["w3c-hr-time", "1.0.1"],
      ]),
    }],
  ])],
  ["browser-process-hrtime", new Map([
    ["0.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-browser-process-hrtime-0.1.3-616f00faef1df7ec1b5bf9cfe2bdc3170f26c7b4/node_modules/browser-process-hrtime/"),
      packageDependencies: new Map([
        ["browser-process-hrtime", "0.1.3"],
      ]),
    }],
  ])],
  ["w3c-xmlserializer", new Map([
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-w3c-xmlserializer-1.1.2-30485ca7d70a6fd052420a3d12fd90e6339ce794/node_modules/w3c-xmlserializer/"),
      packageDependencies: new Map([
        ["domexception", "1.0.1"],
        ["webidl-conversions", "4.0.2"],
        ["xml-name-validator", "3.0.0"],
        ["w3c-xmlserializer", "1.1.2"],
      ]),
    }],
  ])],
  ["xml-name-validator", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-xml-name-validator-3.0.0-6ae73e06de4d8c6e47f9fb181f78d648ad457c6a/node_modules/xml-name-validator/"),
      packageDependencies: new Map([
        ["xml-name-validator", "3.0.0"],
      ]),
    }],
  ])],
  ["@babel/cli", new Map([
    ["pnp:9b014519ce8c6df6754c3598b7e86ae703bf63ce", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-9b014519ce8c6df6754c3598b7e86ae703bf63ce/node_modules/@babel/cli/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["commander", "2.19.0"],
        ["convert-source-map", "1.6.0"],
        ["fs-readdir-recursive", "1.1.0"],
        ["glob", "7.1.3"],
        ["lodash", "4.17.11"],
        ["mkdirp", "0.5.1"],
        ["output-file-sync", "2.0.1"],
        ["slash", "2.0.0"],
        ["source-map", "0.5.7"],
        ["chokidar", "2.1.6"],
        ["@babel/cli", "pnp:9b014519ce8c6df6754c3598b7e86ae703bf63ce"],
      ]),
    }],
  ])],
  ["commander", new Map([
    ["2.19.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-commander-2.19.0-f6198aa84e5b83c46054b94ddedbfed5ee9ff12a/node_modules/commander/"),
      packageDependencies: new Map([
        ["commander", "2.19.0"],
      ]),
    }],
    ["2.17.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-commander-2.17.1-bd77ab7de6de94205ceacc72f1716d29f20a77bf/node_modules/commander/"),
      packageDependencies: new Map([
        ["commander", "2.17.1"],
      ]),
    }],
  ])],
  ["fs-readdir-recursive", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fs-readdir-recursive-1.1.0-e32fc030a2ccee44a6b5371308da54be0b397d27/node_modules/fs-readdir-recursive/"),
      packageDependencies: new Map([
        ["fs-readdir-recursive", "1.1.0"],
      ]),
    }],
  ])],
  ["output-file-sync", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-output-file-sync-2.0.1-f53118282f5f553c2799541792b723a4c71430c0/node_modules/output-file-sync/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.1.15"],
        ["is-plain-obj", "1.1.0"],
        ["mkdirp", "0.5.1"],
        ["output-file-sync", "2.0.1"],
      ]),
    }],
  ])],
  ["@babel/node", new Map([
    ["pnp:12d0714a6c937f322d9609379be0e61c73ed8931", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-12d0714a6c937f322d9609379be0e61c73ed8931/node_modules/@babel/node/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/polyfill", "7.2.5"],
        ["@babel/register", "7.0.0"],
        ["commander", "2.19.0"],
        ["lodash", "4.17.11"],
        ["node-environment-flags", "1.0.5"],
        ["v8flags", "3.1.2"],
        ["@babel/node", "pnp:12d0714a6c937f322d9609379be0e61c73ed8931"],
      ]),
    }],
  ])],
  ["@babel/polyfill", new Map([
    ["7.2.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-polyfill-7.2.5-6c54b964f71ad27edddc567d065e57e87ed7fa7d/node_modules/@babel/polyfill/"),
      packageDependencies: new Map([
        ["core-js", "2.6.4"],
        ["regenerator-runtime", "0.12.1"],
        ["@babel/polyfill", "7.2.5"],
      ]),
    }],
  ])],
  ["@babel/register", new Map([
    ["7.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-register-7.0.0-fa634bae1bfa429f60615b754fc1f1d745edd827/node_modules/@babel/register/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["core-js", "2.6.4"],
        ["find-cache-dir", "1.0.0"],
        ["home-or-tmp", "3.0.0"],
        ["lodash", "4.17.11"],
        ["mkdirp", "0.5.1"],
        ["pirates", "4.0.0"],
        ["source-map-support", "0.5.10"],
        ["@babel/register", "7.0.0"],
      ]),
    }],
    ["pnp:212ab889e0e907ad9de719031b4506871141fc58", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-212ab889e0e907ad9de719031b4506871141fc58/node_modules/@babel/register/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["core-js", "3.0.0"],
        ["find-cache-dir", "2.1.0"],
        ["lodash", "4.17.11"],
        ["mkdirp", "0.5.1"],
        ["pirates", "4.0.0"],
        ["source-map-support", "0.5.10"],
        ["@babel/register", "pnp:212ab889e0e907ad9de719031b4506871141fc58"],
      ]),
    }],
  ])],
  ["find-cache-dir", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-find-cache-dir-1.0.0-9288e3e9e3cc3748717d39eade17cf71fc30ee6f/node_modules/find-cache-dir/"),
      packageDependencies: new Map([
        ["commondir", "1.0.1"],
        ["make-dir", "1.3.0"],
        ["pkg-dir", "2.0.0"],
        ["find-cache-dir", "1.0.0"],
      ]),
    }],
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-find-cache-dir-2.1.0-8d0f94cd13fe43c6c7c261a0d86115ca918c05f7/node_modules/find-cache-dir/"),
      packageDependencies: new Map([
        ["commondir", "1.0.1"],
        ["make-dir", "2.1.0"],
        ["pkg-dir", "3.0.0"],
        ["find-cache-dir", "2.1.0"],
      ]),
    }],
  ])],
  ["commondir", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-commondir-1.0.1-ddd800da0c66127393cca5950ea968a3aaf1253b/node_modules/commondir/"),
      packageDependencies: new Map([
        ["commondir", "1.0.1"],
      ]),
    }],
  ])],
  ["home-or-tmp", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-home-or-tmp-3.0.0-57a8fe24cf33cdd524860a15821ddc25c86671fb/node_modules/home-or-tmp/"),
      packageDependencies: new Map([
        ["home-or-tmp", "3.0.0"],
      ]),
    }],
  ])],
  ["pirates", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pirates-4.0.0-850b18781b4ac6ec58a43c9ed9ec5fe6796addbd/node_modules/pirates/"),
      packageDependencies: new Map([
        ["node-modules-regexp", "1.0.0"],
        ["pirates", "4.0.0"],
      ]),
    }],
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pirates-4.0.1-643a92caf894566f91b2b986d2c66950a8e2fb87/node_modules/pirates/"),
      packageDependencies: new Map([
        ["node-modules-regexp", "1.0.0"],
        ["pirates", "4.0.1"],
      ]),
    }],
  ])],
  ["node-modules-regexp", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-modules-regexp-1.0.0-8d9dbe28964a4ac5712e9131642107c71e90ec40/node_modules/node-modules-regexp/"),
      packageDependencies: new Map([
        ["node-modules-regexp", "1.0.0"],
      ]),
    }],
  ])],
  ["source-map-support", new Map([
    ["0.5.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-source-map-support-0.5.10-2214080bc9d51832511ee2bab96e3c2f9353120c/node_modules/source-map-support/"),
      packageDependencies: new Map([
        ["buffer-from", "1.1.1"],
        ["source-map", "0.6.1"],
        ["source-map-support", "0.5.10"],
      ]),
    }],
  ])],
  ["node-environment-flags", new Map([
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-environment-flags-1.0.5-fa930275f5bf5dae188d6192b24b4c8bbac3d76a/node_modules/node-environment-flags/"),
      packageDependencies: new Map([
        ["object.getownpropertydescriptors", "2.0.3"],
        ["semver", "5.7.0"],
        ["node-environment-flags", "1.0.5"],
      ]),
    }],
  ])],
  ["object.getownpropertydescriptors", new Map([
    ["2.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-object-getownpropertydescriptors-2.0.3-8758c846f5b407adab0f236e0986f14b051caa16/node_modules/object.getownpropertydescriptors/"),
      packageDependencies: new Map([
        ["define-properties", "1.1.3"],
        ["es-abstract", "1.13.0"],
        ["object.getownpropertydescriptors", "2.0.3"],
      ]),
    }],
  ])],
  ["define-properties", new Map([
    ["1.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-define-properties-1.1.3-cf88da6cbee26fe6db7094f61d870cbd84cee9f1/node_modules/define-properties/"),
      packageDependencies: new Map([
        ["object-keys", "1.0.12"],
        ["define-properties", "1.1.3"],
      ]),
    }],
  ])],
  ["object-keys", new Map([
    ["1.0.12", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-object-keys-1.0.12-09c53855377575310cca62f55bb334abff7b3ed2/node_modules/object-keys/"),
      packageDependencies: new Map([
        ["object-keys", "1.0.12"],
      ]),
    }],
  ])],
  ["es-abstract", new Map([
    ["1.13.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-es-abstract-1.13.0-ac86145fdd5099d8dd49558ccba2eaf9b88e24e9/node_modules/es-abstract/"),
      packageDependencies: new Map([
        ["es-to-primitive", "1.2.0"],
        ["function-bind", "1.1.1"],
        ["has", "1.0.3"],
        ["is-callable", "1.1.4"],
        ["is-regex", "1.0.4"],
        ["object-keys", "1.0.12"],
        ["es-abstract", "1.13.0"],
      ]),
    }],
  ])],
  ["es-to-primitive", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-es-to-primitive-1.2.0-edf72478033456e8dda8ef09e00ad9650707f377/node_modules/es-to-primitive/"),
      packageDependencies: new Map([
        ["is-callable", "1.1.4"],
        ["is-date-object", "1.0.1"],
        ["is-symbol", "1.0.2"],
        ["es-to-primitive", "1.2.0"],
      ]),
    }],
  ])],
  ["is-callable", new Map([
    ["1.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-callable-1.1.4-1e1adf219e1eeb684d691f9d6a05ff0d30a24d75/node_modules/is-callable/"),
      packageDependencies: new Map([
        ["is-callable", "1.1.4"],
      ]),
    }],
  ])],
  ["is-date-object", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-date-object-1.0.1-9aa20eb6aeebbff77fbd33e74ca01b33581d3a16/node_modules/is-date-object/"),
      packageDependencies: new Map([
        ["is-date-object", "1.0.1"],
      ]),
    }],
  ])],
  ["is-symbol", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-symbol-1.0.2-a055f6ae57192caee329e7a860118b497a950f38/node_modules/is-symbol/"),
      packageDependencies: new Map([
        ["has-symbols", "1.0.0"],
        ["is-symbol", "1.0.2"],
      ]),
    }],
  ])],
  ["has-symbols", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-symbols-1.0.0-ba1a8f1af2a0fc39650f5c850367704122063b44/node_modules/has-symbols/"),
      packageDependencies: new Map([
        ["has-symbols", "1.0.0"],
      ]),
    }],
  ])],
  ["function-bind", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-function-bind-1.1.1-a56899d3ea3c9bab874bb9773b7c5ede92f4895d/node_modules/function-bind/"),
      packageDependencies: new Map([
        ["function-bind", "1.1.1"],
      ]),
    }],
  ])],
  ["has", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-has-1.0.3-722d7cbfc1f6aa8241f16dd814e011e1f41e8796/node_modules/has/"),
      packageDependencies: new Map([
        ["function-bind", "1.1.1"],
        ["has", "1.0.3"],
      ]),
    }],
  ])],
  ["is-regex", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-regex-1.0.4-5517489b547091b0930e095654ced25ee97e9491/node_modules/is-regex/"),
      packageDependencies: new Map([
        ["has", "1.0.3"],
        ["is-regex", "1.0.4"],
      ]),
    }],
  ])],
  ["v8flags", new Map([
    ["3.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-v8flags-3.1.2-fc5cd0c227428181e6c29b2992e4f8f1da5e0c9f/node_modules/v8flags/"),
      packageDependencies: new Map([
        ["homedir-polyfill", "1.0.1"],
        ["v8flags", "3.1.2"],
      ]),
    }],
  ])],
  ["homedir-polyfill", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-homedir-polyfill-1.0.1-4c2bbc8a758998feebf5ed68580f76d46768b4bc/node_modules/homedir-polyfill/"),
      packageDependencies: new Map([
        ["parse-passwd", "1.0.0"],
        ["homedir-polyfill", "1.0.1"],
      ]),
    }],
  ])],
  ["parse-passwd", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parse-passwd-1.0.0-6d5b934a456993b23d37f40a382d6f1666a8e5c6/node_modules/parse-passwd/"),
      packageDependencies: new Map([
        ["parse-passwd", "1.0.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-member-expression-literals", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-member-expression-literals-7.2.0-fa10aa5c58a2cb6afcf2c9ffa8cb4d8b3d489a2d/node_modules/@babel/plugin-transform-member-expression-literals/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-member-expression-literals", "7.2.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-property-literals", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-property-literals-7.2.0-03e33f653f5b25c4eb572c98b9485055b389e905/node_modules/@babel/plugin-transform-property-literals/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-property-literals", "7.2.0"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-reserved-words", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-reserved-words-7.2.0-4792af87c998a49367597d07fedf02636d2e1634/node_modules/@babel/plugin-transform-reserved-words/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-reserved-words", "7.2.0"],
      ]),
    }],
  ])],
  ["@babel/preset-flow", new Map([
    ["pnp:d4afbbd6215b1993d05095efb590984f9b6a3a02", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-d4afbbd6215b1993d05095efb590984f9b6a3a02/node_modules/@babel/preset-flow/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-transform-flow-strip-types", "7.2.3"],
        ["@babel/preset-flow", "pnp:d4afbbd6215b1993d05095efb590984f9b6a3a02"],
      ]),
    }],
  ])],
  ["@babel/plugin-transform-flow-strip-types", new Map([
    ["7.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-flow-strip-types-7.2.3-e3ac2a594948454e7431c7db33e1d02d51b5cd69/node_modules/@babel/plugin-transform-flow-strip-types/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-flow", "7.2.0"],
        ["@babel/plugin-transform-flow-strip-types", "7.2.3"],
      ]),
    }],
  ])],
  ["@babel/plugin-syntax-flow", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-syntax-flow-7.2.0-a765f061f803bc48f240c26f8747faf97c26bf7c/node_modules/@babel/plugin-syntax-flow/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/helper-plugin-utils", "7.0.0"],
        ["@babel/plugin-syntax-flow", "7.2.0"],
      ]),
    }],
  ])],
  ["@quase/eslint-config-base", new Map([
    ["pnp:0c89c1675497b0fec2ce71c0ceba145f497433f4", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-0c89c1675497b0fec2ce71c0ceba145f497433f4/node_modules/@quase/eslint-config-base/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["babel-eslint", "10.0.1"],
        ["eslint-plugin-import", "2.16.0"],
        ["eslint-plugin-node", "8.0.1"],
        ["@quase/eslint-config-base", "pnp:0c89c1675497b0fec2ce71c0ceba145f497433f4"],
      ]),
    }],
  ])],
  ["babel-eslint", new Map([
    ["10.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-eslint-10.0.1-919681dc099614cd7d31d45c8908695092a1faed/node_modules/babel-eslint/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["@babel/code-frame", "7.0.0"],
        ["@babel/parser", "7.3.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["eslint-scope", "3.7.1"],
        ["eslint-visitor-keys", "1.0.0"],
        ["babel-eslint", "10.0.1"],
      ]),
    }],
    ["pnp:40297bf345c2c41dbcbee7fd39cbf070f3594b60", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-40297bf345c2c41dbcbee7fd39cbf070f3594b60/node_modules/babel-eslint/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["@babel/code-frame", "7.0.0"],
        ["@babel/parser", "7.3.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["eslint-scope", "3.7.1"],
        ["eslint-visitor-keys", "1.0.0"],
        ["babel-eslint", "pnp:40297bf345c2c41dbcbee7fd39cbf070f3594b60"],
      ]),
    }],
  ])],
  ["eslint-scope", new Map([
    ["3.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-scope-3.7.1-3d63c3edfda02e06e01a452ad88caacc7cdcb6e8/node_modules/eslint-scope/"),
      packageDependencies: new Map([
        ["esrecurse", "4.2.1"],
        ["estraverse", "4.2.0"],
        ["eslint-scope", "3.7.1"],
      ]),
    }],
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-scope-4.0.0-50bf3071e9338bcdc43331794a0cb533f0136172/node_modules/eslint-scope/"),
      packageDependencies: new Map([
        ["esrecurse", "4.2.1"],
        ["estraverse", "4.2.0"],
        ["eslint-scope", "4.0.0"],
      ]),
    }],
    ["4.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-scope-4.0.3-ca03833310f6889a3264781aa82e63eb9cfe7848/node_modules/eslint-scope/"),
      packageDependencies: new Map([
        ["esrecurse", "4.2.1"],
        ["estraverse", "4.2.0"],
        ["eslint-scope", "4.0.3"],
      ]),
    }],
  ])],
  ["esrecurse", new Map([
    ["4.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-esrecurse-4.2.1-007a3b9fdbc2b3bb87e4879ea19c92fdbd3942cf/node_modules/esrecurse/"),
      packageDependencies: new Map([
        ["estraverse", "4.2.0"],
        ["esrecurse", "4.2.1"],
      ]),
    }],
  ])],
  ["eslint-visitor-keys", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-visitor-keys-1.0.0-3f3180fb2e291017716acb4c9d6d5b5c34a6a81d/node_modules/eslint-visitor-keys/"),
      packageDependencies: new Map([
        ["eslint-visitor-keys", "1.0.0"],
      ]),
    }],
  ])],
  ["eslint-plugin-import", new Map([
    ["2.16.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-plugin-import-2.16.0-97ac3e75d0791c4fac0e15ef388510217be7f66f/node_modules/eslint-plugin-import/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["contains-path", "0.1.0"],
        ["debug", "2.6.9"],
        ["doctrine", "1.5.0"],
        ["eslint-import-resolver-node", "0.3.2"],
        ["eslint-module-utils", "2.3.0"],
        ["has", "1.0.3"],
        ["lodash", "4.17.11"],
        ["minimatch", "3.0.4"],
        ["read-pkg-up", "2.0.0"],
        ["resolve", "1.10.0"],
        ["eslint-plugin-import", "2.16.0"],
      ]),
    }],
    ["pnp:e13d44595399586b5a77811b3bc990943932eacf", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-e13d44595399586b5a77811b3bc990943932eacf/node_modules/eslint-plugin-import/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["array-includes", "3.0.3"],
        ["contains-path", "0.1.0"],
        ["debug", "2.6.9"],
        ["doctrine", "1.5.0"],
        ["eslint-import-resolver-node", "0.3.2"],
        ["eslint-module-utils", "2.4.0"],
        ["has", "1.0.3"],
        ["lodash", "4.17.11"],
        ["minimatch", "3.0.4"],
        ["read-pkg-up", "2.0.0"],
        ["resolve", "1.11.0"],
        ["eslint-plugin-import", "pnp:e13d44595399586b5a77811b3bc990943932eacf"],
      ]),
    }],
  ])],
  ["contains-path", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-contains-path-0.1.0-fe8cf184ff6670b6baef01a9d4861a5cbec4120a/node_modules/contains-path/"),
      packageDependencies: new Map([
        ["contains-path", "0.1.0"],
      ]),
    }],
  ])],
  ["doctrine", new Map([
    ["1.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-doctrine-1.5.0-379dce730f6166f76cefa4e6707a159b02c5a6fa/node_modules/doctrine/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
        ["isarray", "1.0.0"],
        ["doctrine", "1.5.0"],
      ]),
    }],
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-doctrine-3.0.0-addebead72a6574db783639dc87a121773973961/node_modules/doctrine/"),
      packageDependencies: new Map([
        ["esutils", "2.0.2"],
        ["doctrine", "3.0.0"],
      ]),
    }],
  ])],
  ["eslint-import-resolver-node", new Map([
    ["0.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-import-resolver-node-0.3.2-58f15fb839b8d0576ca980413476aab2472db66a/node_modules/eslint-import-resolver-node/"),
      packageDependencies: new Map([
        ["debug", "2.6.9"],
        ["resolve", "1.10.0"],
        ["eslint-import-resolver-node", "0.3.2"],
      ]),
    }],
  ])],
  ["eslint-module-utils", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-module-utils-2.3.0-546178dab5e046c8b562bbb50705e2456d7bda49/node_modules/eslint-module-utils/"),
      packageDependencies: new Map([
        ["debug", "2.6.9"],
        ["pkg-dir", "2.0.0"],
        ["eslint-module-utils", "2.3.0"],
      ]),
    }],
    ["2.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-module-utils-2.4.0-8b93499e9b00eab80ccb6614e69f03678e84e09a/node_modules/eslint-module-utils/"),
      packageDependencies: new Map([
        ["debug", "2.6.9"],
        ["pkg-dir", "2.0.0"],
        ["eslint-module-utils", "2.4.0"],
      ]),
    }],
  ])],
  ["eslint-plugin-node", new Map([
    ["8.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-plugin-node-8.0.1-55ae3560022863d141fa7a11799532340a685964/node_modules/eslint-plugin-node/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["eslint-plugin-es", "pnp:00961244b9eda7fb07e72e2d480a765c28949f94"],
        ["eslint-utils", "1.3.1"],
        ["ignore", "5.0.5"],
        ["minimatch", "3.0.4"],
        ["resolve", "1.10.0"],
        ["semver", "5.6.0"],
        ["eslint-plugin-node", "8.0.1"],
      ]),
    }],
    ["pnp:0002cdcd4b4ece9dc23f69137327ea828b6e2a0b", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-0002cdcd4b4ece9dc23f69137327ea828b6e2a0b/node_modules/eslint-plugin-node/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["eslint-plugin-es", "pnp:5b31eb2e94d010ce3fe4ddb0e395dba114c98734"],
        ["eslint-utils", "1.3.1"],
        ["ignore", "5.1.2"],
        ["minimatch", "3.0.4"],
        ["resolve", "1.11.0"],
        ["semver", "6.1.1"],
        ["eslint-plugin-node", "pnp:0002cdcd4b4ece9dc23f69137327ea828b6e2a0b"],
      ]),
    }],
  ])],
  ["eslint-plugin-es", new Map([
    ["pnp:00961244b9eda7fb07e72e2d480a765c28949f94", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-00961244b9eda7fb07e72e2d480a765c28949f94/node_modules/eslint-plugin-es/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["eslint-utils", "1.3.1"],
        ["regexpp", "2.0.1"],
        ["eslint-plugin-es", "pnp:00961244b9eda7fb07e72e2d480a765c28949f94"],
      ]),
    }],
    ["pnp:5b31eb2e94d010ce3fe4ddb0e395dba114c98734", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-5b31eb2e94d010ce3fe4ddb0e395dba114c98734/node_modules/eslint-plugin-es/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["eslint-utils", "1.3.1"],
        ["regexpp", "2.0.1"],
        ["eslint-plugin-es", "pnp:5b31eb2e94d010ce3fe4ddb0e395dba114c98734"],
      ]),
    }],
  ])],
  ["eslint-utils", new Map([
    ["1.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-utils-1.3.1-9a851ba89ee7c460346f97cf8939c7298827e512/node_modules/eslint-utils/"),
      packageDependencies: new Map([
        ["eslint-utils", "1.3.1"],
      ]),
    }],
  ])],
  ["regexpp", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-regexpp-2.0.1-8d19d31cf632482b589049f8281f93dbcba4d07f/node_modules/regexpp/"),
      packageDependencies: new Map([
        ["regexpp", "2.0.1"],
      ]),
    }],
  ])],
  ["@typescript-eslint/eslint-plugin", new Map([
    ["pnp:28e2761177fbb5133e7217e1b5aeeace3a6a060d", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-28e2761177fbb5133e7217e1b5aeeace3a6a060d/node_modules/@typescript-eslint/eslint-plugin/"),
      packageDependencies: new Map([
        ["@typescript-eslint/parser", "pnp:18d8d3ba6429cc0d314ad81dd2ee9403bb325efd"],
        ["eslint", "5.16.0"],
        ["@typescript-eslint/experimental-utils", "pnp:8bd157d24be50560e6bb5dca18f73efd37fd1706"],
        ["eslint-utils", "1.3.1"],
        ["functional-red-black-tree", "1.0.1"],
        ["regexpp", "2.0.1"],
        ["tsutils", "3.8.0"],
        ["@typescript-eslint/eslint-plugin", "pnp:28e2761177fbb5133e7217e1b5aeeace3a6a060d"],
      ]),
    }],
  ])],
  ["@typescript-eslint/experimental-utils", new Map([
    ["pnp:8bd157d24be50560e6bb5dca18f73efd37fd1706", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-8bd157d24be50560e6bb5dca18f73efd37fd1706/node_modules/@typescript-eslint/experimental-utils/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["@typescript-eslint/typescript-estree", "1.10.2"],
        ["eslint-scope", "4.0.0"],
        ["@typescript-eslint/experimental-utils", "pnp:8bd157d24be50560e6bb5dca18f73efd37fd1706"],
      ]),
    }],
    ["pnp:0524386e850511b7227b8d994d2da21014039e65", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-0524386e850511b7227b8d994d2da21014039e65/node_modules/@typescript-eslint/experimental-utils/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["@typescript-eslint/typescript-estree", "1.10.2"],
        ["eslint-scope", "4.0.0"],
        ["@typescript-eslint/experimental-utils", "pnp:0524386e850511b7227b8d994d2da21014039e65"],
      ]),
    }],
  ])],
  ["@typescript-eslint/typescript-estree", new Map([
    ["1.10.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@typescript-eslint-typescript-estree-1.10.2-8403585dd74b6cfb6f78aa98b6958de158b5897b/node_modules/@typescript-eslint/typescript-estree/"),
      packageDependencies: new Map([
        ["lodash.unescape", "4.0.1"],
        ["semver", "5.5.0"],
        ["@typescript-eslint/typescript-estree", "1.10.2"],
      ]),
    }],
  ])],
  ["lodash.unescape", new Map([
    ["4.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-lodash-unescape-4.0.1-bf2249886ce514cda112fae9218cdc065211fc9c/node_modules/lodash.unescape/"),
      packageDependencies: new Map([
        ["lodash.unescape", "4.0.1"],
      ]),
    }],
  ])],
  ["functional-red-black-tree", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-functional-red-black-tree-1.0.1-1b0ab3bd553b2a0d6399d29c0e3ea0b252078327/node_modules/functional-red-black-tree/"),
      packageDependencies: new Map([
        ["functional-red-black-tree", "1.0.1"],
      ]),
    }],
  ])],
  ["tsutils", new Map([
    ["3.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tsutils-3.8.0-7a3dbadc88e465596440622b65c04edc8e187ae5/node_modules/tsutils/"),
      packageDependencies: new Map([
        ["tslib", "1.9.3"],
        ["tsutils", "3.8.0"],
      ]),
    }],
  ])],
  ["@typescript-eslint/parser", new Map([
    ["pnp:18d8d3ba6429cc0d314ad81dd2ee9403bb325efd", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-18d8d3ba6429cc0d314ad81dd2ee9403bb325efd/node_modules/@typescript-eslint/parser/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["@types/eslint-visitor-keys", "1.0.0"],
        ["@typescript-eslint/experimental-utils", "pnp:0524386e850511b7227b8d994d2da21014039e65"],
        ["@typescript-eslint/typescript-estree", "1.10.2"],
        ["eslint-visitor-keys", "1.0.0"],
        ["@typescript-eslint/parser", "pnp:18d8d3ba6429cc0d314ad81dd2ee9403bb325efd"],
      ]),
    }],
  ])],
  ["@types/eslint-visitor-keys", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-eslint-visitor-keys-1.0.0-1ee30d79544ca84d68d4b3cdb0af4f205663dd2d/node_modules/@types/eslint-visitor-keys/"),
      packageDependencies: new Map([
        ["@types/eslint-visitor-keys", "1.0.0"],
      ]),
    }],
  ])],
  ["babel-jest", new Map([
    ["pnp:79a1891facb0f591b6362a15e98a77287a6e39bf", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-79a1891facb0f591b6362a15e98a77287a6e39bf/node_modules/babel-jest/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@jest/transform", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["@types/babel__core", "7.1.0"],
        ["babel-plugin-istanbul", "5.1.0"],
        ["babel-preset-jest", "24.6.0"],
        ["chalk", "2.4.2"],
        ["slash", "2.0.0"],
        ["babel-jest", "pnp:79a1891facb0f591b6362a15e98a77287a6e39bf"],
      ]),
    }],
    ["pnp:eacf3484420336f4c9cd37f3d25667fa873d1fba", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-eacf3484420336f4c9cd37f3d25667fa873d1fba/node_modules/babel-jest/"),
      packageDependencies: new Map([
        ["@babel/core", "7.2.2"],
        ["@jest/transform", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["@types/babel__core", "7.1.0"],
        ["babel-plugin-istanbul", "5.1.0"],
        ["babel-preset-jest", "24.6.0"],
        ["chalk", "2.4.2"],
        ["slash", "2.0.0"],
        ["babel-jest", "pnp:eacf3484420336f4c9cd37f3d25667fa873d1fba"],
      ]),
    }],
  ])],
  ["@jest/transform", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-transform-24.8.0-628fb99dce4f9d254c6fd9341e3eea262e06fef5/node_modules/@jest/transform/"),
      packageDependencies: new Map([
        ["@babel/core", "7.2.2"],
        ["@jest/types", "24.8.0"],
        ["babel-plugin-istanbul", "5.1.0"],
        ["chalk", "2.4.2"],
        ["convert-source-map", "1.6.0"],
        ["fast-json-stable-stringify", "2.0.0"],
        ["graceful-fs", "4.1.15"],
        ["jest-haste-map", "24.8.1"],
        ["jest-regex-util", "24.3.0"],
        ["jest-util", "24.8.0"],
        ["micromatch", "3.1.10"],
        ["realpath-native", "1.1.0"],
        ["slash", "2.0.0"],
        ["source-map", "0.6.1"],
        ["write-file-atomic", "2.4.1"],
        ["@jest/transform", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/types", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-types-24.8.0-f31e25948c58f0abd8c845ae26fcea1491dea7ad/node_modules/@jest/types/"),
      packageDependencies: new Map([
        ["@types/istanbul-lib-coverage", "2.0.1"],
        ["@types/istanbul-reports", "1.1.1"],
        ["@types/yargs", "12.0.10"],
        ["@jest/types", "24.8.0"],
      ]),
    }],
  ])],
  ["@types/istanbul-lib-coverage", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-istanbul-lib-coverage-2.0.1-42995b446db9a48a11a07ec083499a860e9138ff/node_modules/@types/istanbul-lib-coverage/"),
      packageDependencies: new Map([
        ["@types/istanbul-lib-coverage", "2.0.1"],
      ]),
    }],
  ])],
  ["@types/istanbul-reports", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-istanbul-reports-1.1.1-7a8cbf6a406f36c8add871625b278eaf0b0d255a/node_modules/@types/istanbul-reports/"),
      packageDependencies: new Map([
        ["@types/istanbul-lib-coverage", "2.0.1"],
        ["@types/istanbul-lib-report", "1.1.1"],
        ["@types/istanbul-reports", "1.1.1"],
      ]),
    }],
  ])],
  ["@types/istanbul-lib-report", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-istanbul-lib-report-1.1.1-e5471e7fa33c61358dd38426189c037a58433b8c/node_modules/@types/istanbul-lib-report/"),
      packageDependencies: new Map([
        ["@types/istanbul-lib-coverage", "2.0.1"],
        ["@types/istanbul-lib-report", "1.1.1"],
      ]),
    }],
  ])],
  ["@types/yargs", new Map([
    ["12.0.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-yargs-12.0.10-17a8ec65cd8e88f51b418ceb271af18d3137df67/node_modules/@types/yargs/"),
      packageDependencies: new Map([
        ["@types/yargs", "12.0.10"],
      ]),
    }],
  ])],
  ["babel-plugin-istanbul", new Map([
    ["5.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-istanbul-5.1.0-6892f529eff65a3e2d33d87dc5888ffa2ecd4a30/node_modules/babel-plugin-istanbul/"),
      packageDependencies: new Map([
        ["find-up", "3.0.0"],
        ["istanbul-lib-instrument", "3.1.0"],
        ["test-exclude", "5.1.0"],
        ["babel-plugin-istanbul", "5.1.0"],
      ]),
    }],
  ])],
  ["istanbul-lib-instrument", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-instrument-3.1.0-a2b5484a7d445f1f311e93190813fa56dfb62971/node_modules/istanbul-lib-instrument/"),
      packageDependencies: new Map([
        ["@babel/generator", "7.3.2"],
        ["@babel/parser", "7.3.2"],
        ["@babel/template", "7.2.2"],
        ["@babel/traverse", "7.2.3"],
        ["@babel/types", "7.3.2"],
        ["istanbul-lib-coverage", "2.0.3"],
        ["semver", "5.6.0"],
        ["istanbul-lib-instrument", "3.1.0"],
      ]),
    }],
  ])],
  ["istanbul-lib-coverage", new Map([
    ["2.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-coverage-2.0.3-0b891e5ad42312c2b9488554f603795f9a2211ba/node_modules/istanbul-lib-coverage/"),
      packageDependencies: new Map([
        ["istanbul-lib-coverage", "2.0.3"],
      ]),
    }],
  ])],
  ["test-exclude", new Map([
    ["5.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-test-exclude-5.1.0-6ba6b25179d2d38724824661323b73e03c0c1de1/node_modules/test-exclude/"),
      packageDependencies: new Map([
        ["arrify", "1.0.1"],
        ["minimatch", "3.0.4"],
        ["read-pkg-up", "4.0.0"],
        ["require-main-filename", "1.0.1"],
        ["test-exclude", "5.1.0"],
      ]),
    }],
  ])],
  ["jest-haste-map", new Map([
    ["24.8.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-haste-map-24.8.1-f39cc1d2b1d907e014165b4bd5a957afcb992982/node_modules/jest-haste-map/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["anymatch", "2.0.0"],
        ["fb-watchman", "2.0.0"],
        ["graceful-fs", "4.1.15"],
        ["invariant", "2.2.4"],
        ["jest-serializer", "24.4.0"],
        ["jest-util", "24.8.0"],
        ["jest-worker", "24.6.0"],
        ["micromatch", "3.1.10"],
        ["sane", "4.1.0"],
        ["walker", "1.0.7"],
        ["jest-haste-map", "24.8.1"],
      ]),
    }],
  ])],
  ["fb-watchman", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-fb-watchman-2.0.0-54e9abf7dfa2f26cd9b1636c588c1afc05de5d58/node_modules/fb-watchman/"),
      packageDependencies: new Map([
        ["bser", "2.0.0"],
        ["fb-watchman", "2.0.0"],
      ]),
    }],
  ])],
  ["bser", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-bser-2.0.0-9ac78d3ed5d915804fd87acb158bc797147a1719/node_modules/bser/"),
      packageDependencies: new Map([
        ["node-int64", "0.4.0"],
        ["bser", "2.0.0"],
      ]),
    }],
  ])],
  ["node-int64", new Map([
    ["0.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-int64-0.4.0-87a9065cdb355d3182d8f94ce11188b825c68a3b/node_modules/node-int64/"),
      packageDependencies: new Map([
        ["node-int64", "0.4.0"],
      ]),
    }],
  ])],
  ["jest-serializer", new Map([
    ["24.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-serializer-24.4.0-f70c5918c8ea9235ccb1276d232e459080588db3/node_modules/jest-serializer/"),
      packageDependencies: new Map([
        ["jest-serializer", "24.4.0"],
      ]),
    }],
  ])],
  ["jest-util", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-util-24.8.0-41f0e945da11df44cc76d64ffb915d0716f46cd1/node_modules/jest-util/"),
      packageDependencies: new Map([
        ["@jest/console", "24.7.1"],
        ["@jest/fake-timers", "24.8.0"],
        ["@jest/source-map", "24.3.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["callsites", "3.0.0"],
        ["chalk", "2.4.2"],
        ["graceful-fs", "4.1.15"],
        ["is-ci", "2.0.0"],
        ["mkdirp", "0.5.1"],
        ["slash", "2.0.0"],
        ["source-map", "0.6.1"],
        ["jest-util", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/console", new Map([
    ["24.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-console-24.7.1-32a9e42535a97aedfe037e725bd67e954b459545/node_modules/@jest/console/"),
      packageDependencies: new Map([
        ["@jest/source-map", "24.3.0"],
        ["chalk", "2.4.2"],
        ["slash", "2.0.0"],
        ["@jest/console", "24.7.1"],
      ]),
    }],
  ])],
  ["@jest/source-map", new Map([
    ["24.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-source-map-24.3.0-563be3aa4d224caf65ff77edc95cd1ca4da67f28/node_modules/@jest/source-map/"),
      packageDependencies: new Map([
        ["callsites", "3.0.0"],
        ["graceful-fs", "4.1.15"],
        ["source-map", "0.6.1"],
        ["@jest/source-map", "24.3.0"],
      ]),
    }],
  ])],
  ["@jest/fake-timers", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-fake-timers-24.8.0-2e5b80a4f78f284bcb4bd5714b8e10dd36a8d3d1/node_modules/@jest/fake-timers/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["jest-message-util", "24.8.0"],
        ["jest-mock", "24.8.0"],
        ["@jest/fake-timers", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-message-util", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-message-util-24.8.0-0d6891e72a4beacc0292b638685df42e28d6218b/node_modules/jest-message-util/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["@types/stack-utils", "1.0.1"],
        ["chalk", "2.4.2"],
        ["micromatch", "3.1.10"],
        ["slash", "2.0.0"],
        ["stack-utils", "1.0.2"],
        ["jest-message-util", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/test-result", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-test-result-24.8.0-7675d0aaf9d2484caa65e048d9b467d160f8e9d3/node_modules/@jest/test-result/"),
      packageDependencies: new Map([
        ["@jest/console", "24.7.1"],
        ["@jest/types", "24.8.0"],
        ["@types/istanbul-lib-coverage", "2.0.1"],
        ["@jest/test-result", "24.8.0"],
      ]),
    }],
  ])],
  ["@types/stack-utils", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-stack-utils-1.0.1-0a851d3bd96498fa25c33ab7278ed3bd65f06c3e/node_modules/@types/stack-utils/"),
      packageDependencies: new Map([
        ["@types/stack-utils", "1.0.1"],
      ]),
    }],
  ])],
  ["stack-utils", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-stack-utils-1.0.2-33eba3897788558bebfc2db059dc158ec36cebb8/node_modules/stack-utils/"),
      packageDependencies: new Map([
        ["stack-utils", "1.0.2"],
      ]),
    }],
  ])],
  ["jest-mock", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-mock-24.8.0-2f9d14d37699e863f1febf4e4d5a33b7fdbbde56/node_modules/jest-mock/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["jest-mock", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-worker", new Map([
    ["24.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-worker-24.6.0-7f81ceae34b7cde0c9827a6980c35b7cdc0161b3/node_modules/jest-worker/"),
      packageDependencies: new Map([
        ["merge-stream", "1.0.1"],
        ["supports-color", "6.1.0"],
        ["jest-worker", "24.6.0"],
      ]),
    }],
  ])],
  ["merge-stream", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-merge-stream-1.0.1-4041202d508a342ba00174008df0c251b8c135e1/node_modules/merge-stream/"),
      packageDependencies: new Map([
        ["readable-stream", "2.3.6"],
        ["merge-stream", "1.0.1"],
      ]),
    }],
  ])],
  ["sane", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sane-4.1.0-ed881fd922733a6c461bc189dc2b6c006f3ffded/node_modules/sane/"),
      packageDependencies: new Map([
        ["@cnakazawa/watch", "1.0.3"],
        ["anymatch", "2.0.0"],
        ["capture-exit", "2.0.0"],
        ["exec-sh", "0.3.2"],
        ["execa", "1.0.0"],
        ["fb-watchman", "2.0.0"],
        ["micromatch", "3.1.10"],
        ["minimist", "1.2.0"],
        ["walker", "1.0.7"],
        ["sane", "4.1.0"],
      ]),
    }],
  ])],
  ["@cnakazawa/watch", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@cnakazawa-watch-1.0.3-099139eaec7ebf07a27c1786a3ff64f39464d2ef/node_modules/@cnakazawa/watch/"),
      packageDependencies: new Map([
        ["exec-sh", "0.3.2"],
        ["minimist", "1.2.0"],
        ["@cnakazawa/watch", "1.0.3"],
      ]),
    }],
  ])],
  ["exec-sh", new Map([
    ["0.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-exec-sh-0.3.2-6738de2eb7c8e671d0366aea0b0db8c6f7d7391b/node_modules/exec-sh/"),
      packageDependencies: new Map([
        ["exec-sh", "0.3.2"],
      ]),
    }],
  ])],
  ["capture-exit", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-capture-exit-2.0.0-fb953bfaebeb781f62898239dabb426d08a509a4/node_modules/capture-exit/"),
      packageDependencies: new Map([
        ["rsvp", "4.8.4"],
        ["capture-exit", "2.0.0"],
      ]),
    }],
  ])],
  ["rsvp", new Map([
    ["4.8.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-rsvp-4.8.4-b50e6b34583f3dd89329a2f23a8a2be072845911/node_modules/rsvp/"),
      packageDependencies: new Map([
        ["rsvp", "4.8.4"],
      ]),
    }],
  ])],
  ["walker", new Map([
    ["1.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-walker-1.0.7-2f7f9b8fd10d677262b18a884e28d19618e028fb/node_modules/walker/"),
      packageDependencies: new Map([
        ["makeerror", "1.0.11"],
        ["walker", "1.0.7"],
      ]),
    }],
  ])],
  ["makeerror", new Map([
    ["1.0.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-makeerror-1.0.11-e01a5c9109f2af79660e4e8b9587790184f5a96c/node_modules/makeerror/"),
      packageDependencies: new Map([
        ["tmpl", "1.0.4"],
        ["makeerror", "1.0.11"],
      ]),
    }],
  ])],
  ["tmpl", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tmpl-1.0.4-23640dd7b42d00433911140820e5cf440e521dd1/node_modules/tmpl/"),
      packageDependencies: new Map([
        ["tmpl", "1.0.4"],
      ]),
    }],
  ])],
  ["jest-regex-util", new Map([
    ["24.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-regex-util-24.3.0-d5a65f60be1ae3e310d5214a0307581995227b36/node_modules/jest-regex-util/"),
      packageDependencies: new Map([
        ["jest-regex-util", "24.3.0"],
      ]),
    }],
  ])],
  ["realpath-native", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-realpath-native-1.1.0-2003294fea23fb0672f2476ebe22fcf498a2d65c/node_modules/realpath-native/"),
      packageDependencies: new Map([
        ["util.promisify", "1.0.0"],
        ["realpath-native", "1.1.0"],
      ]),
    }],
  ])],
  ["util.promisify", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-util-promisify-1.0.0-440f7165a459c9a16dc145eb8e72f35687097030/node_modules/util.promisify/"),
      packageDependencies: new Map([
        ["define-properties", "1.1.3"],
        ["object.getownpropertydescriptors", "2.0.3"],
        ["util.promisify", "1.0.0"],
      ]),
    }],
  ])],
  ["@types/babel__core", new Map([
    ["7.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-core-7.1.0-710f2487dda4dcfd010ca6abb2b4dc7394365c51/node_modules/@types/babel__core/"),
      packageDependencies: new Map([
        ["@babel/parser", "7.4.2"],
        ["@babel/types", "7.3.2"],
        ["@types/babel__generator", "7.0.2"],
        ["@types/babel__template", "7.0.2"],
        ["@types/babel__traverse", "7.0.6"],
        ["@types/babel__core", "7.1.0"],
      ]),
    }],
  ])],
  ["@types/babel__generator", new Map([
    ["7.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-generator-7.0.2-d2112a6b21fad600d7674274293c85dce0cb47fc/node_modules/@types/babel__generator/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@types/babel__generator", "7.0.2"],
      ]),
    }],
  ])],
  ["@types/babel__template", new Map([
    ["7.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-template-7.0.2-4ff63d6b52eddac1de7b975a5223ed32ecea9307/node_modules/@types/babel__template/"),
      packageDependencies: new Map([
        ["@babel/parser", "7.4.2"],
        ["@babel/types", "7.3.2"],
        ["@types/babel__template", "7.0.2"],
      ]),
    }],
  ])],
  ["@types/babel__traverse", new Map([
    ["7.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-traverse-7.0.6-328dd1a8fc4cfe3c8458be9477b219ea158fd7b2/node_modules/@types/babel__traverse/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@types/babel__traverse", "7.0.6"],
      ]),
    }],
  ])],
  ["babel-preset-jest", new Map([
    ["24.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-preset-jest-24.6.0-66f06136eefce87797539c0d63f1769cc3915984/node_modules/babel-preset-jest/"),
      packageDependencies: new Map([
        ["@babel/core", "7.4.5"],
        ["@babel/plugin-syntax-object-rest-spread", "pnp:02230c10914cd035a201a3903a61f186c4b9c0e8"],
        ["babel-plugin-jest-hoist", "24.6.0"],
        ["babel-preset-jest", "24.6.0"],
      ]),
    }],
  ])],
  ["babel-plugin-jest-hoist", new Map([
    ["24.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-jest-hoist-24.6.0-f7f7f7ad150ee96d7a5e8e2c5da8319579e78019/node_modules/babel-plugin-jest-hoist/"),
      packageDependencies: new Map([
        ["@types/babel__traverse", "7.0.6"],
        ["babel-plugin-jest-hoist", "24.6.0"],
      ]),
    }],
  ])],
  ["eslint", new Map([
    ["5.16.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-eslint-5.16.0-a1e3ac1aae4a3fbd8296fcf8f7ab7314cbb6abea/node_modules/eslint/"),
      packageDependencies: new Map([
        ["@babel/code-frame", "7.0.0"],
        ["ajv", "6.9.1"],
        ["chalk", "2.4.2"],
        ["cross-spawn", "6.0.5"],
        ["debug", "4.1.1"],
        ["doctrine", "3.0.0"],
        ["eslint-scope", "4.0.3"],
        ["eslint-utils", "1.3.1"],
        ["eslint-visitor-keys", "1.0.0"],
        ["espree", "5.0.1"],
        ["esquery", "1.0.1"],
        ["esutils", "2.0.2"],
        ["file-entry-cache", "5.0.1"],
        ["functional-red-black-tree", "1.0.1"],
        ["glob", "7.1.3"],
        ["globals", "11.10.0"],
        ["ignore", "4.0.6"],
        ["import-fresh", "3.0.0"],
        ["imurmurhash", "0.1.4"],
        ["inquirer", "6.2.2"],
        ["js-yaml", "3.13.1"],
        ["json-stable-stringify-without-jsonify", "1.0.1"],
        ["levn", "0.3.0"],
        ["lodash", "4.17.11"],
        ["minimatch", "3.0.4"],
        ["mkdirp", "0.5.1"],
        ["natural-compare", "1.4.0"],
        ["optionator", "0.8.2"],
        ["path-is-inside", "1.0.2"],
        ["progress", "2.0.3"],
        ["regexpp", "2.0.1"],
        ["semver", "5.6.0"],
        ["strip-ansi", "4.0.0"],
        ["strip-json-comments", "2.0.1"],
        ["table", "5.2.3"],
        ["text-table", "0.2.0"],
        ["eslint", "5.16.0"],
      ]),
    }],
  ])],
  ["espree", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-espree-5.0.1-5d6526fa4fc7f0788a5cf75b15f30323e2f81f7a/node_modules/espree/"),
      packageDependencies: new Map([
        ["acorn", "6.1.1"],
        ["acorn-jsx", "5.0.1"],
        ["eslint-visitor-keys", "1.0.0"],
        ["espree", "5.0.1"],
      ]),
    }],
  ])],
  ["acorn-jsx", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-acorn-jsx-5.0.1-32a064fd925429216a09b141102bfdd185fae40e/node_modules/acorn-jsx/"),
      packageDependencies: new Map([
        ["acorn", "6.1.1"],
        ["acorn-jsx", "5.0.1"],
      ]),
    }],
  ])],
  ["esquery", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-esquery-1.0.1-406c51658b1f5991a5f9b62b1dc25b00e3e5c708/node_modules/esquery/"),
      packageDependencies: new Map([
        ["estraverse", "4.2.0"],
        ["esquery", "1.0.1"],
      ]),
    }],
  ])],
  ["file-entry-cache", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-file-entry-cache-5.0.1-ca0f6efa6dd3d561333fb14515065c2fafdf439c/node_modules/file-entry-cache/"),
      packageDependencies: new Map([
        ["flat-cache", "2.0.1"],
        ["file-entry-cache", "5.0.1"],
      ]),
    }],
  ])],
  ["flat-cache", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-flat-cache-2.0.1-5d296d6f04bda44a4630a301413bdbc2ec085ec0/node_modules/flat-cache/"),
      packageDependencies: new Map([
        ["flatted", "2.0.0"],
        ["rimraf", "2.6.3"],
        ["write", "1.0.3"],
        ["flat-cache", "2.0.1"],
      ]),
    }],
  ])],
  ["flatted", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-flatted-2.0.0-55122b6536ea496b4b44893ee2608141d10d9916/node_modules/flatted/"),
      packageDependencies: new Map([
        ["flatted", "2.0.0"],
      ]),
    }],
  ])],
  ["write", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-write-1.0.3-0800e14523b923a387e415123c865616aae0f5c3/node_modules/write/"),
      packageDependencies: new Map([
        ["mkdirp", "0.5.1"],
        ["write", "1.0.3"],
      ]),
    }],
  ])],
  ["parent-module", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-parent-module-1.0.0-df250bdc5391f4a085fb589dad761f5ad6b865b5/node_modules/parent-module/"),
      packageDependencies: new Map([
        ["callsites", "3.0.0"],
        ["parent-module", "1.0.0"],
      ]),
    }],
  ])],
  ["js-yaml", new Map([
    ["3.13.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-js-yaml-3.13.1-aff151b30bfdfa8e49e05da22e7415e9dfa37847/node_modules/js-yaml/"),
      packageDependencies: new Map([
        ["argparse", "1.0.10"],
        ["esprima", "4.0.1"],
        ["js-yaml", "3.13.1"],
      ]),
    }],
  ])],
  ["argparse", new Map([
    ["1.0.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-argparse-1.0.10-bcd6791ea5ae09725e17e5ad988134cd40b3d911/node_modules/argparse/"),
      packageDependencies: new Map([
        ["sprintf-js", "1.0.3"],
        ["argparse", "1.0.10"],
      ]),
    }],
  ])],
  ["sprintf-js", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sprintf-js-1.0.3-04e6926f662895354f3dd015203633b857297e2c/node_modules/sprintf-js/"),
      packageDependencies: new Map([
        ["sprintf-js", "1.0.3"],
      ]),
    }],
  ])],
  ["json-stable-stringify-without-jsonify", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-json-stable-stringify-without-jsonify-1.0.1-9db7b59496ad3f3cfef30a75142d2d930ad72651/node_modules/json-stable-stringify-without-jsonify/"),
      packageDependencies: new Map([
        ["json-stable-stringify-without-jsonify", "1.0.1"],
      ]),
    }],
  ])],
  ["natural-compare", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-natural-compare-1.4.0-4abebfeed7541f2c27acfb29bdbbd15c8d5ba4f7/node_modules/natural-compare/"),
      packageDependencies: new Map([
        ["natural-compare", "1.4.0"],
      ]),
    }],
  ])],
  ["progress", new Map([
    ["2.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-progress-2.0.3-7e8cf8d8f5b8f239c1bc68beb4eb78567d572ef8/node_modules/progress/"),
      packageDependencies: new Map([
        ["progress", "2.0.3"],
      ]),
    }],
  ])],
  ["table", new Map([
    ["5.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-table-5.2.3-cde0cc6eb06751c009efab27e8c820ca5b67b7f2/node_modules/table/"),
      packageDependencies: new Map([
        ["ajv", "6.9.1"],
        ["lodash", "4.17.11"],
        ["slice-ansi", "2.1.0"],
        ["string-width", "3.0.0"],
        ["table", "5.2.3"],
      ]),
    }],
  ])],
  ["astral-regex", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-astral-regex-1.0.0-6c8c3fb827dd43ee3918f27b82782ab7658a6fd9/node_modules/astral-regex/"),
      packageDependencies: new Map([
        ["astral-regex", "1.0.0"],
      ]),
    }],
  ])],
  ["text-table", new Map([
    ["0.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-text-table-0.2.0-7f5ee823ae805207c00af2df4a84ec3fcfa570b4/node_modules/text-table/"),
      packageDependencies: new Map([
        ["text-table", "0.2.0"],
      ]),
    }],
  ])],
  ["eslint-import-resolver-typescript", new Map([
    ["pnp:6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d/node_modules/eslint-import-resolver-typescript/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["eslint-plugin-import", "pnp:e13d44595399586b5a77811b3bc990943932eacf"],
        ["debug", "4.1.1"],
        ["resolve", "1.10.0"],
        ["tsconfig-paths", "3.8.0"],
        ["eslint-import-resolver-typescript", "pnp:6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d"],
      ]),
    }],
  ])],
  ["tsconfig-paths", new Map([
    ["3.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-tsconfig-paths-3.8.0-4e34202d5b41958f269cf56b01ed95b853d59f72/node_modules/tsconfig-paths/"),
      packageDependencies: new Map([
        ["@types/json5", "0.0.29"],
        ["deepmerge", "2.2.1"],
        ["json5", "1.0.1"],
        ["minimist", "1.2.0"],
        ["strip-bom", "3.0.0"],
        ["tsconfig-paths", "3.8.0"],
      ]),
    }],
  ])],
  ["@types/json5", new Map([
    ["0.0.29", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@types-json5-0.0.29-ee28707ae94e11d2b827bcbe5270bcea7f3e71ee/node_modules/@types/json5/"),
      packageDependencies: new Map([
        ["@types/json5", "0.0.29"],
      ]),
    }],
  ])],
  ["deepmerge", new Map([
    ["2.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-deepmerge-2.2.1-5d3ff22a01c00f645405a2fbc17d0778a1801170/node_modules/deepmerge/"),
      packageDependencies: new Map([
        ["deepmerge", "2.2.1"],
      ]),
    }],
  ])],
  ["eslint-plugin-flowtype", new Map([
    ["pnp:b20d52d1b63fe4d37c11acdb1befff790dd9c0c8", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-b20d52d1b63fe4d37c11acdb1befff790dd9c0c8/node_modules/eslint-plugin-flowtype/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["lodash", "4.17.11"],
        ["eslint-plugin-flowtype", "pnp:b20d52d1b63fe4d37c11acdb1befff790dd9c0c8"],
      ]),
    }],
  ])],
  ["array-includes", new Map([
    ["3.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-array-includes-3.0.3-184b48f62d92d7452bb31b323165c7f8bd02266d/node_modules/array-includes/"),
      packageDependencies: new Map([
        ["define-properties", "1.1.3"],
        ["es-abstract", "1.13.0"],
        ["array-includes", "3.0.3"],
      ]),
    }],
  ])],
  ["eslint-plugin-jest", new Map([
    ["pnp:c895d8e50ffed0a846dcd923855078bfa566d5f7", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-c895d8e50ffed0a846dcd923855078bfa566d5f7/node_modules/eslint-plugin-jest/"),
      packageDependencies: new Map([
        ["eslint", "5.16.0"],
        ["eslint-plugin-jest", "pnp:c895d8e50ffed0a846dcd923855078bfa566d5f7"],
      ]),
    }],
  ])],
  ["flow-bin", new Map([
    ["0.88.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-flow-bin-0.88.0-e4c7bd93da2331f6ac1733fbe484b1b0c52eb548/node_modules/flow-bin/"),
      packageDependencies: new Map([
        ["flow-bin", "0.88.0"],
      ]),
    }],
  ])],
  ["jest", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-24.8.0-d5dff1984d0d1002196e9b7f12f75af1b2809081/node_modules/jest/"),
      packageDependencies: new Map([
        ["import-local", "2.0.0"],
        ["jest-cli", "24.8.0"],
        ["jest", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-cli", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-cli-24.8.0-b075ac914492ed114fa338ade7362a301693e989/node_modules/jest-cli/"),
      packageDependencies: new Map([
        ["@jest/core", "24.8.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["chalk", "2.4.2"],
        ["exit", "0.1.2"],
        ["import-local", "2.0.0"],
        ["is-ci", "2.0.0"],
        ["jest-config", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-validate", "24.8.0"],
        ["prompts", "2.0.2"],
        ["realpath-native", "1.1.0"],
        ["yargs", "12.0.5"],
        ["jest-cli", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/core", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-core-24.8.0-fbbdcd42a41d0d39cddbc9f520c8bab0c33eed5b/node_modules/@jest/core/"),
      packageDependencies: new Map([
        ["@jest/console", "24.7.1"],
        ["@jest/reporters", "24.8.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/transform", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["ansi-escapes", "3.2.0"],
        ["chalk", "2.4.2"],
        ["exit", "0.1.2"],
        ["graceful-fs", "4.1.15"],
        ["jest-changed-files", "24.8.0"],
        ["jest-config", "24.8.0"],
        ["jest-haste-map", "24.8.1"],
        ["jest-message-util", "24.8.0"],
        ["jest-regex-util", "24.3.0"],
        ["jest-resolve-dependencies", "24.8.0"],
        ["jest-runner", "24.8.0"],
        ["jest-runtime", "24.8.0"],
        ["jest-snapshot", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-validate", "24.8.0"],
        ["jest-watcher", "24.8.0"],
        ["micromatch", "3.1.10"],
        ["p-each-series", "1.0.0"],
        ["pirates", "4.0.1"],
        ["realpath-native", "1.1.0"],
        ["rimraf", "2.6.3"],
        ["strip-ansi", "5.0.0"],
        ["@jest/core", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/reporters", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-reporters-24.8.0-075169cd029bddec54b8f2c0fc489fd0b9e05729/node_modules/@jest/reporters/"),
      packageDependencies: new Map([
        ["@jest/environment", "24.8.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/transform", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["chalk", "2.4.2"],
        ["exit", "0.1.2"],
        ["glob", "7.1.3"],
        ["istanbul-lib-coverage", "2.0.3"],
        ["istanbul-lib-instrument", "3.1.0"],
        ["istanbul-lib-report", "2.0.4"],
        ["istanbul-lib-source-maps", "3.0.2"],
        ["istanbul-reports", "2.1.1"],
        ["jest-haste-map", "24.8.1"],
        ["jest-resolve", "24.8.0"],
        ["jest-runtime", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-worker", "24.6.0"],
        ["node-notifier", "5.4.0"],
        ["slash", "2.0.0"],
        ["source-map", "0.6.1"],
        ["string-length", "2.0.0"],
        ["@jest/reporters", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/environment", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-environment-24.8.0-0342261383c776bdd652168f68065ef144af0eac/node_modules/@jest/environment/"),
      packageDependencies: new Map([
        ["@jest/fake-timers", "24.8.0"],
        ["@jest/transform", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["jest-mock", "24.8.0"],
        ["@jest/environment", "24.8.0"],
      ]),
    }],
  ])],
  ["exit", new Map([
    ["0.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-exit-0.1.2-0632638f8d877cc82107d30a0fff1a17cba1cd0c/node_modules/exit/"),
      packageDependencies: new Map([
        ["exit", "0.1.2"],
      ]),
    }],
  ])],
  ["istanbul-lib-report", new Map([
    ["2.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-report-2.0.4-bfd324ee0c04f59119cb4f07dab157d09f24d7e4/node_modules/istanbul-lib-report/"),
      packageDependencies: new Map([
        ["istanbul-lib-coverage", "2.0.3"],
        ["make-dir", "1.3.0"],
        ["supports-color", "6.1.0"],
        ["istanbul-lib-report", "2.0.4"],
      ]),
    }],
  ])],
  ["istanbul-lib-source-maps", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-source-maps-3.0.2-f1e817229a9146e8424a28e5d69ba220fda34156/node_modules/istanbul-lib-source-maps/"),
      packageDependencies: new Map([
        ["debug", "4.1.1"],
        ["istanbul-lib-coverage", "2.0.3"],
        ["make-dir", "1.3.0"],
        ["rimraf", "2.6.3"],
        ["source-map", "0.6.1"],
        ["istanbul-lib-source-maps", "3.0.2"],
      ]),
    }],
  ])],
  ["istanbul-reports", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-reports-2.1.1-72ef16b4ecb9a4a7bd0e2001e00f95d1eec8afa9/node_modules/istanbul-reports/"),
      packageDependencies: new Map([
        ["handlebars", "4.1.1"],
        ["istanbul-reports", "2.1.1"],
      ]),
    }],
  ])],
  ["handlebars", new Map([
    ["4.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-handlebars-4.1.1-6e4e41c18ebe7719ae4d38e5aca3d32fa3dd23d3/node_modules/handlebars/"),
      packageDependencies: new Map([
        ["neo-async", "2.6.0"],
        ["optimist", "0.6.1"],
        ["source-map", "0.6.1"],
        ["uglify-js", "3.4.9"],
        ["handlebars", "4.1.1"],
      ]),
    }],
  ])],
  ["neo-async", new Map([
    ["2.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-neo-async-2.6.0-b9d15e4d71c6762908654b5183ed38b753340835/node_modules/neo-async/"),
      packageDependencies: new Map([
        ["neo-async", "2.6.0"],
      ]),
    }],
  ])],
  ["optimist", new Map([
    ["0.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-optimist-0.6.1-da3ea74686fa21a19a111c326e90eb15a0196686/node_modules/optimist/"),
      packageDependencies: new Map([
        ["minimist", "0.0.10"],
        ["wordwrap", "0.0.3"],
        ["optimist", "0.6.1"],
      ]),
    }],
  ])],
  ["uglify-js", new Map([
    ["3.4.9", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-uglify-js-3.4.9-af02f180c1207d76432e473ed24a28f4a782bae3/node_modules/uglify-js/"),
      packageDependencies: new Map([
        ["commander", "2.17.1"],
        ["source-map", "0.6.1"],
        ["uglify-js", "3.4.9"],
      ]),
    }],
  ])],
  ["jest-resolve", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-resolve-24.8.0-84b8e5408c1f6a11539793e2b5feb1b6e722439f/node_modules/jest-resolve/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["browser-resolve", "1.11.3"],
        ["chalk", "2.4.2"],
        ["jest-pnp-resolver", "1.2.1"],
        ["realpath-native", "1.1.0"],
        ["jest-resolve", "24.8.0"],
      ]),
    }],
  ])],
  ["browser-resolve", new Map([
    ["1.11.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-browser-resolve-1.11.3-9b7cbb3d0f510e4cb86bdbd796124d28b5890af6/node_modules/browser-resolve/"),
      packageDependencies: new Map([
        ["resolve", "1.1.7"],
        ["browser-resolve", "1.11.3"],
      ]),
    }],
  ])],
  ["jest-pnp-resolver", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-pnp-resolver-1.2.1-ecdae604c077a7fbc70defb6d517c3c1c898923a/node_modules/jest-pnp-resolver/"),
      packageDependencies: new Map([
        ["jest-pnp-resolver", "1.2.1"],
      ]),
    }],
  ])],
  ["jest-runtime", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-runtime-24.8.0-05f94d5b05c21f6dc54e427cd2e4980923350620/node_modules/jest-runtime/"),
      packageDependencies: new Map([
        ["@jest/console", "24.7.1"],
        ["@jest/environment", "24.8.0"],
        ["@jest/source-map", "24.3.0"],
        ["@jest/transform", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["@types/yargs", "12.0.10"],
        ["chalk", "2.4.2"],
        ["exit", "0.1.2"],
        ["glob", "7.1.3"],
        ["graceful-fs", "4.1.15"],
        ["jest-config", "24.8.0"],
        ["jest-haste-map", "24.8.1"],
        ["jest-message-util", "24.8.0"],
        ["jest-mock", "24.8.0"],
        ["jest-regex-util", "24.3.0"],
        ["jest-resolve", "24.8.0"],
        ["jest-snapshot", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-validate", "24.8.0"],
        ["realpath-native", "1.1.0"],
        ["slash", "2.0.0"],
        ["strip-bom", "3.0.0"],
        ["yargs", "12.0.5"],
        ["jest-runtime", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-config", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-config-24.8.0-77db3d265a6f726294687cbbccc36f8a76ee0f4f/node_modules/jest-config/"),
      packageDependencies: new Map([
        ["@babel/core", "7.2.2"],
        ["@jest/test-sequencer", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["babel-jest", "pnp:eacf3484420336f4c9cd37f3d25667fa873d1fba"],
        ["chalk", "2.4.2"],
        ["glob", "7.1.3"],
        ["jest-environment-jsdom", "24.8.0"],
        ["jest-environment-node", "24.8.0"],
        ["jest-get-type", "24.8.0"],
        ["jest-jasmine2", "24.8.0"],
        ["jest-regex-util", "24.3.0"],
        ["jest-resolve", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-validate", "24.8.0"],
        ["micromatch", "3.1.10"],
        ["pretty-format", "24.8.0"],
        ["realpath-native", "1.1.0"],
        ["jest-config", "24.8.0"],
      ]),
    }],
  ])],
  ["@jest/test-sequencer", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-@jest-test-sequencer-24.8.0-2f993bcf6ef5eb4e65e8233a95a3320248cf994b/node_modules/@jest/test-sequencer/"),
      packageDependencies: new Map([
        ["@jest/test-result", "24.8.0"],
        ["jest-haste-map", "24.8.1"],
        ["jest-runner", "24.8.0"],
        ["jest-runtime", "24.8.0"],
        ["@jest/test-sequencer", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-runner", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-runner-24.8.0-4f9ae07b767db27b740d7deffad0cf67ccb4c5bb/node_modules/jest-runner/"),
      packageDependencies: new Map([
        ["@jest/console", "24.7.1"],
        ["@jest/environment", "24.8.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["chalk", "2.4.2"],
        ["exit", "0.1.2"],
        ["graceful-fs", "4.1.15"],
        ["jest-config", "24.8.0"],
        ["jest-docblock", "24.3.0"],
        ["jest-haste-map", "24.8.1"],
        ["jest-jasmine2", "24.8.0"],
        ["jest-leak-detector", "24.8.0"],
        ["jest-message-util", "24.8.0"],
        ["jest-resolve", "24.8.0"],
        ["jest-runtime", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-worker", "24.6.0"],
        ["source-map-support", "0.5.10"],
        ["throat", "4.1.0"],
        ["jest-runner", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-docblock", new Map([
    ["24.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-docblock-24.3.0-b9c32dac70f72e4464520d2ba4aec02ab14db5dd/node_modules/jest-docblock/"),
      packageDependencies: new Map([
        ["detect-newline", "2.1.0"],
        ["jest-docblock", "24.3.0"],
      ]),
    }],
  ])],
  ["detect-newline", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-detect-newline-2.1.0-f41f1c10be4b00e87b5f13da680759f2c5bfd3e2/node_modules/detect-newline/"),
      packageDependencies: new Map([
        ["detect-newline", "2.1.0"],
      ]),
    }],
  ])],
  ["jest-jasmine2", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-jasmine2-24.8.0-a9c7e14c83dd77d8b15e820549ce8987cc8cd898/node_modules/jest-jasmine2/"),
      packageDependencies: new Map([
        ["@babel/traverse", "7.2.3"],
        ["@jest/environment", "24.8.0"],
        ["@jest/test-result", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["chalk", "2.4.2"],
        ["co", "4.6.0"],
        ["expect", "24.8.0"],
        ["is-generator-fn", "2.0.0"],
        ["jest-each", "24.8.0"],
        ["jest-matcher-utils", "24.8.0"],
        ["jest-message-util", "24.8.0"],
        ["jest-runtime", "24.8.0"],
        ["jest-snapshot", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["pretty-format", "24.8.0"],
        ["throat", "4.1.0"],
        ["jest-jasmine2", "24.8.0"],
      ]),
    }],
  ])],
  ["co", new Map([
    ["4.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-co-4.6.0-6ea6bdf3d853ae54ccb8e47bfa0bf3f9031fb184/node_modules/co/"),
      packageDependencies: new Map([
        ["co", "4.6.0"],
      ]),
    }],
  ])],
  ["expect", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-expect-24.8.0-471f8ec256b7b6129ca2524b2a62f030df38718d/node_modules/expect/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["ansi-styles", "3.2.1"],
        ["jest-get-type", "24.8.0"],
        ["jest-matcher-utils", "24.8.0"],
        ["jest-message-util", "24.8.0"],
        ["jest-regex-util", "24.3.0"],
        ["expect", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-get-type", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-get-type-24.8.0-a7440de30b651f5a70ea3ed7ff073a32dfe646fc/node_modules/jest-get-type/"),
      packageDependencies: new Map([
        ["jest-get-type", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-matcher-utils", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-matcher-utils-24.8.0-2bce42204c9af12bde46f83dc839efe8be832495/node_modules/jest-matcher-utils/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["jest-diff", "24.8.0"],
        ["jest-get-type", "24.8.0"],
        ["pretty-format", "24.8.0"],
        ["jest-matcher-utils", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-diff", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-diff-24.8.0-146435e7d1e3ffdf293d53ff97e193f1d1546172/node_modules/jest-diff/"),
      packageDependencies: new Map([
        ["chalk", "2.4.2"],
        ["diff-sequences", "24.3.0"],
        ["jest-get-type", "24.8.0"],
        ["pretty-format", "24.8.0"],
        ["jest-diff", "24.8.0"],
      ]),
    }],
  ])],
  ["diff-sequences", new Map([
    ["24.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-diff-sequences-24.3.0-0f20e8a1df1abddaf4d9c226680952e64118b975/node_modules/diff-sequences/"),
      packageDependencies: new Map([
        ["diff-sequences", "24.3.0"],
      ]),
    }],
  ])],
  ["pretty-format", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-pretty-format-24.8.0-8dae7044f58db7cb8be245383b565a963e3c27f2/node_modules/pretty-format/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["ansi-regex", "4.0.0"],
        ["ansi-styles", "3.2.1"],
        ["react-is", "16.8.5"],
        ["pretty-format", "24.8.0"],
      ]),
    }],
  ])],
  ["react-is", new Map([
    ["16.8.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-react-is-16.8.5-c54ac229dd66b5afe0de5acbe47647c3da692ff8/node_modules/react-is/"),
      packageDependencies: new Map([
        ["react-is", "16.8.5"],
      ]),
    }],
  ])],
  ["is-generator-fn", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-generator-fn-2.0.0-038c31b774709641bda678b1f06a4e3227c10b3e/node_modules/is-generator-fn/"),
      packageDependencies: new Map([
        ["is-generator-fn", "2.0.0"],
      ]),
    }],
  ])],
  ["jest-each", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-each-24.8.0-a05fd2bf94ddc0b1da66c6d13ec2457f35e52775/node_modules/jest-each/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["chalk", "2.4.2"],
        ["jest-get-type", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["pretty-format", "24.8.0"],
        ["jest-each", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-snapshot", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-snapshot-24.8.0-3bec6a59da2ff7bc7d097a853fb67f9d415cb7c6/node_modules/jest-snapshot/"),
      packageDependencies: new Map([
        ["@babel/types", "7.3.2"],
        ["@jest/types", "24.8.0"],
        ["chalk", "2.4.2"],
        ["expect", "24.8.0"],
        ["jest-diff", "24.8.0"],
        ["jest-matcher-utils", "24.8.0"],
        ["jest-message-util", "24.8.0"],
        ["jest-resolve", "24.8.0"],
        ["mkdirp", "0.5.1"],
        ["natural-compare", "1.4.0"],
        ["pretty-format", "24.8.0"],
        ["semver", "5.6.0"],
        ["jest-snapshot", "24.8.0"],
      ]),
    }],
  ])],
  ["throat", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-throat-4.1.0-89037cbc92c56ab18926e6ba4cbb200e15672a6a/node_modules/throat/"),
      packageDependencies: new Map([
        ["throat", "4.1.0"],
      ]),
    }],
  ])],
  ["jest-leak-detector", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-leak-detector-24.8.0-c0086384e1f650c2d8348095df769f29b48e6980/node_modules/jest-leak-detector/"),
      packageDependencies: new Map([
        ["pretty-format", "24.8.0"],
        ["jest-leak-detector", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-environment-jsdom", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-environment-jsdom-24.8.0-300f6949a146cabe1c9357ad9e9ecf9f43f38857/node_modules/jest-environment-jsdom/"),
      packageDependencies: new Map([
        ["@jest/environment", "24.8.0"],
        ["@jest/fake-timers", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["jest-mock", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jsdom", "11.12.0"],
        ["jest-environment-jsdom", "24.8.0"],
      ]),
    }],
  ])],
  ["left-pad", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-left-pad-1.3.0-5b8a3a7765dfe001261dde915589e782f8c94d1e/node_modules/left-pad/"),
      packageDependencies: new Map([
        ["left-pad", "1.3.0"],
      ]),
    }],
  ])],
  ["sax", new Map([
    ["1.2.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sax-1.2.4-2816234e2378bddc4e5354fab5caa895df7100d9/node_modules/sax/"),
      packageDependencies: new Map([
        ["sax", "1.2.4"],
      ]),
    }],
  ])],
  ["jest-environment-node", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-environment-node-24.8.0-d3f726ba8bc53087a60e7a84ca08883a4c892231/node_modules/jest-environment-node/"),
      packageDependencies: new Map([
        ["@jest/environment", "24.8.0"],
        ["@jest/fake-timers", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["jest-mock", "24.8.0"],
        ["jest-util", "24.8.0"],
        ["jest-environment-node", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-validate", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-validate-24.8.0-624c41533e6dfe356ffadc6e2423a35c2d3b4849/node_modules/jest-validate/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["camelcase", "5.0.0"],
        ["chalk", "2.4.2"],
        ["jest-get-type", "24.8.0"],
        ["leven", "2.1.0"],
        ["pretty-format", "24.8.0"],
        ["jest-validate", "24.8.0"],
      ]),
    }],
  ])],
  ["node-notifier", new Map([
    ["5.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-node-notifier-5.4.0-7b455fdce9f7de0c63538297354f3db468426e6a/node_modules/node-notifier/"),
      packageDependencies: new Map([
        ["growly", "1.3.0"],
        ["is-wsl", "1.1.0"],
        ["semver", "5.6.0"],
        ["shellwords", "0.1.1"],
        ["which", "1.3.1"],
        ["node-notifier", "5.4.0"],
      ]),
    }],
  ])],
  ["growly", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-growly-1.3.0-f10748cbe76af964b7c96c93c6bcc28af120c081/node_modules/growly/"),
      packageDependencies: new Map([
        ["growly", "1.3.0"],
      ]),
    }],
  ])],
  ["is-wsl", new Map([
    ["1.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-is-wsl-1.1.0-1f16e4aa22b04d1336b66188a66af3c600c3a66d/node_modules/is-wsl/"),
      packageDependencies: new Map([
        ["is-wsl", "1.1.0"],
      ]),
    }],
  ])],
  ["shellwords", new Map([
    ["0.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-shellwords-0.1.1-d6b9181c1a48d397324c84871efbcfc73fc0654b/node_modules/shellwords/"),
      packageDependencies: new Map([
        ["shellwords", "0.1.1"],
      ]),
    }],
  ])],
  ["string-length", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-string-length-2.0.0-d40dbb686a3ace960c1cffca562bf2c45f8363ed/node_modules/string-length/"),
      packageDependencies: new Map([
        ["astral-regex", "1.0.0"],
        ["strip-ansi", "4.0.0"],
        ["string-length", "2.0.0"],
      ]),
    }],
  ])],
  ["jest-changed-files", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-changed-files-24.8.0-7e7eb21cf687587a85e50f3d249d1327e15b157b/node_modules/jest-changed-files/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["execa", "1.0.0"],
        ["throat", "4.1.0"],
        ["jest-changed-files", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-resolve-dependencies", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-resolve-dependencies-24.8.0-19eec3241f2045d3f990dba331d0d7526acff8e0/node_modules/jest-resolve-dependencies/"),
      packageDependencies: new Map([
        ["@jest/types", "24.8.0"],
        ["jest-regex-util", "24.3.0"],
        ["jest-snapshot", "24.8.0"],
        ["jest-resolve-dependencies", "24.8.0"],
      ]),
    }],
  ])],
  ["jest-watcher", new Map([
    ["24.8.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-jest-watcher-24.8.0-58d49915ceddd2de85e238f6213cef1c93715de4/node_modules/jest-watcher/"),
      packageDependencies: new Map([
        ["@jest/test-result", "24.8.0"],
        ["@jest/types", "24.8.0"],
        ["@types/yargs", "12.0.10"],
        ["ansi-escapes", "3.2.0"],
        ["chalk", "2.4.2"],
        ["jest-util", "24.8.0"],
        ["string-length", "2.0.0"],
        ["jest-watcher", "24.8.0"],
      ]),
    }],
  ])],
  ["p-each-series", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-each-series-1.0.0-930f3d12dd1f50e7434457a22cd6f04ac6ad7f71/node_modules/p-each-series/"),
      packageDependencies: new Map([
        ["p-reduce", "1.0.0"],
        ["p-each-series", "1.0.0"],
      ]),
    }],
  ])],
  ["p-reduce", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-p-reduce-1.0.0-18c2b0dd936a4690a529f8231f58a0fdb6a47dfa/node_modules/p-reduce/"),
      packageDependencies: new Map([
        ["p-reduce", "1.0.0"],
      ]),
    }],
  ])],
  ["prompts", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-prompts-2.0.2-094119b0b0a553ec652908b583205b9867630154/node_modules/prompts/"),
      packageDependencies: new Map([
        ["kleur", "3.0.2"],
        ["sisteransi", "1.0.0"],
        ["prompts", "2.0.2"],
      ]),
    }],
  ])],
  ["kleur", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-kleur-3.0.2-83c7ec858a41098b613d5998a7b653962b504f68/node_modules/kleur/"),
      packageDependencies: new Map([
        ["kleur", "3.0.2"],
      ]),
    }],
  ])],
  ["sisteransi", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-sisteransi-1.0.0-77d9622ff909080f1c19e5f4a1df0c1b0a27b88c/node_modules/sisteransi/"),
      packageDependencies: new Map([
        ["sisteransi", "1.0.0"],
      ]),
    }],
  ])],
  ["prepend-file", new Map([
    ["1.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-prepend-file-1.3.1-83b16e0b4ac1901fce88dbd945a22f4cc81df579/node_modules/prepend-file/"),
      packageDependencies: new Map([
        ["tmp", "0.0.31"],
        ["prepend-file", "1.3.1"],
      ]),
    }],
  ])],
  ["ts-pnp", new Map([
    ["pnp:fd6678ea8eedcc24dee2638388893d42f3dbc358", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-fd6678ea8eedcc24dee2638388893d42f3dbc358/node_modules/ts-pnp/"),
      packageDependencies: new Map([
        ["typescript", "3.5.2"],
        ["ts-pnp", "pnp:fd6678ea8eedcc24dee2638388893d42f3dbc358"],
      ]),
    }],
  ])],
  ["typescript", new Map([
    ["3.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v4/npm-typescript-3.5.2-a09e1dc69bc9551cadf17dba10ee42cf55e5d56c/node_modules/typescript/"),
      packageDependencies: new Map([
        ["typescript", "3.5.2"],
      ]),
    }],
  ])],
  [null, new Map([
    [null, {
      packageLocation: path.resolve(__dirname, "./"),
      packageDependencies: new Map([
        ["@babel/cli", "pnp:9b014519ce8c6df6754c3598b7e86ae703bf63ce"],
        ["@babel/core", "7.4.5"],
        ["@babel/node", "pnp:12d0714a6c937f322d9609379be0e61c73ed8931"],
        ["@babel/parser", "7.4.5"],
        ["@babel/plugin-proposal-class-properties", "pnp:14724cda3c3ac650e41a80edd910cdecbe601f04"],
        ["@babel/plugin-proposal-object-rest-spread", "pnp:a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75"],
        ["@babel/preset-env", "pnp:0fcb8a86302027dee988c72e7fda9a303025484a"],
        ["@babel/preset-flow", "pnp:d4afbbd6215b1993d05095efb590984f9b6a3a02"],
        ["@babel/preset-typescript", "pnp:1eacac43c9327c4cb3cbca060094d2d32117e9cf"],
        ["@babel/register", "pnp:212ab889e0e907ad9de719031b4506871141fc58"],
        ["@quase/eslint-config-base", "pnp:0c89c1675497b0fec2ce71c0ceba145f497433f4"],
        ["@types/node", "12.0.8"],
        ["@typescript-eslint/eslint-plugin", "pnp:28e2761177fbb5133e7217e1b5aeeace3a6a060d"],
        ["@typescript-eslint/parser", "pnp:18d8d3ba6429cc0d314ad81dd2ee9403bb325efd"],
        ["babel-eslint", "pnp:40297bf345c2c41dbcbee7fd39cbf070f3594b60"],
        ["babel-helper-evaluate-path", "0.5.0"],
        ["babel-jest", "pnp:79a1891facb0f591b6362a15e98a77287a6e39bf"],
        ["eslint", "5.16.0"],
        ["eslint-import-resolver-node", "0.3.2"],
        ["eslint-import-resolver-typescript", "pnp:6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d"],
        ["eslint-plugin-flowtype", "pnp:b20d52d1b63fe4d37c11acdb1befff790dd9c0c8"],
        ["eslint-plugin-import", "pnp:e13d44595399586b5a77811b3bc990943932eacf"],
        ["eslint-plugin-jest", "pnp:c895d8e50ffed0a846dcd923855078bfa566d5f7"],
        ["eslint-plugin-node", "pnp:0002cdcd4b4ece9dc23f69137327ea828b6e2a0b"],
        ["execa", "1.0.0"],
        ["flow-bin", "0.88.0"],
        ["fs-extra", "7.0.1"],
        ["jest", "24.8.0"],
        ["prepend-file", "1.3.1"],
        ["resolve", "1.11.0"],
        ["ts-pnp", "pnp:fd6678ea8eedcc24dee2638388893d42f3dbc358"],
        ["typescript", "3.5.2"],
        ["@quase/builder", "0.1.0"],
        ["@quase/cli", "0.4.0-0"],
        ["@quase/config", "0.2.0-0"],
        ["@quase/error", "0.1.0-0"],
        ["@quase/cacheable-fs", "0.1.0-0"],
        ["@quase/find-files", "0.1.0-0"],
        ["@quase/parser", "0.1.0-0"],
        ["@quase/lang", "0.1.0-0"],
        ["@quase/package-manager", "0.1.0-0"],
        ["@quase/path-url", "0.2.0-0"],
        ["@quase/pathname", "0.1.0-0"],
        ["@quase/publisher", "0.1.0-0"],
        ["@quase/schema", "0.1.0-0"],
        ["@quase/source-map", "0.2.0-0"],
        ["@quase/unit", "0.1.0-0"],
        ["@quase/get-plugins", "0.1.0-0"],
        ["@quase/view", "pnp:f6c2e49fe52de5adc21cf52765acc9aa2dc1178b"],
      ]),
    }],
  ])],
]);

let locatorsByLocations = new Map([
  ["./.pnp/externals/pnp-ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5/node_modules/@babel/preset-typescript/", blacklistedLocator],
  ["./.pnp/externals/pnp-c9bc4575bb4c144ef417ebbafd47b3b8295af064/node_modules/@babel/plugin-proposal-async-generator-functions/", blacklistedLocator],
  ["./.pnp/externals/pnp-68ec4f6bc76d657bdeb2cc59bd8137cc968fe627/node_modules/@babel/plugin-proposal-json-strings/", blacklistedLocator],
  ["./.pnp/externals/pnp-d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2/node_modules/@babel/plugin-proposal-optional-catch-binding/", blacklistedLocator],
  ["./.pnp/externals/pnp-2dc40106cf8fd126426ad6195234ec72dbcfaf39/node_modules/@babel/plugin-syntax-async-generators/", blacklistedLocator],
  ["./.pnp/externals/pnp-3fce135b2c9687a3ba481074ff3a21fb1421630c/node_modules/@babel/plugin-syntax-json-strings/", blacklistedLocator],
  ["./.pnp/externals/pnp-f21c2711308277c29808d40b71d3469926161e85/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-225721100e9193a34544da90564940816d04a0f3/node_modules/@babel/plugin-syntax-optional-catch-binding/", blacklistedLocator],
  ["./.pnp/externals/pnp-705e525ab6be3fa50fb9ef4e48cf128f32a3cc22/node_modules/@babel/plugin-transform-arrow-functions/", blacklistedLocator],
  ["./.pnp/externals/pnp-b8d36a0e178b88992b847671a432a570de7b2a01/node_modules/@babel/plugin-transform-block-scoped-functions/", blacklistedLocator],
  ["./.pnp/externals/pnp-7833a827b64ccae1f1110308a462b3cecb5f9e99/node_modules/@babel/plugin-transform-computed-properties/", blacklistedLocator],
  ["./.pnp/externals/pnp-2c1efb2908ba15d96fa6c471d52e1c06e6a35136/node_modules/@babel/plugin-transform-duplicate-keys/", blacklistedLocator],
  ["./.pnp/externals/pnp-f4ed7a7493b7db746c46fd71274457a6b37dacf8/node_modules/@babel/plugin-transform-exponentiation-operator/", blacklistedLocator],
  ["./.pnp/externals/pnp-928eb25abee04aa2ef762c675400efb2058f9313/node_modules/@babel/plugin-transform-literals/", blacklistedLocator],
  ["./.pnp/externals/pnp-706179cadfc9260a128e03f81f4b6e353114732a/node_modules/@babel/plugin-transform-modules-amd/", blacklistedLocator],
  ["./.pnp/externals/pnp-07b0af85a2cecc3ce69934c8ce0f82220a29e1df/node_modules/@babel/plugin-transform-modules-umd/", blacklistedLocator],
  ["./.pnp/externals/pnp-3ce0792a866dfb9f9666453725275d742cb07516/node_modules/@babel/plugin-transform-object-super/", blacklistedLocator],
  ["./.pnp/externals/pnp-6706f7f88678021374b6601dff1304cc39f28df2/node_modules/@babel/plugin-transform-shorthand-properties/", blacklistedLocator],
  ["./.pnp/externals/pnp-531a3ec66b00c112c32da4c3169cb60e29e256e0/node_modules/@babel/plugin-transform-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-d0e0051d5601f7731706c6a83567ab381606682d/node_modules/@babel/plugin-transform-sticky-regex/", blacklistedLocator],
  ["./.pnp/externals/pnp-15ab85d1e18ca8a2f7e59e350db294bf7f835467/node_modules/@babel/plugin-transform-typeof-symbol/", blacklistedLocator],
  ["./.pnp/externals/pnp-4ecc4075f1b85e42f60a92a519195c57adcaee37/node_modules/@babel/plugin-syntax-async-generators/", blacklistedLocator],
  ["./.pnp/externals/pnp-90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc/node_modules/@babel/plugin-syntax-json-strings/", blacklistedLocator],
  ["./.pnp/externals/pnp-aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1/node_modules/@babel/plugin-syntax-optional-catch-binding/", blacklistedLocator],
  ["./.pnp/externals/pnp-9f663b6856b348804c2c0c2434805caf61c6c3e2/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-9b014519ce8c6df6754c3598b7e86ae703bf63ce/node_modules/@babel/cli/", blacklistedLocator],
  ["./.pnp/externals/pnp-12d0714a6c937f322d9609379be0e61c73ed8931/node_modules/@babel/node/", blacklistedLocator],
  ["./.pnp/externals/pnp-14724cda3c3ac650e41a80edd910cdecbe601f04/node_modules/@babel/plugin-proposal-class-properties/", blacklistedLocator],
  ["./.pnp/externals/pnp-a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75/node_modules/@babel/plugin-proposal-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-0fcb8a86302027dee988c72e7fda9a303025484a/node_modules/@babel/preset-env/", blacklistedLocator],
  ["./.pnp/externals/pnp-d4afbbd6215b1993d05095efb590984f9b6a3a02/node_modules/@babel/preset-flow/", blacklistedLocator],
  ["./.pnp/externals/pnp-1eacac43c9327c4cb3cbca060094d2d32117e9cf/node_modules/@babel/preset-typescript/", blacklistedLocator],
  ["./.pnp/externals/pnp-212ab889e0e907ad9de719031b4506871141fc58/node_modules/@babel/register/", blacklistedLocator],
  ["./.pnp/externals/pnp-0c89c1675497b0fec2ce71c0ceba145f497433f4/node_modules/@quase/eslint-config-base/", blacklistedLocator],
  ["./.pnp/externals/pnp-28e2761177fbb5133e7217e1b5aeeace3a6a060d/node_modules/@typescript-eslint/eslint-plugin/", blacklistedLocator],
  ["./.pnp/externals/pnp-18d8d3ba6429cc0d314ad81dd2ee9403bb325efd/node_modules/@typescript-eslint/parser/", blacklistedLocator],
  ["./.pnp/externals/pnp-40297bf345c2c41dbcbee7fd39cbf070f3594b60/node_modules/babel-eslint/", blacklistedLocator],
  ["./.pnp/externals/pnp-79a1891facb0f591b6362a15e98a77287a6e39bf/node_modules/babel-jest/", blacklistedLocator],
  ["./.pnp/externals/pnp-6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d/node_modules/eslint-import-resolver-typescript/", blacklistedLocator],
  ["./.pnp/externals/pnp-b20d52d1b63fe4d37c11acdb1befff790dd9c0c8/node_modules/eslint-plugin-flowtype/", blacklistedLocator],
  ["./.pnp/externals/pnp-e13d44595399586b5a77811b3bc990943932eacf/node_modules/eslint-plugin-import/", blacklistedLocator],
  ["./.pnp/externals/pnp-c895d8e50ffed0a846dcd923855078bfa566d5f7/node_modules/eslint-plugin-jest/", blacklistedLocator],
  ["./.pnp/externals/pnp-0002cdcd4b4ece9dc23f69137327ea828b6e2a0b/node_modules/eslint-plugin-node/", blacklistedLocator],
  ["./.pnp/externals/pnp-fd6678ea8eedcc24dee2638388893d42f3dbc358/node_modules/ts-pnp/", blacklistedLocator],
  ["./.pnp/workspaces/pnp-f6c2e49fe52de5adc21cf52765acc9aa2dc1178b/@quase/view/", blacklistedLocator],
  ["./.pnp/externals/pnp-b48ed82b04ffd88ec843040b4a109a32fe4380e0/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-0fcba5ab8fb387ed9474092e019695c05c2078d1/node_modules/@babel/plugin-proposal-async-generator-functions/", blacklistedLocator],
  ["./.pnp/externals/pnp-e6558ae27eed106acc73f522796abf89e5cc93f6/node_modules/@babel/plugin-proposal-json-strings/", blacklistedLocator],
  ["./.pnp/externals/pnp-d21a38d0695bb92bc896c7afeebcfc9e3c3a1464/node_modules/@babel/plugin-proposal-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-58301a8687a35c191f6b7ba378cc2feb3e9e8bd6/node_modules/@babel/plugin-proposal-optional-catch-binding/", blacklistedLocator],
  ["./.pnp/externals/pnp-bdb015bb034f3f82084dfacd1ba186a4212bc8c5/node_modules/@babel/plugin-syntax-async-generators/", blacklistedLocator],
  ["./.pnp/externals/pnp-87accb40ed4635b97081c874891070fcaea08d37/node_modules/@babel/plugin-syntax-json-strings/", blacklistedLocator],
  ["./.pnp/externals/pnp-04416ed1deece382c5ecb0ef2759dc1c8ea12290/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-17df0d674d7ac439f303b29abc0b89de84450201/node_modules/@babel/plugin-syntax-optional-catch-binding/", blacklistedLocator],
  ["./.pnp/externals/pnp-a81271c9accc4c94a60061b6c7d9ed4f566e633d/node_modules/@babel/plugin-transform-arrow-functions/", blacklistedLocator],
  ["./.pnp/externals/pnp-dba325a89899ca82a1bce94e52fe46c9eb3ef76c/node_modules/@babel/plugin-transform-block-scoped-functions/", blacklistedLocator],
  ["./.pnp/externals/pnp-cccec504e039f73d05407aac79b4545b3d9e0fee/node_modules/@babel/plugin-transform-computed-properties/", blacklistedLocator],
  ["./.pnp/externals/pnp-e104fc3b299ecc9e424fe88ef169be4ff387ea9a/node_modules/@babel/plugin-transform-duplicate-keys/", blacklistedLocator],
  ["./.pnp/externals/pnp-585f461e43b2ed57e91c98f770ce10675ca460a0/node_modules/@babel/plugin-transform-exponentiation-operator/", blacklistedLocator],
  ["./.pnp/externals/pnp-1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64/node_modules/@babel/plugin-transform-literals/", blacklistedLocator],
  ["./.pnp/externals/pnp-854ff2a92da13ec2571fd6ca44727c5f2a8e5114/node_modules/@babel/plugin-transform-modules-amd/", blacklistedLocator],
  ["./.pnp/externals/pnp-e8697c845c77d5331f239f35e71dff671d8b4313/node_modules/@babel/plugin-transform-modules-umd/", blacklistedLocator],
  ["./.pnp/externals/pnp-46b2e6e496c3be4ddf42cfd099550e51885f42a9/node_modules/@babel/plugin-transform-object-super/", blacklistedLocator],
  ["./.pnp/externals/pnp-25374ccf4f521bd0353762e978ad98015f7f6ede/node_modules/@babel/plugin-transform-shorthand-properties/", blacklistedLocator],
  ["./.pnp/externals/pnp-5caa1f0f3085d959c7ab13f26ee2ce823c67efdf/node_modules/@babel/plugin-transform-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-84785f3ae38278d5344c734e450ab8ee376a33e6/node_modules/@babel/plugin-transform-sticky-regex/", blacklistedLocator],
  ["./.pnp/externals/pnp-0723272ecac627bc84b814d76a18e1d861fb609f/node_modules/@babel/plugin-transform-typeof-symbol/", blacklistedLocator],
  ["./.pnp/externals/pnp-4b19e84a5869a0f9cae36be834eee07e4163a47f/node_modules/@babel/plugin-syntax-async-generators/", blacklistedLocator],
  ["./.pnp/externals/pnp-1fb25abe4c84fb26fe43937d800e625daaf09a5b/node_modules/@babel/plugin-syntax-json-strings/", blacklistedLocator],
  ["./.pnp/externals/pnp-289edf6f22f0e6a8c576348d7aceba28afb7ce12/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-9b1989a76a394312ba9c5025d05a2e9a7511be36/node_modules/@babel/plugin-syntax-optional-catch-binding/", blacklistedLocator],
  ["./.pnp/externals/pnp-00961244b9eda7fb07e72e2d480a765c28949f94/node_modules/eslint-plugin-es/", blacklistedLocator],
  ["./.pnp/externals/pnp-8bd157d24be50560e6bb5dca18f73efd37fd1706/node_modules/@typescript-eslint/experimental-utils/", blacklistedLocator],
  ["./.pnp/externals/pnp-0524386e850511b7227b8d994d2da21014039e65/node_modules/@typescript-eslint/experimental-utils/", blacklistedLocator],
  ["./.pnp/externals/pnp-02230c10914cd035a201a3903a61f186c4b9c0e8/node_modules/@babel/plugin-syntax-object-rest-spread/", blacklistedLocator],
  ["./.pnp/externals/pnp-5b31eb2e94d010ce3fe4ddb0e395dba114c98734/node_modules/eslint-plugin-es/", blacklistedLocator],
  ["./.pnp/externals/pnp-eacf3484420336f4c9cd37f3d25667fa873d1fba/node_modules/babel-jest/", blacklistedLocator],
  ["./packages/builder/", {"name":"@quase/builder","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-code-frame-7.0.0-06e2ab19bdb535385559aabb5ba59729482800f8/node_modules/@babel/code-frame/", {"name":"@babel/code-frame","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-highlight-7.0.0-f710c38c8d458e6dd9a201afb637fcb781ce99e4/node_modules/@babel/highlight/", {"name":"@babel/highlight","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chalk-2.4.2-cd42541677a54333cf541a49108c1432b44c9424/node_modules/chalk/", {"name":"chalk","reference":"2.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chalk-1.1.3-a8115c55e4a702fe4d150abd3872822a7e09fc98/node_modules/chalk/", {"name":"chalk","reference":"1.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-styles-3.2.1-41fbb20243e50b12be0f04b8dedbf07520ce841d/node_modules/ansi-styles/", {"name":"ansi-styles","reference":"3.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-styles-2.2.1-b432dd3358b634cf75e1e4664368240533c1ddbe/node_modules/ansi-styles/", {"name":"ansi-styles","reference":"2.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-color-convert-1.9.3-bb71850690e1f136567de629d2d5471deda4c1e8/node_modules/color-convert/", {"name":"color-convert","reference":"1.9.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-color-name-1.1.3-a7d0558bd89c42f795dd42328f740831ca53bc25/node_modules/color-name/", {"name":"color-name","reference":"1.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-escape-string-regexp-1.0.5-1b61c0562190a8dff6ae3bb2cf0200ca130b86d4/node_modules/escape-string-regexp/", {"name":"escape-string-regexp","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-supports-color-5.5.0-e2e69a44ac8772f78a1ec0b35b689df6530efc8f/node_modules/supports-color/", {"name":"supports-color","reference":"5.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-supports-color-2.0.0-535d045ce6b6363fa40117084629995e9df324c7/node_modules/supports-color/", {"name":"supports-color","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-supports-color-6.1.0-0764abc69c63d5ac842dd4867e8d025e880df8f3/node_modules/supports-color/", {"name":"supports-color","reference":"6.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-flag-3.0.0-b5d454dc2199ae225699f3467e5a07f3b955bafd/node_modules/has-flag/", {"name":"has-flag","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-flag-2.0.0-e8207af1cc7b30d446cc70b734b5e8be18f88d51/node_modules/has-flag/", {"name":"has-flag","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-esutils-2.0.2-0abf4f1caa5bcb1f7a9d8acc6dea4faaa04bac9b/node_modules/esutils/", {"name":"esutils","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-js-tokens-4.0.0-19203fb59991df98e3a287050d4647cdeaf32499/node_modules/js-tokens/", {"name":"js-tokens","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-core-7.4.0-248fd6874b7d755010bfe61f557461d4f446d9e9/node_modules/@babel/core/", {"name":"@babel/core","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-core-7.4.5-081f97e8ffca65a9b4b0fdc7e274e703f000c06a/node_modules/@babel/core/", {"name":"@babel/core","reference":"7.4.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-core-7.2.2-07adba6dde27bb5ad8d8672f15fde3e08184a687/node_modules/@babel/core/", {"name":"@babel/core","reference":"7.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-generator-7.4.0-c230e79589ae7a729fd4631b9ded4dc220418196/node_modules/@babel/generator/", {"name":"@babel/generator","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-generator-7.3.2-fff31a7b2f2f3dad23ef8e01be45b0d5c2fc0132/node_modules/@babel/generator/", {"name":"@babel/generator","reference":"7.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-generator-7.4.4-174a215eb843fc392c7edcaabeaa873de6e8f041/node_modules/@babel/generator/", {"name":"@babel/generator","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-types-7.4.0-670724f77d24cce6cc7d8cf64599d511d164894c/node_modules/@babel/types/", {"name":"@babel/types","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-types-7.3.2-424f5be4be633fff33fb83ab8d67e4a8290f5a2f/node_modules/@babel/types/", {"name":"@babel/types","reference":"7.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-types-7.4.4-8db9e9a629bb7c29370009b4b779ed93fe57d5f0/node_modules/@babel/types/", {"name":"@babel/types","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-4.17.11-b39ea6229ef607ecd89e2c8df12536891cac9b8d/node_modules/lodash/", {"name":"lodash","reference":"4.17.11"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-to-fast-properties-2.0.0-dc5e698cbd079265bc73e0377681a4e4e83f616e/node_modules/to-fast-properties/", {"name":"to-fast-properties","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsesc-2.5.2-80564d2e483dacf6e8ef209650a67df3f0c283a4/node_modules/jsesc/", {"name":"jsesc","reference":"2.5.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsesc-0.5.0-e7dee66e35d6fc16f710fe91d5cf69f70f08911d/node_modules/jsesc/", {"name":"jsesc","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-source-map-0.5.7-8a039d2d1021d22d1ea14c80d8ea468ba2ef3fcc/node_modules/source-map/", {"name":"source-map","reference":"0.5.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-source-map-0.8.0-beta.0-d4c1bb42c3f7ee925f005927ba10709e0d1d1f11/node_modules/source-map/", {"name":"source-map","reference":"0.8.0-beta.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-source-map-0.6.1-74722af32e9614e9c287a8d0bbde48b5e2f1a263/node_modules/source-map/", {"name":"source-map","reference":"0.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-trim-right-1.0.1-cb2e1203067e0c8de1f614094b9fe45704ea6003/node_modules/trim-right/", {"name":"trim-right","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helpers-7.4.2-3bdfa46a552ca77ef5a0f8551be5f0845ae989be/node_modules/@babel/helpers/", {"name":"@babel/helpers","reference":"7.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helpers-7.4.4-868b0ef59c1dd4e78744562d5ce1b59c89f2f2a5/node_modules/@babel/helpers/", {"name":"@babel/helpers","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helpers-7.3.1-949eec9ea4b45d3210feb7dc1c22db664c9e44b9/node_modules/@babel/helpers/", {"name":"@babel/helpers","reference":"7.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-template-7.4.0-12474e9c077bae585c5d835a95c0b0b790c25c8b/node_modules/@babel/template/", {"name":"@babel/template","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-template-7.2.2-005b3fdf0ed96e88041330379e0da9a708eb2907/node_modules/@babel/template/", {"name":"@babel/template","reference":"7.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-template-7.4.4-f4b88d1225689a08f5bc3a17483545be9e4ed237/node_modules/@babel/template/", {"name":"@babel/template","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-parser-7.4.2-b4521a400cb5a871eab3890787b4bc1326d38d91/node_modules/@babel/parser/", {"name":"@babel/parser","reference":"7.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-parser-7.3.2-95cdeddfc3992a6ca2a1315191c1679ca32c55cd/node_modules/@babel/parser/", {"name":"@babel/parser","reference":"7.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-parser-7.4.5-04af8d5d5a2b044a2a1bffacc1e5e6673544e872/node_modules/@babel/parser/", {"name":"@babel/parser","reference":"7.4.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-traverse-7.4.0-14006967dd1d2b3494cdd650c686db9daf0ddada/node_modules/@babel/traverse/", {"name":"@babel/traverse","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-traverse-7.2.3-7ff50cefa9c7c0bd2d81231fdac122f3957748d8/node_modules/@babel/traverse/", {"name":"@babel/traverse","reference":"7.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-traverse-7.4.5-4e92d1728fd2f1897dafdd321efbff92156c3216/node_modules/@babel/traverse/", {"name":"@babel/traverse","reference":"7.4.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-function-name-7.1.0-a0ceb01685f73355d4360c1247f582bfafc8ff53/node_modules/@babel/helper-function-name/", {"name":"@babel/helper-function-name","reference":"7.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-get-function-arity-7.0.0-83572d4320e2a4657263734113c42868b64e49c3/node_modules/@babel/helper-get-function-arity/", {"name":"@babel/helper-get-function-arity","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-split-export-declaration-7.4.0-571bfd52701f492920d63b7f735030e9a3e10b55/node_modules/@babel/helper-split-export-declaration/", {"name":"@babel/helper-split-export-declaration","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-split-export-declaration-7.0.0-3aae285c0311c2ab095d997b8c9a94cad547d813/node_modules/@babel/helper-split-export-declaration/", {"name":"@babel/helper-split-export-declaration","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-split-export-declaration-7.4.4-ff94894a340be78f53f06af038b205c49d993677/node_modules/@babel/helper-split-export-declaration/", {"name":"@babel/helper-split-export-declaration","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-debug-4.1.1-3b72260255109c6b589cee050f1d516139664791/node_modules/debug/", {"name":"debug","reference":"4.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-debug-2.6.9-5d128515df134ff327e90a4c93f4e077a536341f/node_modules/debug/", {"name":"debug","reference":"2.6.9"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-debug-3.1.0-5bb5a0672628b64149566ba16819e61518c67261/node_modules/debug/", {"name":"debug","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-debug-3.2.6-e83d17de16d8a7efb7717edbe5fb10135eee629b/node_modules/debug/", {"name":"debug","reference":"3.2.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ms-2.1.1-30a5864eb3ebb0a66f2ebe6d727af06a09d86e0a/node_modules/ms/", {"name":"ms","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ms-2.0.0-5608aeadfc00be6c2901df5f9861788de0d597c8/node_modules/ms/", {"name":"ms","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-globals-11.10.0-1e09776dffda5e01816b3bb4077c8b59c24eaa50/node_modules/globals/", {"name":"globals","reference":"11.10.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-convert-source-map-1.6.0-51b537a8c43e0f04dec1993bffcdd504e758ac20/node_modules/convert-source-map/", {"name":"convert-source-map","reference":"1.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-safe-buffer-5.1.2-991ec69d296e0313747d59bdfd2b745c35f8828d/node_modules/safe-buffer/", {"name":"safe-buffer","reference":"5.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json5-2.1.0-e7a0c62c48285c628d20a10b85c89bb807c32850/node_modules/json5/", {"name":"json5","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json5-1.0.1-779fb0018604fa854eacbf6252180d83543e3dbe/node_modules/json5/", {"name":"json5","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-minimist-1.2.0-a35008b20f41383eec1fb914f4cd5df79a264284/node_modules/minimist/", {"name":"minimist","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-minimist-0.0.8-857fcabfc3397d2625b8228262e86aa7a011b05d/node_modules/minimist/", {"name":"minimist","reference":"0.0.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-minimist-0.0.10-de3f98543dbf96082be48ad1a0c7cda836301dcf/node_modules/minimist/", {"name":"minimist","reference":"0.0.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-1.10.0-3bdaaeaf45cc07f375656dfd2e54ed0810b101ba/node_modules/resolve/", {"name":"resolve","reference":"1.10.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-1.11.0-4014870ba296176b86343d50b60f3b50609ce232/node_modules/resolve/", {"name":"resolve","reference":"1.11.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-1.1.7-203114d82ad2c5ed9e8e0411b3932875e889e97b/node_modules/resolve/", {"name":"resolve","reference":"1.1.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-parse-1.0.6-d62dbb5679405d72c4737ec58600e9ddcf06d24c/node_modules/path-parse/", {"name":"path-parse","reference":"1.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-semver-5.6.0-7e74256fbaa49c75aa7c7a205cc22799cac80004/node_modules/semver/", {"name":"semver","reference":"5.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-semver-5.7.0-790a7cf6fea5459bac96110b29b60412dc8ff96b/node_modules/semver/", {"name":"semver","reference":"5.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-semver-6.1.1-53f53da9b30b2103cd4f15eab3a18ecbcb210c9b/node_modules/semver/", {"name":"semver","reference":"6.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-semver-5.5.0-dc4bbc7a6ca9d916dee5d43516f0092b58f7b8ab/node_modules/semver/", {"name":"semver","reference":"5.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-module-imports-7.0.0-96081b7111e486da4d2cd971ad1a4fe216cc2e3d/node_modules/@babel/helper-module-imports/", {"name":"@babel/helper-module-imports","reference":"7.0.0"}],
  ["./packages/cli/", {"name":"@quase/cli","reference":"0.4.0-0"}],
  ["./packages/config/", {"name":"@quase/config","reference":"0.2.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-find-up-3.0.0-49169f1d7993430646da61ecc5ae355c21c97b73/node_modules/find-up/", {"name":"find-up","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-find-up-2.1.0-45d1b7e506c717ddd482775a2b77920a3c0c57a7/node_modules/find-up/", {"name":"find-up","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-find-up-1.1.2-6b2e9822b1a2ce0a60ab64d610eccad53cb24d0f/node_modules/find-up/", {"name":"find-up","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-locate-path-3.0.0-dbec3b3ab759758071b58fe59fc41871af21400e/node_modules/locate-path/", {"name":"locate-path","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-locate-path-2.0.0-2b568b265eec944c6d9c0de9c3dbbbca0354cd8e/node_modules/locate-path/", {"name":"locate-path","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-locate-3.0.0-322d69a05c0264b25997d9f40cd8a891ab0064a4/node_modules/p-locate/", {"name":"p-locate","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-locate-2.0.0-20a0103b222a70c8fd39cc2e580680f3dde5ec43/node_modules/p-locate/", {"name":"p-locate","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-limit-2.1.0-1d5a0d20fb12707c758a655f6bbc4386b5930d68/node_modules/p-limit/", {"name":"p-limit","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-limit-1.3.0-b86bd5f0c25690911c7590fcbfc2010d54b3ccb8/node_modules/p-limit/", {"name":"p-limit","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-try-2.0.0-85080bb87c64688fa47996fe8f7dfbe8211760b1/node_modules/p-try/", {"name":"p-try","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-try-1.0.0-cbc79cdbaf8fd4228e13f621f2b1a237c1b207b3/node_modules/p-try/", {"name":"p-try","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-exists-3.0.0-ce0ebeaa5f78cb18925ea7d810d7b59b010fd515/node_modules/path-exists/", {"name":"path-exists","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-exists-2.1.0-0feb6c64f0fc518d9a754dd5efb62c7022761f4b/node_modules/path-exists/", {"name":"path-exists","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pkg-conf-3.0.0-41f836458fb83b080e08e62b2d63a68aa8c436df/node_modules/pkg-conf/", {"name":"pkg-conf","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-5.2.0-1553627a18bf7b08cd7ec232d63981239085a578/node_modules/load-json-file/", {"name":"load-json-file","reference":"5.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-4.0.0-2f5f45ab91e33216234fd53adab668eb4ec0993b/node_modules/load-json-file/", {"name":"load-json-file","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-1.1.0-956905708d58b4bab4c2261b04f59f31c99374c0/node_modules/load-json-file/", {"name":"load-json-file","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-load-json-file-2.0.0-7947e42149af80d696cbf797bcaabcfe1fe29ca8/node_modules/load-json-file/", {"name":"load-json-file","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-graceful-fs-4.1.15-ffb703e1066e8a0eeaa4c8b80ba9253eeefbfb00/node_modules/graceful-fs/", {"name":"graceful-fs","reference":"4.1.15"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parse-json-4.0.0-be35f5425be1f7f6c747184f98a788cb99477ee0/node_modules/parse-json/", {"name":"parse-json","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parse-json-2.2.0-f480f40434ef80741f8469099f8dea18f55a4dc9/node_modules/parse-json/", {"name":"parse-json","reference":"2.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-error-ex-1.3.2-b4ac40648107fdcdcfae242f428bea8a14d4f1bf/node_modules/error-ex/", {"name":"error-ex","reference":"1.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-arrayish-0.2.1-77c99840527aa8ecb1a8ba697b80645a7a926a9d/node_modules/is-arrayish/", {"name":"is-arrayish","reference":"0.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json-parse-better-errors-1.0.2-bb867cfb3450e69107c131d1c514bab3dc8bcaa9/node_modules/json-parse-better-errors/", {"name":"json-parse-better-errors","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pify-3.0.0-e5a4acd2c101fdf3d9a4d07f0dbc4db49dd28176/node_modules/pify/", {"name":"pify","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pify-2.3.0-ed141a6ac043a849ea588498e7dca8b15330e90c/node_modules/pify/", {"name":"pify","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pify-4.0.1-4b2cd25c50d598735c50292224fd8c6df41e3231/node_modules/pify/", {"name":"pify","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-bom-3.0.0-2334c18e9c759f7bdd56fdef7e9ae3d588e68ed3/node_modules/strip-bom/", {"name":"strip-bom","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-bom-2.0.0-6219a85616520491f35788bdbf1447a99c7e6b0e/node_modules/strip-bom/", {"name":"strip-bom","reference":"2.0.0"}],
  ["./packages/schema/", {"name":"@quase/schema","reference":"0.1.0-0"}],
  ["./packages/languages/parser/", {"name":"@quase/parser","reference":"0.1.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-make-dir-1.3.0-79c1033b80515bd6d24ec9933e860ca75ee27f0c/node_modules/make-dir/", {"name":"make-dir","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-make-dir-2.1.0-5f0310e18b8be898cc07009295a30ae41e91e6f5/node_modules/make-dir/", {"name":"make-dir","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regexp-tree-0.0.86-ea4e26220eebad25313d6f4f19c23535cec86745/node_modules/regexp-tree/", {"name":"regexp-tree","reference":"0.0.86"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regexp-tree-0.1.1-27b455f9b138ca2e84c090e9aff1ffe2a04d97fa/node_modules/regexp-tree/", {"name":"regexp-tree","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regexp-tree-0.1.10-d837816a039c7af8a8d64d7a7c3cf6a1d93450bc/node_modules/regexp-tree/", {"name":"regexp-tree","reference":"0.1.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-table3-0.5.1-0252372d94dfc40dbd8df06005f48f31f656f202/node_modules/cli-table3/", {"name":"cli-table3","reference":"0.5.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-object-assign-4.1.1-2109adc7965887cfc05cbbd442cac8bfbb360863/node_modules/object-assign/", {"name":"object-assign","reference":"4.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-string-width-2.1.1-ab93f27a8dc13d28cac815c462143a6d9012ae9e/node_modules/string-width/", {"name":"string-width","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-string-width-1.0.2-118bdf5b8cdc51a2a7e70d211e07e2b0b9b107d3/node_modules/string-width/", {"name":"string-width","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-string-width-3.0.0-5a1690a57cc78211fffd9bf24bbe24d090604eb1/node_modules/string-width/", {"name":"string-width","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-fullwidth-code-point-2.0.0-a3b30a5c4f199183167aaab93beefae3ddfb654f/node_modules/is-fullwidth-code-point/", {"name":"is-fullwidth-code-point","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-fullwidth-code-point-1.0.0-ef9e31386f031a7f0d643af82fde50c457ef00cb/node_modules/is-fullwidth-code-point/", {"name":"is-fullwidth-code-point","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-4.0.0-a8479022eb1ac368a871389b635262c505ee368f/node_modules/strip-ansi/", {"name":"strip-ansi","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-3.0.1-6a385fb8853d952d5ff05d0e8aaf94278dc63dcf/node_modules/strip-ansi/", {"name":"strip-ansi","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-5.2.0-8c9a536feb6afc962bdfa5b104a5091c1ad9c0ae/node_modules/strip-ansi/", {"name":"strip-ansi","reference":"5.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-ansi-5.0.0-f78f68b5d0866c20b2c9b8c61b5298508dc8756f/node_modules/strip-ansi/", {"name":"strip-ansi","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-3.0.0-ed0317c322064f79466c02966bddb605ab37d998/node_modules/ansi-regex/", {"name":"ansi-regex","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-2.1.1-c3b33ab5ee360d86e0e628f0468ae7ef27d654df/node_modules/ansi-regex/", {"name":"ansi-regex","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-4.1.0-8b9f8f08cf1acb843756a839ca8c7e3168c51997/node_modules/ansi-regex/", {"name":"ansi-regex","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-regex-4.0.0-70de791edf021404c3fd615aa89118ae0432e5a9/node_modules/ansi-regex/", {"name":"ansi-regex","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-colors-1.3.3-39e005d546afe01e01f9c4ca8fa50f686a01205d/node_modules/colors/", {"name":"colors","reference":"1.3.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yargs-10.1.2-454d074c2b16a51a43e2fb7807e4f9de69ccb5c5/node_modules/yargs/", {"name":"yargs","reference":"10.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yargs-12.0.5-05f5997b609647b64f66b81e3b4b10a368e7ad13/node_modules/yargs/", {"name":"yargs","reference":"12.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cliui-4.1.0-348422dbe82d800b3022eef4f6ac10bf2e4d1b49/node_modules/cliui/", {"name":"cliui","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-wrap-ansi-2.1.0-d8fc3d284dd05794fe84973caecdd1cf824fdd85/node_modules/wrap-ansi/", {"name":"wrap-ansi","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-wrap-ansi-3.0.1-288a04d87eda5c286e060dfe8f135ce8d007f8ba/node_modules/wrap-ansi/", {"name":"wrap-ansi","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-code-point-at-1.1.0-0d070b4d043a5bea33a2f1a40e2edb3d9a4ccf77/node_modules/code-point-at/", {"name":"code-point-at","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-number-is-nan-1.0.1-097b602b53422a522c1afb8790318336941a011d/node_modules/number-is-nan/", {"name":"number-is-nan","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-decamelize-1.2.0-f6534d15148269b20352e7bee26f501f9a191290/node_modules/decamelize/", {"name":"decamelize","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-decamelize-3.1.1-ebf473c6f8607bd70fd9ed6d892da27c5eb8539e/node_modules/decamelize/", {"name":"decamelize","reference":"3.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-get-caller-file-1.0.3-f978fa4c90d1dfe7ff2d6beda2a515e713bdcf4a/node_modules/get-caller-file/", {"name":"get-caller-file","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-os-locale-2.1.0-42bc2900a6b5b8bd17376c8e882b65afccf24bf2/node_modules/os-locale/", {"name":"os-locale","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-os-locale-3.1.0-a802a6ee17f24c10483ab9935719cef4ed16bf1a/node_modules/os-locale/", {"name":"os-locale","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-execa-0.7.0-944becd34cc41ee32a63a9faf27ad5a65fc59777/node_modules/execa/", {"name":"execa","reference":"0.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-execa-1.0.0-c6236a5bb4df6d6f15e88e7f017798216749ddd8/node_modules/execa/", {"name":"execa","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cross-spawn-5.1.0-e8bd0efee58fcff6f8f94510a0a554bbfa235449/node_modules/cross-spawn/", {"name":"cross-spawn","reference":"5.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cross-spawn-6.0.5-4a5ec7c64dfae22c3a14124dbacdee846d80cbc4/node_modules/cross-spawn/", {"name":"cross-spawn","reference":"6.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lru-cache-4.1.5-8bbe50ea85bed59bc9e33dcab8235ee9bcf443cd/node_modules/lru-cache/", {"name":"lru-cache","reference":"4.1.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lru-cache-5.1.1-1da27e6710271947695daf6848e847f01d84b920/node_modules/lru-cache/", {"name":"lru-cache","reference":"5.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pseudomap-1.0.2-f052a28da70e618917ef0a8ac34c1ae5a68286b3/node_modules/pseudomap/", {"name":"pseudomap","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yallist-2.1.2-1c11f9218f076089a47dd512f93c6699a6a81d52/node_modules/yallist/", {"name":"yallist","reference":"2.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yallist-3.0.3-b4b049e314be545e3ce802236d6cd22cd91c3de9/node_modules/yallist/", {"name":"yallist","reference":"3.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-shebang-command-1.2.0-44aac65b695b03398968c39f363fee5deafdf1ea/node_modules/shebang-command/", {"name":"shebang-command","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-shebang-regex-1.0.0-da42f49740c0b42db2ca9728571cb190c98efea3/node_modules/shebang-regex/", {"name":"shebang-regex","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-which-1.3.1-a45043d54f5805316da8d62f9f50918d3da70b0a/node_modules/which/", {"name":"which","reference":"1.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isexe-2.0.0-e8fbf374dc556ff8947a10dcb0572d633f2cfa10/node_modules/isexe/", {"name":"isexe","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-get-stream-3.0.0-8e943d1358dc37555054ecbe2edb05aa174ede14/node_modules/get-stream/", {"name":"get-stream","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-get-stream-4.1.0-c1b255575f3dc21d59bfc79cd3d2b46b1c3a54b5/node_modules/get-stream/", {"name":"get-stream","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-stream-1.1.0-12d4a3dd4e68e0b79ceb8dbc84173ae80d91ca44/node_modules/is-stream/", {"name":"is-stream","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-run-path-2.0.2-35a9232dfa35d7067b4cb2ddf2357b1871536c5f/node_modules/npm-run-path/", {"name":"npm-run-path","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-key-2.0.1-411cadb574c5a140d3a4b1910d40d80cc9f40b40/node_modules/path-key/", {"name":"path-key","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-finally-1.0.0-3fbcfb15b899a44123b34b6dcc18b724336a2cae/node_modules/p-finally/", {"name":"p-finally","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-signal-exit-3.0.2-b5fdc08f1287ea1178628e415e25132b73646c6d/node_modules/signal-exit/", {"name":"signal-exit","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-eof-1.0.0-bb43ff5598a6eb05d89b59fcd129c983313606bf/node_modules/strip-eof/", {"name":"strip-eof","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lcid-1.0.0-308accafa0bc483a3867b4b6f2b9506251d1b835/node_modules/lcid/", {"name":"lcid","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lcid-2.0.0-6ef5d2df60e52f82eb228a4c373e8d1f397253cf/node_modules/lcid/", {"name":"lcid","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-invert-kv-1.0.0-104a8e4aaca6d3d8cd157a8ef8bfab2d7a3ffdb6/node_modules/invert-kv/", {"name":"invert-kv","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-invert-kv-2.0.0-7393f5afa59ec9ff5f67a27620d11c226e3eec02/node_modules/invert-kv/", {"name":"invert-kv","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mem-1.1.0-5edd52b485ca1d900fe64895505399a0dfa45f76/node_modules/mem/", {"name":"mem","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mem-4.1.0-aeb9be2d21f47e78af29e4ac5978e8afa2ca5b8a/node_modules/mem/", {"name":"mem","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mimic-fn-1.2.0-820c86a39334640e99516928bd03fca88057d022/node_modules/mimic-fn/", {"name":"mimic-fn","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-require-directory-2.1.1-8c64ad5fd30dab1c976e2344ffe7f792a6a6df42/node_modules/require-directory/", {"name":"require-directory","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-require-main-filename-1.0.1-97f717b69d48784f5f526a6c5aa8ffdda055a4d1/node_modules/require-main-filename/", {"name":"require-main-filename","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-set-blocking-2.0.0-045f9782d011ae9a6803ddd382b24392b3d890f7/node_modules/set-blocking/", {"name":"set-blocking","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-which-module-2.0.0-d9ef07dce77b9902b8a3a8fa4b31c3e3f7e6e87a/node_modules/which-module/", {"name":"which-module","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-y18n-3.2.1-6d15fba884c08679c0d77e88e7759e811e07fa41/node_modules/y18n/", {"name":"y18n","reference":"3.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-y18n-4.0.0-95ef94f85ecc81d007c264e190a120f0a3c8566b/node_modules/y18n/", {"name":"y18n","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yargs-parser-8.1.0-f1376a33b6629a5d063782944da732631e966950/node_modules/yargs-parser/", {"name":"yargs-parser","reference":"8.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yargs-parser-13.0.0-3fc44f3e76a8bdb1cc3602e860108602e5ccde8b/node_modules/yargs-parser/", {"name":"yargs-parser","reference":"13.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-yargs-parser-11.1.1-879a0865973bca9f6bab5cbdf3b1c67ec7d3bcf4/node_modules/yargs-parser/", {"name":"yargs-parser","reference":"11.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-4.1.0-d545635be1e33c542649c69173e5de6acfae34dd/node_modules/camelcase/", {"name":"camelcase","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-5.2.0-e7522abda5ed94cc0489e1b8466610e88404cf45/node_modules/camelcase/", {"name":"camelcase","reference":"5.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-5.0.0-03295527d58bd3cd4aa75363f35b2e8d97be2f42/node_modules/camelcase/", {"name":"camelcase","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-2.1.1-7c1d16d679a1bbe59ca02cacecfb011e201f5a1f/node_modules/camelcase/", {"name":"camelcase","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@sindresorhus-is-0.15.0-96915baa05e6a6a1d137badf4984d3fc05820bb6/node_modules/@sindresorhus/is/", {"name":"@sindresorhus/is","reference":"0.15.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@sindresorhus-is-0.7.0-9a06f4f137ee84d7df0460c1fdb1135ffa6c50fd/node_modules/@sindresorhus/is/", {"name":"@sindresorhus/is","reference":"0.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@sindresorhus-is-0.14.0-9fb3a3cf3132328151f353de4632e01e52102bea/node_modules/@sindresorhus/is/", {"name":"@sindresorhus/is","reference":"0.14.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-xregexp-4.2.4-02a4aea056d65a42632c02f0233eab8e4d7e57ed/node_modules/xregexp/", {"name":"xregexp","reference":"4.2.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-runtime-corejs2-7.4.2-a0cec2c41717fa415e9c204f32b603d88b1796c2/node_modules/@babel/runtime-corejs2/", {"name":"@babel/runtime-corejs2","reference":"7.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-js-2.6.5-44bc8d249e7fb2ff5d00e0341a7ffb94fbf67895/node_modules/core-js/", {"name":"core-js","reference":"2.6.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-js-3.0.0-a8dbfa978d29bfc263bfb66c556d0ca924c28957/node_modules/core-js/", {"name":"core-js","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-js-2.6.4-b8897c062c4d769dd30a0ac5c73976c47f92ea0d/node_modules/core-js/", {"name":"core-js","reference":"2.6.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-runtime-0.13.2-32e59c9a6fb9b1a4aff09b4930ca2d4477343447/node_modules/regenerator-runtime/", {"name":"regenerator-runtime","reference":"0.13.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-runtime-0.12.1-fa1a71544764c036f8c49b13a08b2594c9f8a0de/node_modules/regenerator-runtime/", {"name":"regenerator-runtime","reference":"0.12.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-leven-2.1.0-c2e7a9f772094dee9d34202ae8acce4687875580/node_modules/leven/", {"name":"leven","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-turbocolor-2.6.1-1b47dcc0e0e5171f57d954351fb80a5088a8a921/node_modules/turbocolor/", {"name":"turbocolor","reference":"2.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-keys-5.0.0-67250d1d2e6617ed0568463e56fa337845706695/node_modules/camelcase-keys/", {"name":"camelcase-keys","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-camelcase-keys-2.1.0-308beeaffdf28119051efa1d932213c91b8f92e7/node_modules/camelcase-keys/", {"name":"camelcase-keys","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-map-obj-3.0.0-4221cc62360f88c0735f9e7c0813bd889657f490/node_modules/map-obj/", {"name":"map-obj","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-map-obj-1.0.1-d933ceb9205d82bdcf4886f6742bdc2b4dea146d/node_modules/map-obj/", {"name":"map-obj","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-quick-lru-1.1.0-4360b17c61136ad38078397ff11416e186dcfbb8/node_modules/quick-lru/", {"name":"quick-lru","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-yarn-2.0.0-11b77911708db3c5cccd07400537d9acab6131f1/node_modules/has-yarn/", {"name":"has-yarn","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-import-local-2.0.0-55070be38a5993cf18ef6db7e961f5bee5c5a09d/node_modules/import-local/", {"name":"import-local","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pkg-dir-3.0.0-2749020f239ed990881b1f71210d51eb6523bea3/node_modules/pkg-dir/", {"name":"pkg-dir","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pkg-dir-2.0.0-f6d5d1109e19d63edf428e0bd57e12777615334b/node_modules/pkg-dir/", {"name":"pkg-dir","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-cwd-2.0.0-00a9f7387556e27038eae232caa372a6a59b665a/node_modules/resolve-cwd/", {"name":"resolve-cwd","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-from-3.0.0-b22c7af7d9d6881bc8b6e653335eebcb0a188748/node_modules/resolve-from/", {"name":"resolve-from","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-from-5.0.0-c35225843df8f776df21c57557bc087e9dfdfc69/node_modules/resolve-from/", {"name":"resolve-from","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-from-4.0.0-4abcd852ad32dd7baabfe9b40e00a36db5f392e6/node_modules/resolve-from/", {"name":"resolve-from","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-installed-globally-0.1.0-0dfd98f5a9111716dd535dda6492f67bf3d25a80/node_modules/is-installed-globally/", {"name":"is-installed-globally","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-global-dirs-0.1.1-b319c0dd4607f353f3be9cca4c72fc148c49f445/node_modules/global-dirs/", {"name":"global-dirs","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ini-1.3.5-eee25f56db1c9ec6085e0c22778083f596abf927/node_modules/ini/", {"name":"ini","reference":"1.3.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-path-inside-1.0.1-8ef5b7de50437a3fdca6b4e865ef7aa55cb48036/node_modules/is-path-inside/", {"name":"is-path-inside","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-is-inside-1.0.2-365417dede44430d1c11af61027facf074bdfc53/node_modules/path-is-inside/", {"name":"path-is-inside","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-up-4.0.0-1b221c6088ba7799601c808f91161c66e58f8978/node_modules/read-pkg-up/", {"name":"read-pkg-up","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-up-1.0.1-9d63c13276c065918d57f002a57f40a1b643fb02/node_modules/read-pkg-up/", {"name":"read-pkg-up","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-up-2.0.0-6b72a8048984e0c41e79510fd5e9fa99b3b549be/node_modules/read-pkg-up/", {"name":"read-pkg-up","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-3.0.0-9cbc686978fee65d16c00e2b19c237fcf6e38389/node_modules/read-pkg/", {"name":"read-pkg","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-1.1.0-f5ffaa5ecd29cb31c0474bca7d756b6bb29e3f28/node_modules/read-pkg/", {"name":"read-pkg","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-4.0.1-963625378f3e1c4d48c85872b5a6ec7d5d093237/node_modules/read-pkg/", {"name":"read-pkg","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-5.0.0-75449907ece8dfb89cbc76adcba2665316e32b94/node_modules/read-pkg/", {"name":"read-pkg","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-read-pkg-2.0.0-8ef1c0623c6a6db0dc6713c4bfac46332b2368f8/node_modules/read-pkg/", {"name":"read-pkg","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-normalize-package-data-2.5.0-e66db1838b200c1dfc233225d12cb36520e234a8/node_modules/normalize-package-data/", {"name":"normalize-package-data","reference":"2.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-hosted-git-info-2.7.1-97f236977bd6e125408930ff6de3eec6281ec047/node_modules/hosted-git-info/", {"name":"hosted-git-info","reference":"2.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-validate-npm-package-license-3.0.4-fc91f6b9c7ba15c857f4cb2c5defeec39d4f410a/node_modules/validate-npm-package-license/", {"name":"validate-npm-package-license","reference":"3.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-spdx-correct-3.1.0-fb83e504445268f154b074e218c87c003cd31df4/node_modules/spdx-correct/", {"name":"spdx-correct","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-spdx-expression-parse-3.0.0-99e119b7a5da00e05491c9fa338b7904823b41d0/node_modules/spdx-expression-parse/", {"name":"spdx-expression-parse","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-spdx-exceptions-2.2.0-2ea450aee74f2a89bfb94519c07fcd6f41322977/node_modules/spdx-exceptions/", {"name":"spdx-exceptions","reference":"2.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-spdx-license-ids-3.0.3-81c0ce8f21474756148bbb5f3bfc0f36bf15d76e/node_modules/spdx-license-ids/", {"name":"spdx-license-ids","reference":"3.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-type-3.0.0-cef31dc8e0a1a3bb0d105c0cd97cf3bf47f4e36f/node_modules/path-type/", {"name":"path-type","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-type-1.1.0-59c44f7ee491da704da415da5a4070ba4f8fe441/node_modules/path-type/", {"name":"path-type","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-type-2.0.0-f012ccb8415b7096fc2daa1054c3d72389594c73/node_modules/path-type/", {"name":"path-type","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-redent-2.0.0-c1b2007b42d57eb1389079b3c8333639d5e1ccaa/node_modules/redent/", {"name":"redent","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-redent-1.0.0-cf916ab1fd5f1f16dfb20822dd6ec7f730c2afde/node_modules/redent/", {"name":"redent","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-indent-string-3.2.0-4a5fd6d27cc332f37e5419a504dbb837105c9289/node_modules/indent-string/", {"name":"indent-string","reference":"3.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-indent-string-2.1.0-8e2d48348742121b4a8218b7a137e9a52049dc80/node_modules/indent-string/", {"name":"indent-string","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-indent-2.0.0-5ef8db295d01e6ed6cbf7aab96998d7822527b68/node_modules/strip-indent/", {"name":"strip-indent","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-indent-1.0.1-0c7962a6adefa7bbd4ac366460a638552ae1a0a2/node_modules/strip-indent/", {"name":"strip-indent","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-trim-newlines-2.0.0-b403d0b91be50c331dfc4b82eeceb22c3de16d20/node_modules/trim-newlines/", {"name":"trim-newlines","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-trim-newlines-1.0.0-5887966bb582a4503a41eb524f7d35011815a613/node_modules/trim-newlines/", {"name":"trim-newlines","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-boxen-3.0.0-2e229f603c9c1da9d2966b7e9a5681eb692eca23/node_modules/boxen/", {"name":"boxen","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-boxen-1.3.0-55c6c39a8ba58d9c61ad22cd877532deb665a20b/node_modules/boxen/", {"name":"boxen","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-align-3.0.0-b536b371cf687caaef236c18d3e21fe3797467cb/node_modules/ansi-align/", {"name":"ansi-align","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-align-2.0.0-c36aeccba563b89ceb556f3690f0b1d9e3547f7f/node_modules/ansi-align/", {"name":"ansi-align","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-emoji-regex-7.0.3-933a04052860c85e83c122479c4748a8e4c72156/node_modules/emoji-regex/", {"name":"emoji-regex","reference":"7.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-boxes-2.0.0-de5eb5ce7462833133e85f5710fabb38377e9333/node_modules/cli-boxes/", {"name":"cli-boxes","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-boxes-1.0.0-4fa917c3e59c94a004cd61f8ee509da651687143/node_modules/cli-boxes/", {"name":"cli-boxes","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-term-size-1.2.0-458b83887f288fc56d6fffbfad262e26638efa69/node_modules/term-size/", {"name":"term-size","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-widest-line-2.0.1-7438764730ec7ef4381ce4df82fb98a53142a3fc/node_modules/widest-line/", {"name":"widest-line","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-update-notifier-2.5.0-d0744593e13f161e406acb1d9408b72cad08aff6/node_modules/update-notifier/", {"name":"update-notifier","reference":"2.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-configstore-3.1.2-c6f25defaeef26df12dd33414b001fe81a543f8f/node_modules/configstore/", {"name":"configstore","reference":"3.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-dot-prop-4.2.0-1f19e0c2e1aa0e32797c49799f2837ac6af69c57/node_modules/dot-prop/", {"name":"dot-prop","reference":"4.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-obj-1.0.1-3e4729ac1f5fde025cd7d83a896dab9f4f67db0f/node_modules/is-obj/", {"name":"is-obj","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unique-string-1.0.0-9e1057cca851abb93398f8b33ae187b99caec11a/node_modules/unique-string/", {"name":"unique-string","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-crypto-random-string-1.0.0-a230f64f568310e1498009940790ec99545bca7e/node_modules/crypto-random-string/", {"name":"crypto-random-string","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-write-file-atomic-2.4.2-a7181706dfba17855d221140a9c06e15fcdd87b9/node_modules/write-file-atomic/", {"name":"write-file-atomic","reference":"2.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-write-file-atomic-2.4.1-d0b05463c188ae804396fd5ab2a370062af87529/node_modules/write-file-atomic/", {"name":"write-file-atomic","reference":"2.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-imurmurhash-0.1.4-9218b9b2b928a238b13dc4fb6b6d576f231453ea/node_modules/imurmurhash/", {"name":"imurmurhash","reference":"0.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-xdg-basedir-3.0.0-496b2cc109eca8dbacfe2dc72b603c17c5870ad4/node_modules/xdg-basedir/", {"name":"xdg-basedir","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-import-lazy-2.1.0-05698e3d45c88e8d7e9d92cb0584e77f096f3e43/node_modules/import-lazy/", {"name":"import-lazy","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-import-lazy-4.0.0-e8eb627483a0a43da3c03f3e35548be5cb0cc153/node_modules/import-lazy/", {"name":"import-lazy","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-ci-1.2.1-e3779c8ee17fccf428488f6e281187f2e632841c/node_modules/is-ci/", {"name":"is-ci","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-ci-2.0.0-6bc6334181810e04b5c22b3d589fdca55026404c/node_modules/is-ci/", {"name":"is-ci","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ci-info-1.6.0-2ca20dbb9ceb32d4524a683303313f0304b1e497/node_modules/ci-info/", {"name":"ci-info","reference":"1.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ci-info-2.0.0-67a9e964be31a51e15e5010d58e6f12834002f46/node_modules/ci-info/", {"name":"ci-info","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-npm-1.0.0-f2fb63a65e4905b406c86072765a1a4dc793b9f4/node_modules/is-npm/", {"name":"is-npm","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-latest-version-3.1.0-a205383fea322b33b5ae3b18abee0dc2f356ee15/node_modules/latest-version/", {"name":"latest-version","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-latest-version-4.0.0-9542393ac55a585861a4c4ebc02389a0b4a9c332/node_modules/latest-version/", {"name":"latest-version","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-package-json-4.0.1-8869a0401253661c4c4ca3da6c2121ed555f5eed/node_modules/package-json/", {"name":"package-json","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-package-json-5.0.0-a7dbe2725edcc7dc9bcee627672275e323882433/node_modules/package-json/", {"name":"package-json","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-got-6.7.1-240cd05785a9a18e561dc1b44b41c763ef1e8db0/node_modules/got/", {"name":"got","reference":"6.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-got-8.3.2-1d23f64390e97f776cac52e5b936e5f514d2e937/node_modules/got/", {"name":"got","reference":"8.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-got-9.6.0-edf45e7d67f99545705de1f7bbeeeb121765ed85/node_modules/got/", {"name":"got","reference":"9.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-create-error-class-3.0.2-06be7abef947a3f14a30fd610671d401bca8b7b6/node_modules/create-error-class/", {"name":"create-error-class","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-capture-stack-trace-1.0.1-a6c0bbe1f38f3aa0b92238ecb6ff42c344d4135d/node_modules/capture-stack-trace/", {"name":"capture-stack-trace","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-duplexer3-0.1.4-ee01dd1cac0ed3cbc7fdbea37dc0a8f1ce002ce2/node_modules/duplexer3/", {"name":"duplexer3","reference":"0.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-redirect-1.0.0-1d03dded53bd8db0f30c26e4f95d36fc7c87dc24/node_modules/is-redirect/", {"name":"is-redirect","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-retry-allowed-1.1.0-11a060568b67339444033d0125a61a20d564fb34/node_modules/is-retry-allowed/", {"name":"is-retry-allowed","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lowercase-keys-1.0.1-6f9e30b47084d971a7c820ff15a6c5167b74c26f/node_modules/lowercase-keys/", {"name":"lowercase-keys","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lowercase-keys-1.0.0-4e3366b39e7f5457e35f1324bdf6f88d0bfc7306/node_modules/lowercase-keys/", {"name":"lowercase-keys","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-timed-out-4.0.1-f32eacac5a175bea25d7fab565ab3ed8741ef56f/node_modules/timed-out/", {"name":"timed-out","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unzip-response-2.0.1-d2f0f737d16b0615e72a6935ed04214572d56f97/node_modules/unzip-response/", {"name":"unzip-response","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-url-parse-lax-1.0.0-7af8f303645e9bd79a272e7a14ac68bc0609da73/node_modules/url-parse-lax/", {"name":"url-parse-lax","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-url-parse-lax-3.0.0-16b5cafc07dbe3676c1b1999177823d6503acb0c/node_modules/url-parse-lax/", {"name":"url-parse-lax","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-prepend-http-1.0.4-d4f4562b0ce3696e41ac52d0e002e57a635dc6dc/node_modules/prepend-http/", {"name":"prepend-http","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-prepend-http-2.0.0-e92434bfa5ea8c19f41cdfd401d741a3c819d897/node_modules/prepend-http/", {"name":"prepend-http","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-registry-auth-token-3.4.0-d7446815433f5d5ed6431cd5dca21048f66b397e/node_modules/registry-auth-token/", {"name":"registry-auth-token","reference":"3.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rc-1.2.8-cd924bf5200a075b83c188cd6b9e211b7fc0d3ed/node_modules/rc/", {"name":"rc","reference":"1.2.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-deep-extend-0.6.0-c4fa7c95404a17a9c3e8ca7e1537312b736330ac/node_modules/deep-extend/", {"name":"deep-extend","reference":"0.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strip-json-comments-2.0.1-3c531942e908c2697c0ec344858c286c7ca0a60a/node_modules/strip-json-comments/", {"name":"strip-json-comments","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-registry-url-3.1.0-3d4ef870f73dde1d77f0cf9a381432444e174942/node_modules/registry-url/", {"name":"registry-url","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-registry-url-4.0.0-7dc344ef0f1496fc95a6ad04ccb9a491df11c025/node_modules/registry-url/", {"name":"registry-url","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-semver-diff-2.1.0-4bbb8437c8d37e4b0cf1a68fd726ec6d645d6d36/node_modules/semver-diff/", {"name":"semver-diff","reference":"2.1.0"}],
  ["./packages/util/get-plugins/", {"name":"@quase/get-plugins","reference":"0.1.0-0"}],
  ["./packages/source-map/", {"name":"@quase/source-map","reference":"0.2.0-0"}],
  ["./packages/path-url/", {"name":"@quase/path-url","reference":"0.2.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@quase-path-url-0.1.0-42383ce0987748aee8291a3ddee2289a4734e036/node_modules/@quase/path-url/", {"name":"@quase/path-url","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-file-url-3.0.0-247a586a746ce9f7a8ed05560290968afc262a77/node_modules/file-url/", {"name":"file-url","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-file-url-2.0.2-e951784d79095127d3713029ab063f40818ca2ae/node_modules/file-url/", {"name":"file-url","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-url-superb-3.0.0-b9a1da878a1ac73659047d1e6f4ef22c209d3e25/node_modules/is-url-superb/", {"name":"is-url-superb","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-url-superb-2.0.0-b728a18cf692e4d16da6b94c7408a811db0d0492/node_modules/is-url-superb/", {"name":"is-url-superb","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-url-regex-5.0.0-8f5456ab83d898d18b2f91753a702649b873273a/node_modules/url-regex/", {"name":"url-regex","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-url-regex-3.2.0-dbad1e0c9e29e105dd0b1f09f6862f7fdb482724/node_modules/url-regex/", {"name":"url-regex","reference":"3.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ip-regex-4.1.0-5ad62f685a14edb421abebc2fff8db94df67b455/node_modules/ip-regex/", {"name":"ip-regex","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ip-regex-1.0.3-dc589076f659f419c222039a33316f1c7387effd/node_modules/ip-regex/", {"name":"ip-regex","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ip-regex-2.1.0-fa78bf5d2e6913c911ce9f819ee5146bb6d844e9/node_modules/ip-regex/", {"name":"ip-regex","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tlds-1.203.1-4dc9b02f53de3315bc98b80665e13de3edfc1dfc/node_modules/tlds/", {"name":"tlds","reference":"1.203.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-slash-3.0.0-6539be870c165adbd5240220dbe361f1bc4d4634/node_modules/slash/", {"name":"slash","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-slash-1.0.0-c41f2f6c39fc16d1cd17ad4b5d896114ae470d55/node_modules/slash/", {"name":"slash","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-slash-2.0.0-de552851a1759df3a8f206535442f5ec4ddeab44/node_modules/slash/", {"name":"slash","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-url-7.0.0-fde926fa54a599f3adf82dff25a9f7be02dc6edd/node_modules/whatwg-url/", {"name":"whatwg-url","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-url-6.5.0-f2df02bff176fd65070df74ad5ccbb5a199965a8/node_modules/whatwg-url/", {"name":"whatwg-url","reference":"6.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-sortby-4.7.0-edd14c824e2cc9c1e0b0a1b42bb5210516a42438/node_modules/lodash.sortby/", {"name":"lodash.sortby","reference":"4.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tr46-1.0.1-a8b13fd6bfd2489519674ccde55ba3693b706d09/node_modules/tr46/", {"name":"tr46","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-punycode-2.1.1-b58b010ac40c22c5657616c8d2c2c02c7bf479ec/node_modules/punycode/", {"name":"punycode","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-punycode-1.4.1-c0d5a63b2718800ad8e1eb0fa5269c84dd41845e/node_modules/punycode/", {"name":"punycode","reference":"1.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-webidl-conversions-4.0.2-a855980b1f0b6b359ba1d5d9fb39ae941faa63ad/node_modules/webidl-conversions/", {"name":"webidl-conversions","reference":"4.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fs-extra-7.0.1-4f189c44aa123b895f722804f55ea23eadc348e9/node_modules/fs-extra/", {"name":"fs-extra","reference":"7.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fs-extra-5.0.0-414d0110cdd06705734d055652c5411260c31abd/node_modules/fs-extra/", {"name":"fs-extra","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsonfile-4.0.0-8771aae0799b64076b76640fca058f9c10e33ecb/node_modules/jsonfile/", {"name":"jsonfile","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-universalify-0.1.2-b646f69be3942dabcecc9d6639c80dc105efaa66/node_modules/universalify/", {"name":"universalify","reference":"0.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-preset-minify-0.5.0-e25bb8d3590087af02b650967159a77c19bfb96b/node_modules/babel-preset-minify/", {"name":"babel-preset-minify","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-builtins-0.5.0-31eb82ed1a0d0efdc31312f93b6e4741ce82c36b/node_modules/babel-plugin-minify-builtins/", {"name":"babel-plugin-minify-builtins","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-constant-folding-0.5.0-f84bc8dbf6a561e5e350ff95ae216b0ad5515b6e/node_modules/babel-plugin-minify-constant-folding/", {"name":"babel-plugin-minify-constant-folding","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-evaluate-path-0.5.0-a62fa9c4e64ff7ea5cea9353174ef023a900a67c/node_modules/babel-helper-evaluate-path/", {"name":"babel-helper-evaluate-path","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-dead-code-elimination-0.5.0-d23ef5445238ad06e8addf5c1cf6aec835bcda87/node_modules/babel-plugin-minify-dead-code-elimination/", {"name":"babel-plugin-minify-dead-code-elimination","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-mark-eval-scopes-0.4.3-d244a3bef9844872603ffb46e22ce8acdf551562/node_modules/babel-helper-mark-eval-scopes/", {"name":"babel-helper-mark-eval-scopes","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-remove-or-void-0.4.3-a4f03b40077a0ffe88e45d07010dee241ff5ae60/node_modules/babel-helper-remove-or-void/", {"name":"babel-helper-remove-or-void","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-some-4.6.0-1bb9f314ef6b8baded13b549169b2a945eb68e4d/node_modules/lodash.some/", {"name":"lodash.some","reference":"4.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-flip-comparisons-0.4.3-00ca870cb8f13b45c038b3c1ebc0f227293c965a/node_modules/babel-plugin-minify-flip-comparisons/", {"name":"babel-plugin-minify-flip-comparisons","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-is-void-0-0.4.3-7d9c01b4561e7b95dbda0f6eee48f5b60e67313e/node_modules/babel-helper-is-void-0/", {"name":"babel-helper-is-void-0","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-guarded-expressions-0.4.3-cc709b4453fd21b1f302877444c89f88427ce397/node_modules/babel-plugin-minify-guarded-expressions/", {"name":"babel-plugin-minify-guarded-expressions","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-flip-expressions-0.4.3-3696736a128ac18bc25254b5f40a22ceb3c1d3fd/node_modules/babel-helper-flip-expressions/", {"name":"babel-helper-flip-expressions","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-infinity-0.4.3-dfb876a1b08a06576384ef3f92e653ba607b39ca/node_modules/babel-plugin-minify-infinity/", {"name":"babel-plugin-minify-infinity","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-mangle-names-0.5.0-bcddb507c91d2c99e138bd6b17a19c3c271e3fd3/node_modules/babel-plugin-minify-mangle-names/", {"name":"babel-plugin-minify-mangle-names","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-numeric-literals-0.4.3-8e4fd561c79f7801286ff60e8c5fd9deee93c0bc/node_modules/babel-plugin-minify-numeric-literals/", {"name":"babel-plugin-minify-numeric-literals","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-replace-0.5.0-d3e2c9946c9096c070efc96761ce288ec5c3f71c/node_modules/babel-plugin-minify-replace/", {"name":"babel-plugin-minify-replace","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-simplify-0.5.0-1f090018afb90d8b54d3d027fd8a4927f243da6f/node_modules/babel-plugin-minify-simplify/", {"name":"babel-plugin-minify-simplify","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-is-nodes-equiv-0.0.1-34e9b300b1479ddd98ec77ea0bbe9342dfe39684/node_modules/babel-helper-is-nodes-equiv/", {"name":"babel-helper-is-nodes-equiv","reference":"0.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-helper-to-multiple-sequence-expressions-0.5.0-a3f924e3561882d42fcf48907aa98f7979a4588d/node_modules/babel-helper-to-multiple-sequence-expressions/", {"name":"babel-helper-to-multiple-sequence-expressions","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-minify-type-constructors-0.4.3-1bc6f15b87f7ab1085d42b330b717657a2156500/node_modules/babel-plugin-minify-type-constructors/", {"name":"babel-plugin-minify-type-constructors","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-inline-consecutive-adds-0.4.3-323d47a3ea63a83a7ac3c811ae8e6941faf2b0d1/node_modules/babel-plugin-transform-inline-consecutive-adds/", {"name":"babel-plugin-transform-inline-consecutive-adds","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-member-expression-literals-6.9.4-37039c9a0c3313a39495faac2ff3a6b5b9d038bf/node_modules/babel-plugin-transform-member-expression-literals/", {"name":"babel-plugin-transform-member-expression-literals","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-merge-sibling-variables-6.9.4-85b422fc3377b449c9d1cde44087203532401dae/node_modules/babel-plugin-transform-merge-sibling-variables/", {"name":"babel-plugin-transform-merge-sibling-variables","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-minify-booleans-6.9.4-acbb3e56a3555dd23928e4b582d285162dd2b198/node_modules/babel-plugin-transform-minify-booleans/", {"name":"babel-plugin-transform-minify-booleans","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-property-literals-6.9.4-98c1d21e255736573f93ece54459f6ce24985d39/node_modules/babel-plugin-transform-property-literals/", {"name":"babel-plugin-transform-property-literals","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-regexp-constructors-0.4.3-58b7775b63afcf33328fae9a5f88fbd4fb0b4965/node_modules/babel-plugin-transform-regexp-constructors/", {"name":"babel-plugin-transform-regexp-constructors","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-remove-console-6.9.4-b980360c067384e24b357a588d807d3c83527780/node_modules/babel-plugin-transform-remove-console/", {"name":"babel-plugin-transform-remove-console","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-remove-debugger-6.9.4-42b727631c97978e1eb2d199a7aec84a18339ef2/node_modules/babel-plugin-transform-remove-debugger/", {"name":"babel-plugin-transform-remove-debugger","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-remove-undefined-0.5.0-80208b31225766c630c97fa2d288952056ea22dd/node_modules/babel-plugin-transform-remove-undefined/", {"name":"babel-plugin-transform-remove-undefined","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-simplify-comparison-operators-6.9.4-f62afe096cab0e1f68a2d753fdf283888471ceb9/node_modules/babel-plugin-transform-simplify-comparison-operators/", {"name":"babel-plugin-transform-simplify-comparison-operators","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-transform-undefined-to-void-6.9.4-be241ca81404030678b748717322b89d0c8fe280/node_modules/babel-plugin-transform-undefined-to-void/", {"name":"babel-plugin-transform-undefined-to-void","reference":"6.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-isplainobject-4.0.6-7c526a52d89b45c45cc690b88163be0497f550cb/node_modules/lodash.isplainobject/", {"name":"lodash.isplainobject","reference":"4.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-colorette-1.0.8-421ff11c80b7414027ebed922396bc1833d1903c/node_modules/colorette/", {"name":"colorette","reference":"1.0.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-colorette-1.0.7-7adf43c445ee63a541b4a4aef7d13f03df1e0cc0/node_modules/colorette/", {"name":"colorette","reference":"1.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fswatcher-child-1.1.1-264dd95f9c4b5f8615327d7d7567884591846b9b/node_modules/fswatcher-child/", {"name":"fswatcher-child","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chokidar-2.1.0-5fcb70d0b28ebe0867eb0f09d5f6a08f29a1efa0/node_modules/chokidar/", {"name":"chokidar","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chokidar-2.1.6-b6cad653a929e244ce8a834244164d241fa954c5/node_modules/chokidar/", {"name":"chokidar","reference":"2.1.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-anymatch-2.0.0-bcb24b4f37934d9aa7ac17b4adaf89e7c76ef2eb/node_modules/anymatch/", {"name":"anymatch","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-micromatch-3.1.10-70859bc95c9840952f359a068a3fc49f9ecfac23/node_modules/micromatch/", {"name":"micromatch","reference":"3.1.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-arr-diff-4.0.0-d6461074febfec71e7e15235761a329a5dc7c520/node_modules/arr-diff/", {"name":"arr-diff","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-array-unique-0.3.2-a894b75d4bc4f6cd679ef3244a9fd8f46ae2d428/node_modules/array-unique/", {"name":"array-unique","reference":"0.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-braces-2.3.2-5979fd3f14cd531565e5fa2df1abfff1dfaee729/node_modules/braces/", {"name":"braces","reference":"2.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-arr-flatten-1.1.0-36048bbff4e7b47e136644316c99669ea5ae91f1/node_modules/arr-flatten/", {"name":"arr-flatten","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-extend-shallow-2.0.1-51af7d614ad9a9f610ea1bafbb989d6b1c56890f/node_modules/extend-shallow/", {"name":"extend-shallow","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-extend-shallow-3.0.2-26a71aaf073b39fb2127172746131c2704028db8/node_modules/extend-shallow/", {"name":"extend-shallow","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-extendable-0.1.1-62b110e289a471418e3ec36a617d472e301dfc89/node_modules/is-extendable/", {"name":"is-extendable","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-extendable-1.0.1-a7470f9e426733d81bd81e1155264e3a3507cab4/node_modules/is-extendable/", {"name":"is-extendable","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fill-range-4.0.0-d544811d428f98eb06a63dc402d2403c328c38f7/node_modules/fill-range/", {"name":"fill-range","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-number-3.0.0-24fd6201a4782cf50561c810276afc7d12d71195/node_modules/is-number/", {"name":"is-number","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-3.2.2-31ea21a734bab9bbb0f32466d893aea51e4a3c64/node_modules/kind-of/", {"name":"kind-of","reference":"3.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-4.0.0-20813df3d712928b207378691a45066fae72dd57/node_modules/kind-of/", {"name":"kind-of","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-5.1.0-729c91e2d857b7a419a1f9aa65685c4c33f5845d/node_modules/kind-of/", {"name":"kind-of","reference":"5.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-kind-of-6.0.2-01146b36a6218e64e58f3a8d66de5d7fc6f6d051/node_modules/kind-of/", {"name":"kind-of","reference":"6.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-buffer-1.1.6-efaa2ea9daa0d7ab2ea13a97b2b8ad51fefbe8be/node_modules/is-buffer/", {"name":"is-buffer","reference":"1.1.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-repeat-string-1.6.1-8dcae470e1c88abc2d600fff4a776286da75e637/node_modules/repeat-string/", {"name":"repeat-string","reference":"1.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-to-regex-range-2.1.1-7c80c17b9dfebe599e27367e0d4dd5590141db38/node_modules/to-regex-range/", {"name":"to-regex-range","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isobject-3.0.1-4e431e92b11a9731636aa1f9c8d1ccbcfdab78df/node_modules/isobject/", {"name":"isobject","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isobject-2.1.0-f065561096a3f1da2ef46272f815c840d87e0c89/node_modules/isobject/", {"name":"isobject","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-repeat-element-1.1.3-782e0d825c0c5a3bb39731f84efee6b742e6b1ce/node_modules/repeat-element/", {"name":"repeat-element","reference":"1.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-snapdragon-0.8.2-64922e7c565b0e14204ba1aa7d6964278d25182d/node_modules/snapdragon/", {"name":"snapdragon","reference":"0.8.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-base-0.11.2-7bde5ced145b6d551a90db87f83c558b4eb48a8f/node_modules/base/", {"name":"base","reference":"0.11.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cache-base-1.0.1-0a7f46416831c8b662ee36fe4e7c59d76f666ab2/node_modules/cache-base/", {"name":"cache-base","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-collection-visit-1.0.0-4bc0373c164bc3291b4d368c829cf1a80a59dca0/node_modules/collection-visit/", {"name":"collection-visit","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-map-visit-1.0.0-ecdca8f13144e660f1b5bd41f12f3479d98dfb8f/node_modules/map-visit/", {"name":"map-visit","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-object-visit-1.0.1-f79c4493af0c5377b59fe39d395e41042dd045bb/node_modules/object-visit/", {"name":"object-visit","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-component-emitter-1.2.1-137918d6d78283f7df7a6b7c5a63e140e69425e6/node_modules/component-emitter/", {"name":"component-emitter","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-get-value-2.0.6-dc15ca1c672387ca76bd37ac0a395ba2042a2c28/node_modules/get-value/", {"name":"get-value","reference":"2.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-value-1.0.0-18b281da585b1c5c51def24c930ed29a0be6b177/node_modules/has-value/", {"name":"has-value","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-value-0.3.1-7b1f58bada62ca827ec0a2078025654845995e1f/node_modules/has-value/", {"name":"has-value","reference":"0.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-values-1.0.0-95b0b63fec2146619a6fe57fe75628d5a39efe4f/node_modules/has-values/", {"name":"has-values","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-values-0.1.4-6d61de95d91dfca9b9a02089ad384bff8f62b771/node_modules/has-values/", {"name":"has-values","reference":"0.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-set-value-2.0.0-71ae4a88f0feefbbf52d1ea604f3fb315ebb6274/node_modules/set-value/", {"name":"set-value","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-set-value-0.4.3-7db08f9d3d22dc7f78e53af3c3bf4666ecdfccf1/node_modules/set-value/", {"name":"set-value","reference":"0.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-plain-object-2.0.4-2c163b3fafb1b606d9d17928f05c2a1c38e07677/node_modules/is-plain-object/", {"name":"is-plain-object","reference":"2.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-split-string-3.1.0-7cb09dda3a86585705c64b39a6466038682e8fe2/node_modules/split-string/", {"name":"split-string","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-assign-symbols-1.0.0-59667f41fadd4f20ccbc2bb96b8d4f7f78ec0367/node_modules/assign-symbols/", {"name":"assign-symbols","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-to-object-path-0.3.0-297588b7b0e7e0ac08e04e672f85c1f4999e17af/node_modules/to-object-path/", {"name":"to-object-path","reference":"0.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-union-value-1.0.0-5c71c34cb5bad5dcebe3ea0cd08207ba5aa1aea4/node_modules/union-value/", {"name":"union-value","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-arr-union-3.1.0-e39b09aea9def866a8f206e288af63919bae39c4/node_modules/arr-union/", {"name":"arr-union","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unset-value-1.0.0-8376873f7d2335179ffb1e6fc3a8ed0dfc8ab559/node_modules/unset-value/", {"name":"unset-value","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isarray-1.0.0-bb935d48582cba168c06834957a54a3e07124f11/node_modules/isarray/", {"name":"isarray","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isarray-0.0.1-8a18acfca9a8f4177e09abfc6038939b05d1eedf/node_modules/isarray/", {"name":"isarray","reference":"0.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-class-utils-0.3.6-f93369ae8b9a7ce02fd41faad0ca83033190c463/node_modules/class-utils/", {"name":"class-utils","reference":"0.3.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-define-property-0.2.5-c35b1ef918ec3c990f9a5bc57be04aacec5c8116/node_modules/define-property/", {"name":"define-property","reference":"0.2.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-define-property-1.0.0-769ebaaf3f4a63aad3af9e8d304c9bbe79bfb0e6/node_modules/define-property/", {"name":"define-property","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-define-property-2.0.2-d459689e8d654ba77e02a817f8710d702cb16e9d/node_modules/define-property/", {"name":"define-property","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-descriptor-0.1.6-366d8240dde487ca51823b1ab9f07a10a78251ca/node_modules/is-descriptor/", {"name":"is-descriptor","reference":"0.1.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-descriptor-1.0.2-3b159746a66604b04f8c81524ba365c5f14d86ec/node_modules/is-descriptor/", {"name":"is-descriptor","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-accessor-descriptor-0.1.6-a9e12cb3ae8d876727eeef3843f8a0897b5c98d6/node_modules/is-accessor-descriptor/", {"name":"is-accessor-descriptor","reference":"0.1.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-accessor-descriptor-1.0.0-169c2f6d3df1f992618072365c9b0ea1f6878656/node_modules/is-accessor-descriptor/", {"name":"is-accessor-descriptor","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-data-descriptor-0.1.4-0b5ee648388e2c860282e793f1856fec3f301b56/node_modules/is-data-descriptor/", {"name":"is-data-descriptor","reference":"0.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-data-descriptor-1.0.0-d84876321d0e7add03990406abbbbd36ba9268c7/node_modules/is-data-descriptor/", {"name":"is-data-descriptor","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-static-extend-0.1.2-60809c39cbff55337226fd5e0b520f341f1fb5c6/node_modules/static-extend/", {"name":"static-extend","reference":"0.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-object-copy-0.1.0-7e7d858b781bd7c991a41ba975ed3812754e998c/node_modules/object-copy/", {"name":"object-copy","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-copy-descriptor-0.1.1-676f6eb3c39997c2ee1ac3a924fd6124748f578d/node_modules/copy-descriptor/", {"name":"copy-descriptor","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mixin-deep-1.3.1-a49e7268dce1a0d9698e45326c5626df3543d0fe/node_modules/mixin-deep/", {"name":"mixin-deep","reference":"1.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-for-in-1.0.2-81068d295a8142ec0ac726c6e2200c30fb6d5e80/node_modules/for-in/", {"name":"for-in","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pascalcase-0.1.1-b363e55e8006ca6fe21784d2db22bd15d7917f14/node_modules/pascalcase/", {"name":"pascalcase","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-map-cache-0.2.2-c32abd0bd6525d9b051645bb4f26ac5dc98a0dbf/node_modules/map-cache/", {"name":"map-cache","reference":"0.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-source-map-resolve-0.5.2-72e2cc34095543e43b2c62b2c4c10d4a9054f259/node_modules/source-map-resolve/", {"name":"source-map-resolve","reference":"0.5.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-atob-2.1.2-6d9517eb9e030d2436666651e86bd9f6f13533c9/node_modules/atob/", {"name":"atob","reference":"2.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-decode-uri-component-0.2.0-eb3913333458775cb84cd1a1fae062106bb87545/node_modules/decode-uri-component/", {"name":"decode-uri-component","reference":"0.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-resolve-url-0.2.1-2c637fe77c893afd2a663fe21aa9080068e2052a/node_modules/resolve-url/", {"name":"resolve-url","reference":"0.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-source-map-url-0.4.0-3e935d7ddd73631b97659956d55128e87b5084a3/node_modules/source-map-url/", {"name":"source-map-url","reference":"0.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-urix-0.1.0-da937f7a62e21fec1fd18d49b35c2935067a6c72/node_modules/urix/", {"name":"urix","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-use-3.1.1-d50c8cac79a19fbc20f2911f56eb973f4e10070f/node_modules/use/", {"name":"use","reference":"3.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-snapdragon-node-2.1.1-6c175f86ff14bdb0724563e8f3c1b021a286853b/node_modules/snapdragon-node/", {"name":"snapdragon-node","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-snapdragon-util-3.0.1-f956479486f2acd79700693f6f7b805e45ab56e2/node_modules/snapdragon-util/", {"name":"snapdragon-util","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-to-regex-3.0.2-13cfdd9b336552f30b51f33a8ae1b42a7a7599ce/node_modules/to-regex/", {"name":"to-regex","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regex-not-1.0.2-1f4ece27e00b0b65e0247a6810e6a85d83a5752c/node_modules/regex-not/", {"name":"regex-not","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-safe-regex-1.1.0-40a3669f3b077d1e943d44629e157dd48023bf2e/node_modules/safe-regex/", {"name":"safe-regex","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ret-0.1.15-b8a4825d5bdb1fc3f6f53c2bc33f81388681c7bc/node_modules/ret/", {"name":"ret","reference":"0.1.15"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-extglob-2.0.4-ad00fe4dc612a9232e8718711dc5cb5ab0285543/node_modules/extglob/", {"name":"extglob","reference":"2.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-expand-brackets-2.1.4-b77735e315ce30f6b6eff0f83b04151a22449622/node_modules/expand-brackets/", {"name":"expand-brackets","reference":"2.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-posix-character-classes-0.1.1-01eac0fe3b5af71a2a6c02feabb8c1fef7e00eab/node_modules/posix-character-classes/", {"name":"posix-character-classes","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fragment-cache-0.2.1-4290fad27f13e89be7f33799c6bc5a0abfff0d19/node_modules/fragment-cache/", {"name":"fragment-cache","reference":"0.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-nanomatch-1.2.13-b87a8aa4fc0de8fe6be88895b38983ff265bd119/node_modules/nanomatch/", {"name":"nanomatch","reference":"1.2.13"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-windows-1.0.2-d1850eb9791ecd18e6182ce12a30f396634bb19d/node_modules/is-windows/", {"name":"is-windows","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-object-pick-1.3.0-87a10ac4c1694bd2e1cbf53591a66141fb5dd747/node_modules/object.pick/", {"name":"object.pick","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-normalize-path-2.1.1-1ab28b556e198363a8c1a6f7e6fa20137fe6aed9/node_modules/normalize-path/", {"name":"normalize-path","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-normalize-path-3.0.0-0dcd69ff23a1c9b11fd0978316644a0388216a65/node_modules/normalize-path/", {"name":"normalize-path","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-remove-trailing-separator-1.1.0-c24bce2a283adad5bc3f58e0d48249b92379d8ef/node_modules/remove-trailing-separator/", {"name":"remove-trailing-separator","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-async-each-1.0.1-19d386a1d9edc6e7c1c85d388aedbcc56d33602d/node_modules/async-each/", {"name":"async-each","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-glob-parent-3.1.0-9e6af6299d8d3bd2bd40430832bd113df906c5ae/node_modules/glob-parent/", {"name":"glob-parent","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-glob-3.1.0-7ba5ae24217804ac70707b96922567486cc3e84a/node_modules/is-glob/", {"name":"is-glob","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-glob-4.0.0-9521c76845cc2610a85203ddf080a958c2ffabc0/node_modules/is-glob/", {"name":"is-glob","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-extglob-2.1.1-a88c02535791f02ed37c76a1b9ea9773c833f8c2/node_modules/is-extglob/", {"name":"is-extglob","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-dirname-1.0.2-cc33d24d525e099a5388c0336c6e32b9160609e0/node_modules/path-dirname/", {"name":"path-dirname","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-inherits-2.0.3-633c2c83e3da42a502f52466022480f4208261de/node_modules/inherits/", {"name":"inherits","reference":"2.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-binary-path-1.0.1-75f16642b480f187a711c814161fd3a4a7655898/node_modules/is-binary-path/", {"name":"is-binary-path","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-binary-extensions-1.13.0-9523e001306a32444b907423f1de2164222f6ab1/node_modules/binary-extensions/", {"name":"binary-extensions","reference":"1.13.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-is-absolute-1.0.1-174b9268735534ffbc7ace6bf53a5a9e1b5c5f5f/node_modules/path-is-absolute/", {"name":"path-is-absolute","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-readdirp-2.2.1-0e87622a3325aa33e892285caf8b4e846529a525/node_modules/readdirp/", {"name":"readdirp","reference":"2.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-readable-stream-2.3.6-b11c27d88b8ff1fbe070643cf94b0c79ae1b0aaf/node_modules/readable-stream/", {"name":"readable-stream","reference":"2.3.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-util-is-1.0.2-b5fd54220aa2bc5ab57aab7140c940754503c1a7/node_modules/core-util-is/", {"name":"core-util-is","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-process-nextick-args-2.0.0-a37d732f4271b4ab1ad070d35508e8290788ffaa/node_modules/process-nextick-args/", {"name":"process-nextick-args","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-string-decoder-1.1.1-9cf1611ba62685d7030ae9e4ba34149c3af03fc8/node_modules/string_decoder/", {"name":"string_decoder","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-util-deprecate-1.0.2-450d4dc9fa70de732762fbd2d4a28981419a0ccf/node_modules/util-deprecate/", {"name":"util-deprecate","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-upath-1.1.0-35256597e46a581db4793d0ce47fa9aebfc9fabd/node_modules/upath/", {"name":"upath","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-upath-1.1.2-3db658600edaeeccbe6db5e684d67ee8c2acd068/node_modules/upath/", {"name":"upath","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-graphviz-0.0.9-0bbf1df588c6a92259282da35323622528c4bbc4/node_modules/graphviz/", {"name":"graphviz","reference":"0.0.9"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-temp-0.4.0-671ad63d57be0fe9d7294664b3fc400636678a60/node_modules/temp/", {"name":"temp","reference":"0.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ora-3.4.0-bf0752491059a3ef3ed4c85097531de9fdbcd318/node_modules/ora/", {"name":"ora","reference":"3.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ora-3.2.0-67e98a7e11f7f0ac95deaaaf11bb04de3d09e481/node_modules/ora/", {"name":"ora","reference":"3.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-cursor-2.1.0-b35dac376479facc3e94747d41d0d0f5238ffcb5/node_modules/cli-cursor/", {"name":"cli-cursor","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-restore-cursor-2.0.0-9f7ee287f82fd326d4fd162923d62129eee0dfaf/node_modules/restore-cursor/", {"name":"restore-cursor","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-onetime-2.0.1-067428230fd67443b2794b22bba528b6867962d4/node_modules/onetime/", {"name":"onetime","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-spinners-2.0.0-4b078756fc17a8f72043fdc9f1f14bf4fa87e2df/node_modules/cli-spinners/", {"name":"cli-spinners","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-log-symbols-2.2.0-5740e1c5d6f0dfda4ad9323b5332107ef6b4c40a/node_modules/log-symbols/", {"name":"log-symbols","reference":"2.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-log-symbols-1.0.2-376ff7b58ea3086a0f09facc74617eca501e1a18/node_modules/log-symbols/", {"name":"log-symbols","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-wcwidth-1.0.1-f0b0dcf915bc5ff1528afadb2c0e17b532da2fe8/node_modules/wcwidth/", {"name":"wcwidth","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-defaults-1.0.3-c656051e9817d9ff08ed881477f3fe4019f3ef7d/node_modules/defaults/", {"name":"defaults","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-clone-1.0.4-da309cc263df15994c688ca902179ca3c7cd7c7e/node_modules/clone/", {"name":"clone","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parse5-5.1.0-c59341c9723f414c452975564c7c00a68d58acd2/node_modules/parse5/", {"name":"parse5","reference":"5.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parse5-4.0.0-6d78656e3da8d78b4ec0b906f7c08ef1dfe3f608/node_modules/parse5/", {"name":"parse5","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pretty-bytes-5.2.0-96c92c6e95a0b35059253fb33c03e260d40f5a1f/node_modules/pretty-bytes/", {"name":"pretty-bytes","reference":"5.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pretty-bytes-4.0.2-b2bf82e7350d65c6c33aa95aaa5a4f6327f61cd9/node_modules/pretty-bytes/", {"name":"pretty-bytes","reference":"4.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ws-7.0.0-79351cbc3f784b3c20d0821baf4b4ff809ffbf51/node_modules/ws/", {"name":"ws","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ws-5.2.2-dffef14866b8e8dc9133582514d1befaf96e980f/node_modules/ws/", {"name":"ws","reference":"5.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-async-limiter-1.0.0-78faed8c3d074ab81f22b4e985d79e8738f720f8/node_modules/async-limiter/", {"name":"async-limiter","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-preset-env-7.4.2-2f5ba1de2daefa9dcca653848f96c7ce2e406676/node_modules/@babel/preset-env/", {"name":"@babel/preset-env","reference":"7.4.2"}],
  ["./.pnp/externals/pnp-0fcb8a86302027dee988c72e7fda9a303025484a/node_modules/@babel/preset-env/", {"name":"@babel/preset-env","reference":"pnp:0fcb8a86302027dee988c72e7fda9a303025484a"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-plugin-utils-7.0.0-bbb3fbee98661c569034237cc03967ba99b4f250/node_modules/@babel/helper-plugin-utils/", {"name":"@babel/helper-plugin-utils","reference":"7.0.0"}],
  ["./.pnp/externals/pnp-c9bc4575bb4c144ef417ebbafd47b3b8295af064/node_modules/@babel/plugin-proposal-async-generator-functions/", {"name":"@babel/plugin-proposal-async-generator-functions","reference":"pnp:c9bc4575bb4c144ef417ebbafd47b3b8295af064"}],
  ["./.pnp/externals/pnp-0fcba5ab8fb387ed9474092e019695c05c2078d1/node_modules/@babel/plugin-proposal-async-generator-functions/", {"name":"@babel/plugin-proposal-async-generator-functions","reference":"pnp:0fcba5ab8fb387ed9474092e019695c05c2078d1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-remap-async-to-generator-7.1.0-361d80821b6f38da75bd3f0785ece20a88c5fe7f/node_modules/@babel/helper-remap-async-to-generator/", {"name":"@babel/helper-remap-async-to-generator","reference":"7.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-annotate-as-pure-7.0.0-323d39dd0b50e10c7c06ca7d7638e6864d8c5c32/node_modules/@babel/helper-annotate-as-pure/", {"name":"@babel/helper-annotate-as-pure","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-wrap-function-7.2.0-c4e0012445769e2815b55296ead43a958549f6fa/node_modules/@babel/helper-wrap-function/", {"name":"@babel/helper-wrap-function","reference":"7.2.0"}],
  ["./.pnp/externals/pnp-4ecc4075f1b85e42f60a92a519195c57adcaee37/node_modules/@babel/plugin-syntax-async-generators/", {"name":"@babel/plugin-syntax-async-generators","reference":"pnp:4ecc4075f1b85e42f60a92a519195c57adcaee37"}],
  ["./.pnp/externals/pnp-2dc40106cf8fd126426ad6195234ec72dbcfaf39/node_modules/@babel/plugin-syntax-async-generators/", {"name":"@babel/plugin-syntax-async-generators","reference":"pnp:2dc40106cf8fd126426ad6195234ec72dbcfaf39"}],
  ["./.pnp/externals/pnp-4b19e84a5869a0f9cae36be834eee07e4163a47f/node_modules/@babel/plugin-syntax-async-generators/", {"name":"@babel/plugin-syntax-async-generators","reference":"pnp:4b19e84a5869a0f9cae36be834eee07e4163a47f"}],
  ["./.pnp/externals/pnp-bdb015bb034f3f82084dfacd1ba186a4212bc8c5/node_modules/@babel/plugin-syntax-async-generators/", {"name":"@babel/plugin-syntax-async-generators","reference":"pnp:bdb015bb034f3f82084dfacd1ba186a4212bc8c5"}],
  ["./.pnp/externals/pnp-68ec4f6bc76d657bdeb2cc59bd8137cc968fe627/node_modules/@babel/plugin-proposal-json-strings/", {"name":"@babel/plugin-proposal-json-strings","reference":"pnp:68ec4f6bc76d657bdeb2cc59bd8137cc968fe627"}],
  ["./.pnp/externals/pnp-e6558ae27eed106acc73f522796abf89e5cc93f6/node_modules/@babel/plugin-proposal-json-strings/", {"name":"@babel/plugin-proposal-json-strings","reference":"pnp:e6558ae27eed106acc73f522796abf89e5cc93f6"}],
  ["./.pnp/externals/pnp-90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc/node_modules/@babel/plugin-syntax-json-strings/", {"name":"@babel/plugin-syntax-json-strings","reference":"pnp:90a3c26dbfb5ea311a2c3ca612636ce85fc1a3bc"}],
  ["./.pnp/externals/pnp-3fce135b2c9687a3ba481074ff3a21fb1421630c/node_modules/@babel/plugin-syntax-json-strings/", {"name":"@babel/plugin-syntax-json-strings","reference":"pnp:3fce135b2c9687a3ba481074ff3a21fb1421630c"}],
  ["./.pnp/externals/pnp-1fb25abe4c84fb26fe43937d800e625daaf09a5b/node_modules/@babel/plugin-syntax-json-strings/", {"name":"@babel/plugin-syntax-json-strings","reference":"pnp:1fb25abe4c84fb26fe43937d800e625daaf09a5b"}],
  ["./.pnp/externals/pnp-87accb40ed4635b97081c874891070fcaea08d37/node_modules/@babel/plugin-syntax-json-strings/", {"name":"@babel/plugin-syntax-json-strings","reference":"pnp:87accb40ed4635b97081c874891070fcaea08d37"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-object-rest-spread-7.4.0-e4960575205eadf2a1ab4e0c79f9504d5b82a97f/node_modules/@babel/plugin-proposal-object-rest-spread/", {"name":"@babel/plugin-proposal-object-rest-spread","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-object-rest-spread-7.4.3-be27cd416eceeba84141305b93c282f5de23bbb4/node_modules/@babel/plugin-proposal-object-rest-spread/", {"name":"@babel/plugin-proposal-object-rest-spread","reference":"7.4.3"}],
  ["./.pnp/externals/pnp-a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75/node_modules/@babel/plugin-proposal-object-rest-spread/", {"name":"@babel/plugin-proposal-object-rest-spread","reference":"pnp:a45a6b0b6000042bfaa2a2e3f2942cdeb2c6aa75"}],
  ["./.pnp/externals/pnp-d21a38d0695bb92bc896c7afeebcfc9e3c3a1464/node_modules/@babel/plugin-proposal-object-rest-spread/", {"name":"@babel/plugin-proposal-object-rest-spread","reference":"pnp:d21a38d0695bb92bc896c7afeebcfc9e3c3a1464"}],
  ["./.pnp/externals/pnp-aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:aa5c8a0de0e3bd19bd4fa44021dd5206f73c049a"}],
  ["./.pnp/externals/pnp-f21c2711308277c29808d40b71d3469926161e85/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:f21c2711308277c29808d40b71d3469926161e85"}],
  ["./.pnp/externals/pnp-9f663b6856b348804c2c0c2434805caf61c6c3e2/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:9f663b6856b348804c2c0c2434805caf61c6c3e2"}],
  ["./.pnp/externals/pnp-b48ed82b04ffd88ec843040b4a109a32fe4380e0/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:b48ed82b04ffd88ec843040b4a109a32fe4380e0"}],
  ["./.pnp/externals/pnp-289edf6f22f0e6a8c576348d7aceba28afb7ce12/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:289edf6f22f0e6a8c576348d7aceba28afb7ce12"}],
  ["./.pnp/externals/pnp-04416ed1deece382c5ecb0ef2759dc1c8ea12290/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:04416ed1deece382c5ecb0ef2759dc1c8ea12290"}],
  ["./.pnp/externals/pnp-02230c10914cd035a201a3903a61f186c4b9c0e8/node_modules/@babel/plugin-syntax-object-rest-spread/", {"name":"@babel/plugin-syntax-object-rest-spread","reference":"pnp:02230c10914cd035a201a3903a61f186c4b9c0e8"}],
  ["./.pnp/externals/pnp-d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2/node_modules/@babel/plugin-proposal-optional-catch-binding/", {"name":"@babel/plugin-proposal-optional-catch-binding","reference":"pnp:d5cfc5e0e1ea9a34d0c959e5546771a66100fbe2"}],
  ["./.pnp/externals/pnp-58301a8687a35c191f6b7ba378cc2feb3e9e8bd6/node_modules/@babel/plugin-proposal-optional-catch-binding/", {"name":"@babel/plugin-proposal-optional-catch-binding","reference":"pnp:58301a8687a35c191f6b7ba378cc2feb3e9e8bd6"}],
  ["./.pnp/externals/pnp-493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1/node_modules/@babel/plugin-syntax-optional-catch-binding/", {"name":"@babel/plugin-syntax-optional-catch-binding","reference":"pnp:493b9a00aa8d949d1b1ac0ef51a02c0d8d4375e1"}],
  ["./.pnp/externals/pnp-225721100e9193a34544da90564940816d04a0f3/node_modules/@babel/plugin-syntax-optional-catch-binding/", {"name":"@babel/plugin-syntax-optional-catch-binding","reference":"pnp:225721100e9193a34544da90564940816d04a0f3"}],
  ["./.pnp/externals/pnp-9b1989a76a394312ba9c5025d05a2e9a7511be36/node_modules/@babel/plugin-syntax-optional-catch-binding/", {"name":"@babel/plugin-syntax-optional-catch-binding","reference":"pnp:9b1989a76a394312ba9c5025d05a2e9a7511be36"}],
  ["./.pnp/externals/pnp-17df0d674d7ac439f303b29abc0b89de84450201/node_modules/@babel/plugin-syntax-optional-catch-binding/", {"name":"@babel/plugin-syntax-optional-catch-binding","reference":"pnp:17df0d674d7ac439f303b29abc0b89de84450201"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-unicode-property-regex-7.4.0-202d91ee977d760ef83f4f416b280d568be84623/node_modules/@babel/plugin-proposal-unicode-property-regex/", {"name":"@babel/plugin-proposal-unicode-property-regex","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-unicode-property-regex-7.4.4-501ffd9826c0b91da22690720722ac7cb1ca9c78/node_modules/@babel/plugin-proposal-unicode-property-regex/", {"name":"@babel/plugin-proposal-unicode-property-regex","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-regex-7.0.0-2c1718923b57f9bbe64705ffe5640ac64d9bdb27/node_modules/@babel/helper-regex/", {"name":"@babel/helper-regex","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-regex-7.4.4-a47e02bc91fb259d2e6727c2a30013e3ac13c4a2/node_modules/@babel/helper-regex/", {"name":"@babel/helper-regex","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regexpu-core-4.5.4-080d9d02289aa87fe1667a4f5136bc98a6aebaae/node_modules/regexpu-core/", {"name":"regexpu-core","reference":"4.5.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regexpu-core-4.4.0-8d43e0d1266883969720345e70c275ee0aec0d32/node_modules/regexpu-core/", {"name":"regexpu-core","reference":"4.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerate-1.4.0-4a856ec4b56e4077c557589cae85e7a4c8869a11/node_modules/regenerate/", {"name":"regenerate","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerate-unicode-properties-8.0.2-7b38faa296252376d363558cfbda90c9ce709662/node_modules/regenerate-unicode-properties/", {"name":"regenerate-unicode-properties","reference":"8.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerate-unicode-properties-7.0.0-107405afcc4a190ec5ed450ecaa00ed0cafa7a4c/node_modules/regenerate-unicode-properties/", {"name":"regenerate-unicode-properties","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regjsgen-0.5.0-a7634dc08f89209c2049adda3525711fb97265dd/node_modules/regjsgen/", {"name":"regjsgen","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regjsparser-0.6.0-f1e6ae8b7da2bae96c99399b868cd6c933a2ba9c/node_modules/regjsparser/", {"name":"regjsparser","reference":"0.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unicode-match-property-ecmascript-1.0.4-8ed2a32569961bce9227d09cd3ffbb8fed5f020c/node_modules/unicode-match-property-ecmascript/", {"name":"unicode-match-property-ecmascript","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unicode-canonical-property-names-ecmascript-1.0.4-2619800c4c825800efdd8343af7dd9933cbe2818/node_modules/unicode-canonical-property-names-ecmascript/", {"name":"unicode-canonical-property-names-ecmascript","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unicode-property-aliases-ecmascript-1.0.4-5a533f31b4317ea76f17d807fa0d116546111dd0/node_modules/unicode-property-aliases-ecmascript/", {"name":"unicode-property-aliases-ecmascript","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unicode-match-property-value-ecmascript-1.1.0-5b4b426e08d13a80365e0d657ac7a6c1ec46a277/node_modules/unicode-match-property-value-ecmascript/", {"name":"unicode-match-property-value-ecmascript","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unicode-match-property-value-ecmascript-1.0.2-9f1dc76926d6ccf452310564fd834ace059663d4/node_modules/unicode-match-property-value-ecmascript/", {"name":"unicode-match-property-value-ecmascript","reference":"1.0.2"}],
  ["./.pnp/externals/pnp-705e525ab6be3fa50fb9ef4e48cf128f32a3cc22/node_modules/@babel/plugin-transform-arrow-functions/", {"name":"@babel/plugin-transform-arrow-functions","reference":"pnp:705e525ab6be3fa50fb9ef4e48cf128f32a3cc22"}],
  ["./.pnp/externals/pnp-a81271c9accc4c94a60061b6c7d9ed4f566e633d/node_modules/@babel/plugin-transform-arrow-functions/", {"name":"@babel/plugin-transform-arrow-functions","reference":"pnp:a81271c9accc4c94a60061b6c7d9ed4f566e633d"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-async-to-generator-7.4.0-234fe3e458dce95865c0d152d256119b237834b0/node_modules/@babel/plugin-transform-async-to-generator/", {"name":"@babel/plugin-transform-async-to-generator","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-async-to-generator-7.4.4-a3f1d01f2f21cadab20b33a82133116f14fb5894/node_modules/@babel/plugin-transform-async-to-generator/", {"name":"@babel/plugin-transform-async-to-generator","reference":"7.4.4"}],
  ["./.pnp/externals/pnp-b8d36a0e178b88992b847671a432a570de7b2a01/node_modules/@babel/plugin-transform-block-scoped-functions/", {"name":"@babel/plugin-transform-block-scoped-functions","reference":"pnp:b8d36a0e178b88992b847671a432a570de7b2a01"}],
  ["./.pnp/externals/pnp-dba325a89899ca82a1bce94e52fe46c9eb3ef76c/node_modules/@babel/plugin-transform-block-scoped-functions/", {"name":"@babel/plugin-transform-block-scoped-functions","reference":"pnp:dba325a89899ca82a1bce94e52fe46c9eb3ef76c"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-block-scoping-7.4.0-164df3bb41e3deb954c4ca32ffa9fcaa56d30bcb/node_modules/@babel/plugin-transform-block-scoping/", {"name":"@babel/plugin-transform-block-scoping","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-block-scoping-7.4.4-c13279fabf6b916661531841a23c4b7dae29646d/node_modules/@babel/plugin-transform-block-scoping/", {"name":"@babel/plugin-transform-block-scoping","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-classes-7.4.0-e3428d3c8a3d01f33b10c529b998ba1707043d4d/node_modules/@babel/plugin-transform-classes/", {"name":"@babel/plugin-transform-classes","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-classes-7.4.4-0ce4094cdafd709721076d3b9c38ad31ca715eb6/node_modules/@babel/plugin-transform-classes/", {"name":"@babel/plugin-transform-classes","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-define-map-7.4.0-cbfd8c1b2f12708e262c26f600cd16ed6a3bc6c9/node_modules/@babel/helper-define-map/", {"name":"@babel/helper-define-map","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-define-map-7.4.4-6969d1f570b46bdc900d1eba8e5d59c48ba2c12a/node_modules/@babel/helper-define-map/", {"name":"@babel/helper-define-map","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-optimise-call-expression-7.0.0-a2920c5702b073c15de51106200aa8cad20497d5/node_modules/@babel/helper-optimise-call-expression/", {"name":"@babel/helper-optimise-call-expression","reference":"7.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-replace-supers-7.4.0-4f56adb6aedcd449d2da9399c2dcf0545463b64c/node_modules/@babel/helper-replace-supers/", {"name":"@babel/helper-replace-supers","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-replace-supers-7.2.3-19970020cf22677d62b3a689561dbd9644d8c5e5/node_modules/@babel/helper-replace-supers/", {"name":"@babel/helper-replace-supers","reference":"7.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-replace-supers-7.4.4-aee41783ebe4f2d3ab3ae775e1cc6f1a90cefa27/node_modules/@babel/helper-replace-supers/", {"name":"@babel/helper-replace-supers","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-member-expression-to-functions-7.0.0-8cd14b0a0df7ff00f009e7d7a436945f47c7a16f/node_modules/@babel/helper-member-expression-to-functions/", {"name":"@babel/helper-member-expression-to-functions","reference":"7.0.0"}],
  ["./.pnp/externals/pnp-7833a827b64ccae1f1110308a462b3cecb5f9e99/node_modules/@babel/plugin-transform-computed-properties/", {"name":"@babel/plugin-transform-computed-properties","reference":"pnp:7833a827b64ccae1f1110308a462b3cecb5f9e99"}],
  ["./.pnp/externals/pnp-cccec504e039f73d05407aac79b4545b3d9e0fee/node_modules/@babel/plugin-transform-computed-properties/", {"name":"@babel/plugin-transform-computed-properties","reference":"pnp:cccec504e039f73d05407aac79b4545b3d9e0fee"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-destructuring-7.4.0-acbb9b2418d290107db333f4d6cd8aa6aea00343/node_modules/@babel/plugin-transform-destructuring/", {"name":"@babel/plugin-transform-destructuring","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-destructuring-7.4.4-9d964717829cc9e4b601fc82a26a71a4d8faf20f/node_modules/@babel/plugin-transform-destructuring/", {"name":"@babel/plugin-transform-destructuring","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-dotall-regex-7.2.0-f0aabb93d120a8ac61e925ea0ba440812dbe0e49/node_modules/@babel/plugin-transform-dotall-regex/", {"name":"@babel/plugin-transform-dotall-regex","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-dotall-regex-7.4.4-361a148bc951444312c69446d76ed1ea8e4450c3/node_modules/@babel/plugin-transform-dotall-regex/", {"name":"@babel/plugin-transform-dotall-regex","reference":"7.4.4"}],
  ["./.pnp/externals/pnp-2c1efb2908ba15d96fa6c471d52e1c06e6a35136/node_modules/@babel/plugin-transform-duplicate-keys/", {"name":"@babel/plugin-transform-duplicate-keys","reference":"pnp:2c1efb2908ba15d96fa6c471d52e1c06e6a35136"}],
  ["./.pnp/externals/pnp-e104fc3b299ecc9e424fe88ef169be4ff387ea9a/node_modules/@babel/plugin-transform-duplicate-keys/", {"name":"@babel/plugin-transform-duplicate-keys","reference":"pnp:e104fc3b299ecc9e424fe88ef169be4ff387ea9a"}],
  ["./.pnp/externals/pnp-f4ed7a7493b7db746c46fd71274457a6b37dacf8/node_modules/@babel/plugin-transform-exponentiation-operator/", {"name":"@babel/plugin-transform-exponentiation-operator","reference":"pnp:f4ed7a7493b7db746c46fd71274457a6b37dacf8"}],
  ["./.pnp/externals/pnp-585f461e43b2ed57e91c98f770ce10675ca460a0/node_modules/@babel/plugin-transform-exponentiation-operator/", {"name":"@babel/plugin-transform-exponentiation-operator","reference":"pnp:585f461e43b2ed57e91c98f770ce10675ca460a0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-builder-binary-assignment-operator-visitor-7.1.0-6b69628dfe4087798e0c4ed98e3d4a6b2fbd2f5f/node_modules/@babel/helper-builder-binary-assignment-operator-visitor/", {"name":"@babel/helper-builder-binary-assignment-operator-visitor","reference":"7.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-explode-assignable-expression-7.1.0-537fa13f6f1674df745b0c00ec8fe4e99681c8f6/node_modules/@babel/helper-explode-assignable-expression/", {"name":"@babel/helper-explode-assignable-expression","reference":"7.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-for-of-7.4.0-56c8c36677f5d4a16b80b12f7b768de064aaeb5f/node_modules/@babel/plugin-transform-for-of/", {"name":"@babel/plugin-transform-for-of","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-for-of-7.4.4-0267fc735e24c808ba173866c6c4d1440fc3c556/node_modules/@babel/plugin-transform-for-of/", {"name":"@babel/plugin-transform-for-of","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-function-name-7.2.0-f7930362829ff99a3174c39f0afcc024ef59731a/node_modules/@babel/plugin-transform-function-name/", {"name":"@babel/plugin-transform-function-name","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-function-name-7.4.4-e1436116abb0610c2259094848754ac5230922ad/node_modules/@babel/plugin-transform-function-name/", {"name":"@babel/plugin-transform-function-name","reference":"7.4.4"}],
  ["./.pnp/externals/pnp-928eb25abee04aa2ef762c675400efb2058f9313/node_modules/@babel/plugin-transform-literals/", {"name":"@babel/plugin-transform-literals","reference":"pnp:928eb25abee04aa2ef762c675400efb2058f9313"}],
  ["./.pnp/externals/pnp-1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64/node_modules/@babel/plugin-transform-literals/", {"name":"@babel/plugin-transform-literals","reference":"pnp:1e29bf0d9b0bf62ca4ae455cea1df7be2fd1dc64"}],
  ["./.pnp/externals/pnp-706179cadfc9260a128e03f81f4b6e353114732a/node_modules/@babel/plugin-transform-modules-amd/", {"name":"@babel/plugin-transform-modules-amd","reference":"pnp:706179cadfc9260a128e03f81f4b6e353114732a"}],
  ["./.pnp/externals/pnp-854ff2a92da13ec2571fd6ca44727c5f2a8e5114/node_modules/@babel/plugin-transform-modules-amd/", {"name":"@babel/plugin-transform-modules-amd","reference":"pnp:854ff2a92da13ec2571fd6ca44727c5f2a8e5114"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-module-transforms-7.2.2-ab2f8e8d231409f8370c883d20c335190284b963/node_modules/@babel/helper-module-transforms/", {"name":"@babel/helper-module-transforms","reference":"7.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-module-transforms-7.4.4-96115ea42a2f139e619e98ed46df6019b94414b8/node_modules/@babel/helper-module-transforms/", {"name":"@babel/helper-module-transforms","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-simple-access-7.1.0-65eeb954c8c245beaa4e859da6188f39d71e585c/node_modules/@babel/helper-simple-access/", {"name":"@babel/helper-simple-access","reference":"7.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-commonjs-7.4.0-3b8ec61714d3b75d20c5ccfa157f2c2e087fd4ca/node_modules/@babel/plugin-transform-modules-commonjs/", {"name":"@babel/plugin-transform-modules-commonjs","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-commonjs-7.4.4-0bef4713d30f1d78c2e59b3d6db40e60192cac1e/node_modules/@babel/plugin-transform-modules-commonjs/", {"name":"@babel/plugin-transform-modules-commonjs","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-systemjs-7.4.0-c2495e55528135797bc816f5d50f851698c586a1/node_modules/@babel/plugin-transform-modules-systemjs/", {"name":"@babel/plugin-transform-modules-systemjs","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-modules-systemjs-7.4.4-dc83c5665b07d6c2a7b224c00ac63659ea36a405/node_modules/@babel/plugin-transform-modules-systemjs/", {"name":"@babel/plugin-transform-modules-systemjs","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-hoist-variables-7.4.0-25b621399ae229869329730a62015bbeb0a6fbd6/node_modules/@babel/helper-hoist-variables/", {"name":"@babel/helper-hoist-variables","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-hoist-variables-7.4.4-0298b5f25c8c09c53102d52ac4a98f773eb2850a/node_modules/@babel/helper-hoist-variables/", {"name":"@babel/helper-hoist-variables","reference":"7.4.4"}],
  ["./.pnp/externals/pnp-07b0af85a2cecc3ce69934c8ce0f82220a29e1df/node_modules/@babel/plugin-transform-modules-umd/", {"name":"@babel/plugin-transform-modules-umd","reference":"pnp:07b0af85a2cecc3ce69934c8ce0f82220a29e1df"}],
  ["./.pnp/externals/pnp-e8697c845c77d5331f239f35e71dff671d8b4313/node_modules/@babel/plugin-transform-modules-umd/", {"name":"@babel/plugin-transform-modules-umd","reference":"pnp:e8697c845c77d5331f239f35e71dff671d8b4313"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-named-capturing-groups-regex-7.4.2-800391136d6cbcc80728dbdba3c1c6e46f86c12e/node_modules/@babel/plugin-transform-named-capturing-groups-regex/", {"name":"@babel/plugin-transform-named-capturing-groups-regex","reference":"7.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-named-capturing-groups-regex-7.4.5-9d269fd28a370258199b4294736813a60bbdd106/node_modules/@babel/plugin-transform-named-capturing-groups-regex/", {"name":"@babel/plugin-transform-named-capturing-groups-regex","reference":"7.4.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-nice-try-1.0.5-a3378a7696ce7d223e88fc9b764bd7ef1089e366/node_modules/nice-try/", {"name":"nice-try","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pump-3.0.0-b4a2116815bde2f4e1ea602354e8c75565107a64/node_modules/pump/", {"name":"pump","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pump-2.0.1-12399add6e4cf7526d973cbc8b5ce2e2908b3909/node_modules/pump/", {"name":"pump","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-end-of-stream-1.4.1-ed29634d19baba463b6ce6b80a37213eab71ec43/node_modules/end-of-stream/", {"name":"end-of-stream","reference":"1.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-once-1.4.0-583b1aa775961d4b113ac17d9c50baef9dd76bd1/node_modules/once/", {"name":"once","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-wrappy-1.0.2-b5243d8f3ec1aa35f1364605bc0d1036e30ab69f/node_modules/wrappy/", {"name":"wrappy","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-map-age-cleaner-0.1.3-7d583a7306434c055fe474b0f45078e6e1b4b92a/node_modules/map-age-cleaner/", {"name":"map-age-cleaner","reference":"0.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-defer-1.0.0-9f6eb182f6c9aa8cd743004a7d4f96b196b0fb0c/node_modules/p-defer/", {"name":"p-defer","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-is-promise-2.0.0-7554e3d572109a87e1f3f53f6a7d85d1b194f4c5/node_modules/p-is-promise/", {"name":"p-is-promise","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-is-promise-1.1.0-9c9456989e9f6588017b0434d56097675c3da05e/node_modules/p-is-promise/", {"name":"p-is-promise","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-new-target-7.4.0-67658a1d944edb53c8d4fa3004473a0dd7838150/node_modules/@babel/plugin-transform-new-target/", {"name":"@babel/plugin-transform-new-target","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-new-target-7.4.4-18d120438b0cc9ee95a47f2c72bc9768fbed60a5/node_modules/@babel/plugin-transform-new-target/", {"name":"@babel/plugin-transform-new-target","reference":"7.4.4"}],
  ["./.pnp/externals/pnp-3ce0792a866dfb9f9666453725275d742cb07516/node_modules/@babel/plugin-transform-object-super/", {"name":"@babel/plugin-transform-object-super","reference":"pnp:3ce0792a866dfb9f9666453725275d742cb07516"}],
  ["./.pnp/externals/pnp-46b2e6e496c3be4ddf42cfd099550e51885f42a9/node_modules/@babel/plugin-transform-object-super/", {"name":"@babel/plugin-transform-object-super","reference":"pnp:46b2e6e496c3be4ddf42cfd099550e51885f42a9"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-parameters-7.4.0-a1309426fac4eecd2a9439a4c8c35124a11a48a9/node_modules/@babel/plugin-transform-parameters/", {"name":"@babel/plugin-transform-parameters","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-parameters-7.4.4-7556cf03f318bd2719fe4c922d2d808be5571e16/node_modules/@babel/plugin-transform-parameters/", {"name":"@babel/plugin-transform-parameters","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-call-delegate-7.4.0-f308eabe0d44f451217853aedf4dea5f6fe3294f/node_modules/@babel/helper-call-delegate/", {"name":"@babel/helper-call-delegate","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-call-delegate-7.4.4-87c1f8ca19ad552a736a7a27b1c1fcf8b1ff1f43/node_modules/@babel/helper-call-delegate/", {"name":"@babel/helper-call-delegate","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-regenerator-7.4.0-0780e27ee458cc3fdbad18294d703e972ae1f6d1/node_modules/@babel/plugin-transform-regenerator/", {"name":"@babel/plugin-transform-regenerator","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-regenerator-7.4.5-629dc82512c55cee01341fb27bdfcb210354680f/node_modules/@babel/plugin-transform-regenerator/", {"name":"@babel/plugin-transform-regenerator","reference":"7.4.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-transform-0.13.4-18f6763cf1382c69c36df76c6ce122cc694284fb/node_modules/regenerator-transform/", {"name":"regenerator-transform","reference":"0.13.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regenerator-transform-0.14.0-2ca9aaf7a2c239dd32e4761218425b8c7a86ecaf/node_modules/regenerator-transform/", {"name":"regenerator-transform","reference":"0.14.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-private-0.1.8-2381edb3689f7a53d653190060fcf822d2f368ff/node_modules/private/", {"name":"private","reference":"0.1.8"}],
  ["./.pnp/externals/pnp-6706f7f88678021374b6601dff1304cc39f28df2/node_modules/@babel/plugin-transform-shorthand-properties/", {"name":"@babel/plugin-transform-shorthand-properties","reference":"pnp:6706f7f88678021374b6601dff1304cc39f28df2"}],
  ["./.pnp/externals/pnp-25374ccf4f521bd0353762e978ad98015f7f6ede/node_modules/@babel/plugin-transform-shorthand-properties/", {"name":"@babel/plugin-transform-shorthand-properties","reference":"pnp:25374ccf4f521bd0353762e978ad98015f7f6ede"}],
  ["./.pnp/externals/pnp-531a3ec66b00c112c32da4c3169cb60e29e256e0/node_modules/@babel/plugin-transform-spread/", {"name":"@babel/plugin-transform-spread","reference":"pnp:531a3ec66b00c112c32da4c3169cb60e29e256e0"}],
  ["./.pnp/externals/pnp-5caa1f0f3085d959c7ab13f26ee2ce823c67efdf/node_modules/@babel/plugin-transform-spread/", {"name":"@babel/plugin-transform-spread","reference":"pnp:5caa1f0f3085d959c7ab13f26ee2ce823c67efdf"}],
  ["./.pnp/externals/pnp-d0e0051d5601f7731706c6a83567ab381606682d/node_modules/@babel/plugin-transform-sticky-regex/", {"name":"@babel/plugin-transform-sticky-regex","reference":"pnp:d0e0051d5601f7731706c6a83567ab381606682d"}],
  ["./.pnp/externals/pnp-84785f3ae38278d5344c734e450ab8ee376a33e6/node_modules/@babel/plugin-transform-sticky-regex/", {"name":"@babel/plugin-transform-sticky-regex","reference":"pnp:84785f3ae38278d5344c734e450ab8ee376a33e6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-template-literals-7.2.0-d87ed01b8eaac7a92473f608c97c089de2ba1e5b/node_modules/@babel/plugin-transform-template-literals/", {"name":"@babel/plugin-transform-template-literals","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-template-literals-7.4.4-9d28fea7bbce637fb7612a0750989d8321d4bcb0/node_modules/@babel/plugin-transform-template-literals/", {"name":"@babel/plugin-transform-template-literals","reference":"7.4.4"}],
  ["./.pnp/externals/pnp-15ab85d1e18ca8a2f7e59e350db294bf7f835467/node_modules/@babel/plugin-transform-typeof-symbol/", {"name":"@babel/plugin-transform-typeof-symbol","reference":"pnp:15ab85d1e18ca8a2f7e59e350db294bf7f835467"}],
  ["./.pnp/externals/pnp-0723272ecac627bc84b814d76a18e1d861fb609f/node_modules/@babel/plugin-transform-typeof-symbol/", {"name":"@babel/plugin-transform-typeof-symbol","reference":"pnp:0723272ecac627bc84b814d76a18e1d861fb609f"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-unicode-regex-7.2.0-4eb8db16f972f8abb5062c161b8b115546ade08b/node_modules/@babel/plugin-transform-unicode-regex/", {"name":"@babel/plugin-transform-unicode-regex","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-unicode-regex-7.4.4-ab4634bb4f14d36728bf5978322b35587787970f/node_modules/@babel/plugin-transform-unicode-regex/", {"name":"@babel/plugin-transform-unicode-regex","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-browserslist-4.5.2-36ad281f040af684555a23c780f5c2081c752df0/node_modules/browserslist/", {"name":"browserslist","reference":"4.5.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-browserslist-4.6.3-0530cbc6ab0c1f3fc8c819c72377ba55cf647f05/node_modules/browserslist/", {"name":"browserslist","reference":"4.6.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-caniuse-lite-1.0.30000951-c7c2fd4d71080284c8677dd410368df8d83688fe/node_modules/caniuse-lite/", {"name":"caniuse-lite","reference":"1.0.30000951"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-caniuse-lite-1.0.30000975-d4e7131391dddcf2838999d3ce75065f65f1cdfc/node_modules/caniuse-lite/", {"name":"caniuse-lite","reference":"1.0.30000975"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-electron-to-chromium-1.3.119-9a7770da667252aeb81f667853f67c2b26e00197/node_modules/electron-to-chromium/", {"name":"electron-to-chromium","reference":"1.3.119"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-electron-to-chromium-1.3.165-51864c9e3c9bd9e1c020b9493fddcc0f49888e3a/node_modules/electron-to-chromium/", {"name":"electron-to-chromium","reference":"1.3.165"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-releases-1.1.11-9a0841a4b0d92b7d5141ed179e764f42ad22724a/node_modules/node-releases/", {"name":"node-releases","reference":"1.1.11"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-releases-1.1.23-de7409f72de044a2fa59c097f436ba89c39997f0/node_modules/node-releases/", {"name":"node-releases","reference":"1.1.23"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-js-compat-3.0.0-cd9810b8000742535a4a43773866185e310bd4f7/node_modules/core-js-compat/", {"name":"core-js-compat","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-js-compat-3.1.4-e4d0c40fbd01e65b1d457980fe4112d4358a7408/node_modules/core-js-compat/", {"name":"core-js-compat","reference":"3.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-core-js-pure-3.0.0-a5679adb4875427c8c0488afc93e6f5b7125859b/node_modules/core-js-pure/", {"name":"core-js-pure","reference":"3.0.0"}],
  ["./.pnp/unplugged/npm-core-js-pure-3.1.4-5fa17dc77002a169a3566cc48dc774d2e13e3769/node_modules/core-js-pure/", {"name":"core-js-pure","reference":"3.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-invariant-2.2.4-610f3c92c9359ce1db616e538008d23ff35158e6/node_modules/invariant/", {"name":"invariant","reference":"2.2.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-loose-envify-1.4.0-71ee51fa7be4caec1a63839f7e682d8132d30caf/node_modules/loose-envify/", {"name":"loose-envify","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-js-levenshtein-1.1.6-c6cee58eb3550372df8deb85fad5ce66ce01d59d/node_modules/js-levenshtein/", {"name":"js-levenshtein","reference":"1.1.6"}],
  ["./.pnp/externals/pnp-ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5/node_modules/@babel/preset-typescript/", {"name":"@babel/preset-typescript","reference":"pnp:ac5718fea5a5779ebf31d3ee9fa3d43d2173b0e5"}],
  ["./.pnp/externals/pnp-1eacac43c9327c4cb3cbca060094d2d32117e9cf/node_modules/@babel/preset-typescript/", {"name":"@babel/preset-typescript","reference":"pnp:1eacac43c9327c4cb3cbca060094d2d32117e9cf"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-typescript-7.4.0-0389ec53a34e80f99f708c4ca311181449a68eb1/node_modules/@babel/plugin-transform-typescript/", {"name":"@babel/plugin-transform-typescript","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-syntax-typescript-7.2.0-55d240536bd314dcbbec70fd949c5cabaed1de29/node_modules/@babel/plugin-syntax-typescript/", {"name":"@babel/plugin-syntax-typescript","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-external-helpers-7.2.0-7f4cb7dee651cd380d2034847d914288467a6be4/node_modules/@babel/plugin-external-helpers/", {"name":"@babel/plugin-external-helpers","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-proposal-class-properties-7.4.0-d70db61a2f1fd79de927eea91f6411c964e084b8/node_modules/@babel/plugin-proposal-class-properties/", {"name":"@babel/plugin-proposal-class-properties","reference":"7.4.0"}],
  ["./.pnp/externals/pnp-14724cda3c3ac650e41a80edd910cdecbe601f04/node_modules/@babel/plugin-proposal-class-properties/", {"name":"@babel/plugin-proposal-class-properties","reference":"pnp:14724cda3c3ac650e41a80edd910cdecbe601f04"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-create-class-features-plugin-7.4.0-30fd090e059d021995c1762a5b76798fa0b51d82/node_modules/@babel/helper-create-class-features-plugin/", {"name":"@babel/helper-create-class-features-plugin","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-helper-create-class-features-plugin-7.4.4-fc3d690af6554cc9efc607364a82d48f58736dba/node_modules/@babel/helper-create-class-features-plugin/", {"name":"@babel/helper-create-class-features-plugin","reference":"7.4.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-runtime-7.4.0-b4d8c925ed957471bc57e0b9da53408ebb1ed457/node_modules/@babel/plugin-transform-runtime/", {"name":"@babel/plugin-transform-runtime","reference":"7.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-klaw-3.0.0-b11bec9cf2492f06756d6e809ab73a2910259146/node_modules/klaw/", {"name":"klaw","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rollup-1.10.0-91d594aa4386c51ca0883ad4ef2050b469d3e8aa/node_modules/rollup/", {"name":"rollup","reference":"1.10.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-estree-0.0.39-e177e699ee1b8c22d23174caaa7422644389509f/node_modules/@types/estree/", {"name":"@types/estree","reference":"0.0.39"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-11.13.5-266564afa8a6a09dc778dfacc703ed3f09c80516/node_modules/@types/node/", {"name":"@types/node","reference":"11.13.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-11.11.6-df929d1bb2eee5afdda598a41930fe50b43eaa6a/node_modules/@types/node/", {"name":"@types/node","reference":"11.11.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-10.14.3-170a81168620d931cc3b83460be253cadd3028f1/node_modules/@types/node/", {"name":"@types/node","reference":"10.14.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-node-12.0.8-551466be11b2adc3f3d47156758f610bd9f6b1d8/node_modules/@types/node/", {"name":"@types/node","reference":"12.0.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-6.1.1-7d25ae05bb8ad1f9b699108e1094ecd7884adc1f/node_modules/acorn/", {"name":"acorn","reference":"6.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-6.1.0-b0a3be31752c97a0f7013c5f4903b71a05db6818/node_modules/acorn/", {"name":"acorn","reference":"6.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-5.7.3-67aa231bf8812974b85235a96771eb6bd07ea279/node_modules/acorn/", {"name":"acorn","reference":"5.7.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sw-precache-5.2.1-06134f319eec68f3b9583ce9a7036b1c119f7179/node_modules/sw-precache/", {"name":"sw-precache","reference":"5.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-dom-urls-1.1.0-001ddf81628cd1e706125c7176f53ccec55d918e/node_modules/dom-urls/", {"name":"dom-urls","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-urijs-1.19.1-5b0ff530c0cbde8386f6342235ba5ca6e995d25a/node_modules/urijs/", {"name":"urijs","reference":"1.19.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-es6-promise-4.2.6-b685edd8258886365ea62b57d30de28fadcd974f/node_modules/es6-promise/", {"name":"es6-promise","reference":"4.2.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-es6-promise-4.2.5-da6d0d5692efb461e082c14817fe2427d8f5d054/node_modules/es6-promise/", {"name":"es6-promise","reference":"4.2.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-glob-7.1.3-3960832d3f1574108342dafd3a67b332c0969df1/node_modules/glob/", {"name":"glob","reference":"7.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fs-realpath-1.0.0-1504ad2523158caa40db4a2787cb01411994ea4f/node_modules/fs.realpath/", {"name":"fs.realpath","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-inflight-1.0.6-49bd6331d7d02d0c09bc910a1075ba8165b56df9/node_modules/inflight/", {"name":"inflight","reference":"1.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-minimatch-3.0.4-5166e286457f03306064be5497e8dbb0c3d32083/node_modules/minimatch/", {"name":"minimatch","reference":"3.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-brace-expansion-1.1.11-3c7fcbf529d87226f3d2f52b966ff5271eb441dd/node_modules/brace-expansion/", {"name":"brace-expansion","reference":"1.1.11"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-balanced-match-1.0.0-89b4d199ab2bee49de164ea02b89ce462d71b767/node_modules/balanced-match/", {"name":"balanced-match","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-concat-map-0.0.1-d8a96bd77fd68df7793a73036a3ba0d5405d477b/node_modules/concat-map/", {"name":"concat-map","reference":"0.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-defaults-4.2.0-d09178716ffea4dde9e5fb7b37f6f0802274580c/node_modules/lodash.defaults/", {"name":"lodash.defaults","reference":"4.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-template-4.4.0-e73a0385c8355591746e020b99679c690e68fba0/node_modules/lodash.template/", {"name":"lodash.template","reference":"4.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-reinterpolate-3.0.0-0ccf2d89166af03b3663c796538b75ac6e114d9d/node_modules/lodash._reinterpolate/", {"name":"lodash._reinterpolate","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-templatesettings-4.1.0-2b4d4e95ba440d915ff08bc899e4553666713316/node_modules/lodash.templatesettings/", {"name":"lodash.templatesettings","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-meow-3.7.0-72cb668b425228290abbfa856892587308a801fb/node_modules/meow/", {"name":"meow","reference":"3.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-loud-rejection-1.6.0-5b46f80147edee578870f086d04821cf998e551f/node_modules/loud-rejection/", {"name":"loud-rejection","reference":"1.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-currently-unhandled-0.4.1-988df33feab191ef799a61369dd76c17adf957ea/node_modules/currently-unhandled/", {"name":"currently-unhandled","reference":"0.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-array-find-index-1.0.2-df010aa1287e164bbda6f9723b0a96a1ec4187a1/node_modules/array-find-index/", {"name":"array-find-index","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pinkie-promise-2.0.1-2135d6dfa7a358c069ac9b178776288228450ffa/node_modules/pinkie-promise/", {"name":"pinkie-promise","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pinkie-2.0.4-72556b80cfa0d48a974e80e77248e80ed4f7f870/node_modules/pinkie/", {"name":"pinkie","reference":"2.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-utf8-0.2.1-4b0da1442104d1b336340e80797e865cf39f7d72/node_modules/is-utf8/", {"name":"is-utf8","reference":"0.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-repeating-2.0.1-5214c53a926d3552707527fbab415dbc08d06dda/node_modules/repeating/", {"name":"repeating","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-finite-1.0.2-cc6677695602be550ef11e8b4aa6305342b6d0aa/node_modules/is-finite/", {"name":"is-finite","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-get-stdin-4.0.1-b968c6b0a04384324902e8bf1a5df32579a450fe/node_modules/get-stdin/", {"name":"get-stdin","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mkdirp-0.5.1-30057438eac6cf7f8c4767f38648d6697d75c903/node_modules/mkdirp/", {"name":"mkdirp","reference":"0.5.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sw-toolbox-3.6.0-26df1d1c70348658e4dea2884319149b7b3183b5/node_modules/sw-toolbox/", {"name":"sw-toolbox","reference":"3.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-path-to-regexp-1.7.0-59fde0f435badacba103a84e9d3bc64e96b9937d/node_modules/path-to-regexp/", {"name":"path-to-regexp","reference":"1.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-serviceworker-cache-polyfill-4.0.0-de19ee73bef21ab3c0740a37b33db62464babdeb/node_modules/serviceworker-cache-polyfill/", {"name":"serviceworker-cache-polyfill","reference":"4.0.0"}],
  ["./packages/error/", {"name":"@quase/error","reference":"0.1.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-error-stack-parser-2.0.2-4ae8dbaa2bf90a8b450707b9149dcabca135520d/node_modules/error-stack-parser/", {"name":"error-stack-parser","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-stackframe-1.0.4-357b24a992f9427cba6b545d96a14ed2cbca187b/node_modules/stackframe/", {"name":"stackframe","reference":"1.0.4"}],
  ["./packages/fs/cacheable-fs/", {"name":"@quase/cacheable-fs","reference":"0.1.0-0"}],
  ["./packages/fs/find-files/", {"name":"@quase/find-files","reference":"0.1.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ignore-by-default-1.0.1-48ca6d72f6c6a3af00a9ad4ae6876be3889e2b09/node_modules/ignore-by-default/", {"name":"ignore-by-default","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-negated-glob-1.0.0-6910bca5da8c95e784b5751b976cf5a10fee36d2/node_modules/is-negated-glob/", {"name":"is-negated-glob","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-to-absolute-glob-2.0.2-1865f43d9e74b0822db9f145b78cff7d0f7c849b/node_modules/to-absolute-glob/", {"name":"to-absolute-glob","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-absolute-1.0.0-395e1ae84b11f26ad1795e73c17378e48a301576/node_modules/is-absolute/", {"name":"is-absolute","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-relative-1.0.0-a1bb6935ce8c5dba1e8b9754b9b2dcc020e2260d/node_modules/is-relative/", {"name":"is-relative","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-unc-path-1.0.0-d731e8898ed090a12c352ad2eaed5095ad322c9d/node_modules/is-unc-path/", {"name":"is-unc-path","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unc-path-regex-0.1.2-e73dd3d7b0d7c5ed86fbac6b0ae7d8c6a69d50fa/node_modules/unc-path-regex/", {"name":"unc-path-regex","reference":"0.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-zen-observable-0.8.13-a9f1b9dbdfd2d60a08761ceac6a861427d44ae2e/node_modules/zen-observable/", {"name":"zen-observable","reference":"0.8.13"}],
  ["./packages/languages/quase-lang/", {"name":"@quase/lang","reference":"0.1.0-0"}],
  ["./packages/package-manager/", {"name":"@quase/package-manager","reference":"0.1.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@zkochan-cmd-shim-3.1.0-2ab8ed81f5bb5452a85f25758eb9b8681982fd2e/node_modules/@zkochan/cmd-shim/", {"name":"@zkochan/cmd-shim","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mkdirp-promise-5.0.1-e9b8f68e552c68a9c1713b84883f7a1dd039b8a1/node_modules/mkdirp-promise/", {"name":"mkdirp-promise","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mz-2.7.0-95008057a56cafadc2bc63dde7f9ff6955948e32/node_modules/mz/", {"name":"mz","reference":"2.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-any-promise-1.3.0-abc6afeedcea52e809cdc0376aed3ce39635d17f/node_modules/any-promise/", {"name":"any-promise","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-thenify-all-1.6.0-1a1918d402d8fc3f98fbf234db0bcc8cc10e9726/node_modules/thenify-all/", {"name":"thenify-all","reference":"1.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-thenify-3.3.0-e69e38a1babe969b0108207978b9f62b88604839/node_modules/thenify/", {"name":"thenify","reference":"3.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cacheable-request-2.1.4-0d808801b6342ad33c91df9d0b44dc09b91e5c3d/node_modules/cacheable-request/", {"name":"cacheable-request","reference":"2.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cacheable-request-6.0.0-4a1727414e02ac4af82560c4da1b61daa3fa2b63/node_modules/cacheable-request/", {"name":"cacheable-request","reference":"6.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-clone-response-1.0.2-d1dc973920314df67fbeb94223b4ee350239e96b/node_modules/clone-response/", {"name":"clone-response","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mimic-response-1.0.1-4923538878eef42063cb8a3e3b0798781487ab1b/node_modules/mimic-response/", {"name":"mimic-response","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-http-cache-semantics-3.8.1-39b0e16add9b605bf0a9ef3d9daaf4843b4cacd2/node_modules/http-cache-semantics/", {"name":"http-cache-semantics","reference":"3.8.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-http-cache-semantics-4.0.3-495704773277eeef6e43f9ab2c2c7d259dda25c5/node_modules/http-cache-semantics/", {"name":"http-cache-semantics","reference":"4.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-keyv-3.0.0-44923ba39e68b12a7cec7df6c3268c031f2ef373/node_modules/keyv/", {"name":"keyv","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-keyv-3.1.0-ecc228486f69991e49e9476485a5be1e8fc5c4d9/node_modules/keyv/", {"name":"keyv","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json-buffer-3.0.0-5b1f397afc75d677bde8bcfc0e47e1f9a3d9a898/node_modules/json-buffer/", {"name":"json-buffer","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-normalize-url-2.0.1-835a9da1551fa26f70e92329069a23aa6574d7e6/node_modules/normalize-url/", {"name":"normalize-url","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-normalize-url-3.3.0-b2e1c4dc4f7c6d57743df733a4f5978d18650559/node_modules/normalize-url/", {"name":"normalize-url","reference":"3.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-query-string-5.1.1-a78c012b71c17e05f2e3fa2319dd330682efb3cb/node_modules/query-string/", {"name":"query-string","reference":"5.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-strict-uri-encode-1.1.0-279b225df1d582b1f54e65addd4352e18faa0713/node_modules/strict-uri-encode/", {"name":"strict-uri-encode","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sort-keys-2.0.0-658535584861ec97d730d6cf41822e1f56684128/node_modules/sort-keys/", {"name":"sort-keys","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-plain-obj-1.1.0-71a50c8429dfca773c92a390a4a03b39fcd51d3e/node_modules/is-plain-obj/", {"name":"is-plain-obj","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-responselike-1.0.2-918720ef3b631c5642be068f15ade5a46f4ba1e7/node_modules/responselike/", {"name":"responselike","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-decompress-response-3.3.0-80a4dd323748384bfa248083622aedec982adff3/node_modules/decompress-response/", {"name":"decompress-response","reference":"3.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-into-stream-3.1.0-96fb0a936c12babd6ff1752a17d05616abd094c6/node_modules/into-stream/", {"name":"into-stream","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-from2-2.3.0-8bfb5502bde4a4d36cfdeea007fcca21d7e382af/node_modules/from2/", {"name":"from2","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isurl-1.0.0-b27f4f49f3cdaa3ea44a0a5b7f3462e6edc39d67/node_modules/isurl/", {"name":"isurl","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-to-string-tag-x-1.4.1-a045ab383d7b4b2012a00148ab0aa5f290044d4d/node_modules/has-to-string-tag-x/", {"name":"has-to-string-tag-x","reference":"1.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-symbol-support-x-1.4.2-1409f98bc00247da45da67cee0a36f282ff26455/node_modules/has-symbol-support-x/", {"name":"has-symbol-support-x","reference":"1.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-object-1.0.1-8952688c5ec2ffd6b03ecc85e769e02903083470/node_modules/is-object/", {"name":"is-object","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-cancelable-0.4.1-35f363d67d52081c8d9585e37bcceb7e0bbcb2a0/node_modules/p-cancelable/", {"name":"p-cancelable","reference":"0.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-cancelable-1.1.0-d078d15a3af409220c886f1d9a0ca2e441ab26cc/node_modules/p-cancelable/", {"name":"p-cancelable","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-timeout-2.0.1-d8dd1979595d2dc0139e1fe46b8b646cb3cdf038/node_modules/p-timeout/", {"name":"p-timeout","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-timeout-3.0.0-1bbd42db28c669efd02e1a82ccf14dc59eb57ed1/node_modules/p-timeout/", {"name":"p-timeout","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-url-to-options-1.0.1-1505a03a289a48cbd7a434efbaeec5055f5633a9/node_modules/url-to-options/", {"name":"url-to-options","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-package-arg-6.1.0-15ae1e2758a5027efb4c250554b85a737db7fcc1/node_modules/npm-package-arg/", {"name":"npm-package-arg","reference":"6.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-osenv-0.1.5-85cdfafaeb28e8677f416e287592b5f3f49ea410/node_modules/osenv/", {"name":"osenv","reference":"0.1.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-os-homedir-1.0.2-ffbc4988336e0e833de0c168c7ef152121aa7fb3/node_modules/os-homedir/", {"name":"os-homedir","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-os-tmpdir-1.0.2-bbe67406c79aa85c5cfec766fe5734555dfa1274/node_modules/os-tmpdir/", {"name":"os-tmpdir","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-validate-npm-package-name-3.0.0-5fa912d81eb7d0c74afc140de7317f0ca7df437e/node_modules/validate-npm-package-name/", {"name":"validate-npm-package-name","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-builtins-1.0.3-cb94faeb61c8696451db36534e1422f94f0aee88/node_modules/builtins/", {"name":"builtins","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pacote-9.5.0-85f3013a3f6dd51c108b0ccabd3de8102ddfaeda/node_modules/pacote/", {"name":"pacote","reference":"9.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-bluebird-3.5.3-7d01c6f9616c9a51ab0f8c549a79dfe6ec33efa7/node_modules/bluebird/", {"name":"bluebird","reference":"3.5.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cacache-11.3.2-2d81e308e3d258ca38125b676b98b2ac9ce69bfa/node_modules/cacache/", {"name":"cacache","reference":"11.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chownr-1.1.1-54726b8b8fff4df053c42187e801fb4412df1494/node_modules/chownr/", {"name":"chownr","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-figgy-pudding-3.5.1-862470112901c727a0e495a80744bd5baa1d6790/node_modules/figgy-pudding/", {"name":"figgy-pudding","reference":"3.5.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mississippi-3.0.0-ea0a3291f97e0b5e8776b363d5f0a12d94c67022/node_modules/mississippi/", {"name":"mississippi","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-concat-stream-1.6.2-904bdf194cd3122fc675c77fc4ac3d4ff0fd1a34/node_modules/concat-stream/", {"name":"concat-stream","reference":"1.6.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-buffer-from-1.1.1-32713bc028f75c02fdb710d7c7bcec1f2c6070ef/node_modules/buffer-from/", {"name":"buffer-from","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-typedarray-0.0.6-867ac74e3864187b1d3d47d996a78ec5c8830777/node_modules/typedarray/", {"name":"typedarray","reference":"0.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-duplexify-3.7.1-2a4df5317f6ccfd91f86d6fd25d8d8a103b88309/node_modules/duplexify/", {"name":"duplexify","reference":"3.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-stream-shift-1.0.0-d5c752825e5367e786f78e18e445ea223a155952/node_modules/stream-shift/", {"name":"stream-shift","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-flush-write-stream-1.1.1-8dd7d873a1babc207d94ead0c2e0e44276ebf2e8/node_modules/flush-write-stream/", {"name":"flush-write-stream","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parallel-transform-1.1.0-d410f065b05da23081fcd10f28854c29bda33b06/node_modules/parallel-transform/", {"name":"parallel-transform","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cyclist-0.2.2-1b33792e11e914a2fd6d6ed6447464444e5fa640/node_modules/cyclist/", {"name":"cyclist","reference":"0.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pumpify-1.5.1-36513be246ab27570b1a374a5ce278bfd74370ce/node_modules/pumpify/", {"name":"pumpify","reference":"1.5.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-stream-each-1.2.3-ebe27a0c389b04fbcc233642952e10731afa9bae/node_modules/stream-each/", {"name":"stream-each","reference":"1.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-through2-2.0.5-01c1e39eb31d07cb7d03a96a70823260b23132cd/node_modules/through2/", {"name":"through2","reference":"2.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-xtend-4.0.1-a5c6d532be656e23db820efb943a1f04998d63af/node_modules/xtend/", {"name":"xtend","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-move-concurrently-1.0.1-be2c005fda32e0b29af1f05d7c4b33214c701f92/node_modules/move-concurrently/", {"name":"move-concurrently","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-aproba-1.2.0-6802e6264efd18c790a1b0d517f0f2627bf2c94a/node_modules/aproba/", {"name":"aproba","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-copy-concurrently-1.0.5-92297398cae34937fcafd6ec8139c18051f0b5e0/node_modules/copy-concurrently/", {"name":"copy-concurrently","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fs-write-stream-atomic-1.0.10-b47df53493ef911df75731e70a9ded0189db40c9/node_modules/fs-write-stream-atomic/", {"name":"fs-write-stream-atomic","reference":"1.0.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-iferr-0.1.5-c60eed69e6d8fdb6b3104a1fcbca1c192dc5b501/node_modules/iferr/", {"name":"iferr","reference":"0.1.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rimraf-2.6.3-b2d104fe0d8fb27cf9e0a1cda8262dd3833c6cab/node_modules/rimraf/", {"name":"rimraf","reference":"2.6.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-run-queue-1.0.3-e848396f057d223f24386924618e25694161ec47/node_modules/run-queue/", {"name":"run-queue","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-promise-inflight-1.0.1-98472870bf228132fcbdd868129bad12c3c029e3/node_modules/promise-inflight/", {"name":"promise-inflight","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ssri-6.0.1-2a3c41b28dd45b62b63676ecb74001265ae9edd8/node_modules/ssri/", {"name":"ssri","reference":"6.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unique-filename-1.1.1-1d69769369ada0583103a1e6ae87681b56573230/node_modules/unique-filename/", {"name":"unique-filename","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-unique-slug-2.0.1-5e9edc6d1ce8fb264db18a507ef9bd8544451ca6/node_modules/unique-slug/", {"name":"unique-slug","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-make-fetch-happen-4.0.1-141497cb878f243ba93136c83d8aba12c216c083/node_modules/make-fetch-happen/", {"name":"make-fetch-happen","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-agentkeepalive-3.5.2-a113924dd3fa24a0bc3b78108c450c2abee00f67/node_modules/agentkeepalive/", {"name":"agentkeepalive","reference":"3.5.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-humanize-ms-1.2.1-c46e3159a293f6b896da29316d8b6fe8bb79bbed/node_modules/humanize-ms/", {"name":"humanize-ms","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-http-proxy-agent-2.1.0-e4821beef5b2142a2026bd73926fe537631c5405/node_modules/http-proxy-agent/", {"name":"http-proxy-agent","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-agent-base-4.2.1-d89e5999f797875674c07d87f260fc41e83e8ca9/node_modules/agent-base/", {"name":"agent-base","reference":"4.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-es6-promisify-5.0.0-5109d62f3e56ea967c4b63505aef08291c8a5203/node_modules/es6-promisify/", {"name":"es6-promisify","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-https-proxy-agent-2.2.1-51552970fa04d723e04c56d04178c3f92592bbc0/node_modules/https-proxy-agent/", {"name":"https-proxy-agent","reference":"2.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-fetch-npm-2.0.2-7258c9046182dca345b4208eda918daf33697ff7/node_modules/node-fetch-npm/", {"name":"node-fetch-npm","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-encoding-0.1.12-538b66f3ee62cd1ab51ec323829d1f9480c74beb/node_modules/encoding/", {"name":"encoding","reference":"0.1.12"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-iconv-lite-0.4.24-2022b4b25fbddc21d2f524974a474aafe733908b/node_modules/iconv-lite/", {"name":"iconv-lite","reference":"0.4.24"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-safer-buffer-2.1.2-44fa161b0187b9549dd84bb91802f9bd8385cd6a/node_modules/safer-buffer/", {"name":"safer-buffer","reference":"2.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-promise-retry-1.1.1-6739e968e3051da20ce6497fb2b50f6911df3d6d/node_modules/promise-retry/", {"name":"promise-retry","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-err-code-1.1.2-06e0116d3028f6aef4806849eb0ea6a748ae6960/node_modules/err-code/", {"name":"err-code","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-retry-0.10.1-e76388d217992c252750241d3d3956fed98d8ff4/node_modules/retry/", {"name":"retry","reference":"0.10.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-socks-proxy-agent-4.0.1-5936bf8b707a993079c6f37db2091821bffa6473/node_modules/socks-proxy-agent/", {"name":"socks-proxy-agent","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-socks-2.2.3-7399ce11e19b2a997153c983a9ccb6306721f2dc/node_modules/socks/", {"name":"socks","reference":"2.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ip-1.1.5-bdded70114290828c0a039e72ef25f5aaec4354a/node_modules/ip/", {"name":"ip","reference":"1.1.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-smart-buffer-4.0.2-5207858c3815cc69110703c6b94e46c15634395d/node_modules/smart-buffer/", {"name":"smart-buffer","reference":"4.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-minipass-2.3.5-cacebe492022497f656b0f0f51e2682a9ed2d848/node_modules/minipass/", {"name":"minipass","reference":"2.3.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-packlist-1.3.0-7f01e8e44408341379ca98cfd756e7b29bd2626c/node_modules/npm-packlist/", {"name":"npm-packlist","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ignore-walk-3.0.1-a83e62e7d272ac0e3b551aaa82831a19b69f82f8/node_modules/ignore-walk/", {"name":"ignore-walk","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-bundled-1.0.6-e7ba9aadcef962bb61248f91721cd932b3fe6bdd/node_modules/npm-bundled/", {"name":"npm-bundled","reference":"1.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-pick-manifest-2.2.3-32111d2a9562638bb2c8f2bf27f7f3092c8fae40/node_modules/npm-pick-manifest/", {"name":"npm-pick-manifest","reference":"2.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-registry-fetch-3.9.0-44d841780e2833f06accb34488f8c7450d1a6856/node_modules/npm-registry-fetch/", {"name":"npm-registry-fetch","reference":"3.9.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tream-1.3.5-3208c1f08d3a4d99261ab64f92302bc15e111ca0/node_modules/JSONStream/", {"name":"JSONStream","reference":"1.3.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsonparse-1.3.1-3f4dae4a91fac315f71062f8521cc239f1366280/node_modules/jsonparse/", {"name":"jsonparse","reference":"1.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-through-2.3.8-0dd4c9ffaabc357960b1b724115d7e0e86a2e1f5/node_modules/through/", {"name":"through","reference":"2.3.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-protoduck-5.0.1-03c3659ca18007b69a50fd82a7ebcc516261151f/node_modules/protoduck/", {"name":"protoduck","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-genfun-5.0.0-9dd9710a06900a5c4a5bf57aca5da4e52fe76537/node_modules/genfun/", {"name":"genfun","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tar-4.4.8-b19eec3fde2a96e64666df9fdb40c5ca1bc3747d/node_modules/tar/", {"name":"tar","reference":"4.4.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fs-minipass-1.2.5-06c277218454ec288df77ada54a03b8702aacb9d/node_modules/fs-minipass/", {"name":"fs-minipass","reference":"1.2.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-minizlib-1.2.1-dd27ea6136243c7c880684e8672bb3a45fd9b614/node_modules/minizlib/", {"name":"minizlib","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-symlink-dir-1.1.3-b09af9599af5310c2fb77adc0c1613dee382ce4e/node_modules/symlink-dir/", {"name":"symlink-dir","reference":"1.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-mz-0.0.32-e8248b4e41424c052edc1725dd33650c313a3659/node_modules/@types/mz/", {"name":"@types/mz","reference":"0.0.32"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-write-json-file-2.3.0-2b64c8a33004d54b8698c76d585a77ceb61da32f/node_modules/write-json-file/", {"name":"write-json-file","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-detect-indent-5.0.0-3871cc0a6a002e8c3e5b3cf7f336264675f06b9d/node_modules/detect-indent/", {"name":"detect-indent","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-write-pkg-3.2.0-0e178fe97820d389a8928bc79535dbe68c2cff21/node_modules/write-pkg/", {"name":"write-pkg","reference":"3.2.0"}],
  ["./packages/pathname/", {"name":"@quase/pathname","reference":"0.1.0-0"}],
  ["./packages/publisher/", {"name":"@quase/publisher","reference":"0.1.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@samverschueren-stream-to-observable-0.3.0-ecdf48d532c58ea477acfcab80348424f8d0662f/node_modules/@samverschueren/stream-to-observable/", {"name":"@samverschueren/stream-to-observable","reference":"0.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-any-observable-0.3.0-af933475e5806a67d0d7df090dd5e8bef65d119b/node_modules/any-observable/", {"name":"any-observable","reference":"0.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-del-4.0.0-4fa27e92c366cb45b9bdaa56a9b8703dced17437/node_modules/del/", {"name":"del","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-globby-6.1.0-f5a6d70e8395e21c858fb0489d64df02424d506c/node_modules/globby/", {"name":"globby","reference":"6.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-globby-8.0.2-5697619ccd95c5275dbb2d6faa42087c1a941d8d/node_modules/globby/", {"name":"globby","reference":"8.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-array-union-1.0.2-9a34410e4f4e3da23dea375be5be70f24778ec39/node_modules/array-union/", {"name":"array-union","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-array-uniq-1.0.3-af6ac877a25cc7f74e058894753858dfdb24fdb6/node_modules/array-uniq/", {"name":"array-uniq","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-path-cwd-2.0.0-d4777a8e227a00096a31f030db3770f84b116c02/node_modules/is-path-cwd/", {"name":"is-path-cwd","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-path-in-cwd-2.0.0-68e452a6eec260500cec21e029c0a44cc0dcd2ea/node_modules/is-path-in-cwd/", {"name":"is-path-in-cwd","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-map-2.0.0-be18c5a5adeb8e156460651421aceca56c213a50/node_modules/p-map/", {"name":"p-map","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-github-url-from-git-1.5.0-f985fedcc0a9aa579dc88d7aff068d55cc6251a0/node_modules/github-url-from-git/", {"name":"github-url-from-git","reference":"1.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-inquirer-6.2.2-46941176f65c9eb20804627149b743a218f25406/node_modules/inquirer/", {"name":"inquirer","reference":"6.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-inquirer-3.3.0-9dd2f2ad765dcab1ff0443b491442a20ba227dc9/node_modules/inquirer/", {"name":"inquirer","reference":"3.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ansi-escapes-3.2.0-8780b98ff9dbf5638152d1f1fe5c1d7b4442976b/node_modules/ansi-escapes/", {"name":"ansi-escapes","reference":"3.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-width-2.2.0-ff19ede8a9a5e579324147b0c11f0fbcbabed639/node_modules/cli-width/", {"name":"cli-width","reference":"2.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-external-editor-3.0.3-5866db29a97826dbe4bf3afd24070ead9ea43a27/node_modules/external-editor/", {"name":"external-editor","reference":"3.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-external-editor-2.2.0-045511cfd8d133f3846673d1047c154e214ad3d5/node_modules/external-editor/", {"name":"external-editor","reference":"2.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chardet-0.7.0-90094849f0937f2eedc2425d0d28a9e5f0cbad9e/node_modules/chardet/", {"name":"chardet","reference":"0.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-chardet-0.4.2-b5473b33dc97c424e5d98dc87d55d4d8a29c8bf2/node_modules/chardet/", {"name":"chardet","reference":"0.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tmp-0.0.33-6d34335889768d21b2bcda0aa277ced3b1bfadf9/node_modules/tmp/", {"name":"tmp","reference":"0.0.33"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tmp-0.0.31-8f38ab9438e17315e5dbd8b3657e8bfb277ae4a7/node_modules/tmp/", {"name":"tmp","reference":"0.0.31"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-figures-2.0.0-3ab1a2d2a62c8bfb431a0c94cb797a2fce27c962/node_modules/figures/", {"name":"figures","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-figures-1.7.0-cbe1e3affcf1cd44b80cadfed28dc793a9701d2e/node_modules/figures/", {"name":"figures","reference":"1.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mute-stream-0.0.7-3075ce93bc21b8fab43e1bc4da7e8115ed1e7bab/node_modules/mute-stream/", {"name":"mute-stream","reference":"0.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-run-async-2.3.0-0371ab4ae0bdd720d4166d7dfda64ff7a445a6c0/node_modules/run-async/", {"name":"run-async","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-promise-2.1.0-79a2a9ece7f096e80f36d2b2f3bc16c1ff4bf3fa/node_modules/is-promise/", {"name":"is-promise","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rxjs-6.4.0-f3bb0fe7bda7fb69deac0c16f17b50b0b8790504/node_modules/rxjs/", {"name":"rxjs","reference":"6.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rxjs-5.5.12-6fa61b8a77c3d793dbaf270bee2f43f652d741cc/node_modules/rxjs/", {"name":"rxjs","reference":"5.5.12"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tslib-1.9.3-d7e4dd79245d85428c4d7e4822a79917954ca286/node_modules/tslib/", {"name":"tslib","reference":"1.9.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-issue-regex-3.0.0-275c5dac460e7827819f749747baf686109695b7/node_modules/issue-regex/", {"name":"issue-regex","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-npm-name-5.2.0-652e53c2b007d4cc0a685014885ca478d7886f6a/node_modules/npm-name/", {"name":"npm-name","reference":"5.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@szmarczak-http-timer-1.1.2-b1665e2c461a2cd92f4c1bbf50d5454de0d4b421/node_modules/@szmarczak/http-timer/", {"name":"@szmarczak/http-timer","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-defer-to-connect-1.0.2-4bae758a314b034ae33902b5aac25a8dd6a8633e/node_modules/defer-to-connect/", {"name":"defer-to-connect","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-to-readable-stream-1.0.0-ce0aa0c2f3df6adf852efb404a783e77c0475771/node_modules/to-readable-stream/", {"name":"to-readable-stream","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-scoped-1.0.0-449ca98299e713038256289ecb2b540dc437cb30/node_modules/is-scoped/", {"name":"is-scoped","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-scoped-regex-1.0.0-a346bb1acd4207ae70bd7c0c7ca9e566b6baddb8/node_modules/scoped-regex/", {"name":"scoped-regex","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-zip-4.2.0-ec6662e4896408ed4ab6c542a3990b72cc080020/node_modules/lodash.zip/", {"name":"lodash.zip","reference":"4.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pretty-version-diff-1.0.0-d9a0a3acc1a1332366a8da2f85c8bbf62724652d/node_modules/pretty-version-diff/", {"name":"pretty-version-diff","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-listr-0.14.3-2fea909604e434be464c50bddba0d496928fa586/node_modules/listr/", {"name":"listr","reference":"0.14.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-observable-1.1.0-b3e986c8f44de950867cab5403f5a3465005975e/node_modules/is-observable/", {"name":"is-observable","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-symbol-observable-1.2.0-c22688aed4eab3cdc2dfeacbb561660560a00804/node_modules/symbol-observable/", {"name":"symbol-observable","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-symbol-observable-1.0.1-8340fc4702c3122df5d22288f88283f513d3fdd4/node_modules/symbol-observable/", {"name":"symbol-observable","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-listr-silent-renderer-1.1.1-924b5a3757153770bf1a8e3fbf74b8bbf3f9242e/node_modules/listr-silent-renderer/", {"name":"listr-silent-renderer","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-listr-update-renderer-0.5.0-4ea8368548a7b8aecb7e06d8c95cb45ae2ede6a2/node_modules/listr-update-renderer/", {"name":"listr-update-renderer","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-ansi-2.0.0-34f5049ce1ecdf2b0649af3ef24e45ed35416d91/node_modules/has-ansi/", {"name":"has-ansi","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cli-truncate-0.2.1-9f15cfbb0705005369216c626ac7d05ab90dd574/node_modules/cli-truncate/", {"name":"cli-truncate","reference":"0.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-slice-ansi-0.0.4-edbf8903f66f7ce2f8eafd6ceed65e264c831b35/node_modules/slice-ansi/", {"name":"slice-ansi","reference":"0.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-slice-ansi-2.1.0-cacd7693461a637a5788d92a7dd4fba068e81636/node_modules/slice-ansi/", {"name":"slice-ansi","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-elegant-spinner-1.0.1-db043521c95d7e303fd8f345bedc3349cfb0729e/node_modules/elegant-spinner/", {"name":"elegant-spinner","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-log-update-2.3.0-88328fd7d1ce7938b29283746f0b1bc126b24708/node_modules/log-update/", {"name":"log-update","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-listr-verbose-renderer-0.5.0-f1132167535ea4c1261102b9f28dac7cba1e03db/node_modules/listr-verbose-renderer/", {"name":"listr-verbose-renderer","reference":"0.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-date-fns-1.30.1-2e71bf0b119153dbb4cc4e88d9ea5acfb50dc05c/node_modules/date-fns/", {"name":"date-fns","reference":"1.30.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-listr-input-0.1.3-0c313967b6d179ebe964a81e9363ce2a5a39d25c/node_modules/listr-input/", {"name":"listr-input","reference":"0.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rx-lite-4.0.8-0b1e11af8bc44836f04a6407e92da42467b79444/node_modules/rx-lite/", {"name":"rx-lite","reference":"4.0.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rx-lite-aggregates-4.0.8-753b87a89a11c95467c4ac1626c4efc4e05c67be/node_modules/rx-lite-aggregates/", {"name":"rx-lite-aggregates","reference":"4.0.8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-split-1.0.1-605bd9be303aa59fb35f9229fbea0ddec9ea07d9/node_modules/split/", {"name":"split","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-terminal-link-1.2.0-ed1ac495da75a8c3eadc8a5db985226e451edffd/node_modules/terminal-link/", {"name":"terminal-link","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-supports-hyperlinks-1.0.1-71daedf36cc1060ac5100c351bb3da48c29c0ef7/node_modules/supports-hyperlinks/", {"name":"supports-hyperlinks","reference":"1.0.1"}],
  ["./packages/unit/", {"name":"@quase/unit","reference":"0.1.0-0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-circular-json-0.5.9-932763ae88f4f7dead7a0d09c8a51a4743a53b1d/node_modules/circular-json/", {"name":"circular-json","reference":"0.5.9"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-concordance-3.0.0-b2286af54405fc995fc7345b0b106d8dd073cb29/node_modules/concordance/", {"name":"concordance","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-date-time-2.1.0-0286d1b4c769633b3ca13e1e62558d2dbdc2eba2/node_modules/date-time/", {"name":"date-time","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-time-zone-1.0.0-99c5bf55958966af6d06d83bdf3800dc82faec5d/node_modules/time-zone/", {"name":"time-zone","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fast-diff-1.2.0-73ee11982d86caaf7959828d519cfe927fac5f03/node_modules/fast-diff/", {"name":"fast-diff","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-function-name-support-0.2.0-55d3bfaa6eafd505a50f9bc81fdf57564a0bb071/node_modules/function-name-support/", {"name":"function-name-support","reference":"0.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-js-string-escape-1.0.1-e2625badbc0d67c7533e9edc1068c587ae4137ef/node_modules/js-string-escape/", {"name":"js-string-escape","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-clonedeep-4.5.0-e23f3f9c4f8fbdde872529c1071857a086e5ccef/node_modules/lodash.clonedeep/", {"name":"lodash.clonedeep","reference":"4.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-flattendeep-4.4.0-fb030917f86a3134e5bc9bec0d69e0013ddfedb2/node_modules/lodash.flattendeep/", {"name":"lodash.flattendeep","reference":"4.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-merge-4.6.1-adc25d9cb99b9391c59624f379fbba60d7111d54/node_modules/lodash.merge/", {"name":"lodash.merge","reference":"4.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-md5-hex-2.0.0-d0588e9f1c74954492ecd24ac0ac6ce997d92e33/node_modules/md5-hex/", {"name":"md5-hex","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-md5-o-matic-0.1.1-822bccd65e117c514fab176b25945d54100a03c3/node_modules/md5-o-matic/", {"name":"md5-o-matic","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-well-known-symbols-1.0.0-73c78ae81a7726a8fa598e2880801c8b16225518/node_modules/well-known-symbols/", {"name":"well-known-symbols","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-dir-glob-2.0.0-0b205d2b6aef98238ca286598a8204d29d0a0034/node_modules/dir-glob/", {"name":"dir-glob","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-arrify-1.0.1-898508da2226f380df904728456849c1501a4b0d/node_modules/arrify/", {"name":"arrify","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fast-glob-2.2.6-a5d5b697ec8deda468d85a74035290a025a95295/node_modules/fast-glob/", {"name":"fast-glob","reference":"2.2.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@mrmlnc-readdir-enhanced-2.2.1-524af240d1a360527b730475ecfa1344aa540dde/node_modules/@mrmlnc/readdir-enhanced/", {"name":"@mrmlnc/readdir-enhanced","reference":"2.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-call-me-maybe-1.0.1-26d208ea89e37b5cbde60250a15f031c16a4d66b/node_modules/call-me-maybe/", {"name":"call-me-maybe","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-glob-to-regexp-0.3.0-8c5a1494d2066c570cc3bfe4496175acc4d502ab/node_modules/glob-to-regexp/", {"name":"glob-to-regexp","reference":"0.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@nodelib-fs-stat-1.1.3-2b5a3ab3f918cca48a8c754c08168e3f03eba61b/node_modules/@nodelib/fs.stat/", {"name":"@nodelib/fs.stat","reference":"1.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-merge2-1.2.3-7ee99dbd69bb6481689253f018488a1b902b0ed5/node_modules/merge2/", {"name":"merge2","reference":"1.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ignore-3.3.10-0a97fb876986e8081c631160f8f9f389157f0043/node_modules/ignore/", {"name":"ignore","reference":"3.3.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ignore-5.0.5-c663c548d6ce186fb33616a8ccb5d46e56bdbbf9/node_modules/ignore/", {"name":"ignore","reference":"5.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ignore-4.0.6-750e3db5862087b4737ebac8207ffd1ef27b25fc/node_modules/ignore/", {"name":"ignore","reference":"4.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ignore-5.1.2-e28e584d43ad7e92f96995019cc43b9e1ac49558/node_modules/ignore/", {"name":"ignore","reference":"5.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-import-fresh-2.0.0-d81355c15612d386c61f9ddd3922d4304822a546/node_modules/import-fresh/", {"name":"import-fresh","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-import-fresh-3.0.0-a3d897f420cab0e671236897f75bc14b4885c390/node_modules/import-fresh/", {"name":"import-fresh","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-caller-path-2.0.0-468f83044e369ab2010fac5f06ceee15bb2cb1f4/node_modules/caller-path/", {"name":"caller-path","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-caller-callsite-2.0.0-847e0fce0a223750a9a027c54b33731ad3154134/node_modules/caller-callsite/", {"name":"caller-callsite","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-callsites-2.0.0-06eb84f00eea413da86affefacbffb36093b3c50/node_modules/callsites/", {"name":"callsites","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-callsites-3.0.0-fb7eb569b72ad7a45812f93fd9430a3e410b3dd3/node_modules/callsites/", {"name":"callsites","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-matcher-1.1.1-51d8301e138f840982b338b116bb0c09af62c1c2/node_modules/matcher/", {"name":"matcher","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-random-js-1.0.8-968fd689a6f25d6c0aac766283de2f688c9c190a/node_modules/random-js/", {"name":"random-js","reference":"1.0.8"}],
  ["./packages/view/", {"name":"@quase/view","reference":"0.1.0"}],
  ["./.pnp/workspaces/pnp-f6c2e49fe52de5adc21cf52765acc9aa2dc1178b/@quase/view/", {"name":"@quase/view","reference":"pnp:f6c2e49fe52de5adc21cf52765acc9aa2dc1178b"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-syntax-jsx-7.2.0-0b85a3b4bc7cdf4cc4b8bf236335b907ca22e7c7/node_modules/@babel/plugin-syntax-jsx/", {"name":"@babel/plugin-syntax-jsx","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-he-1.2.0-84ae65fa7eafb165fddb61566ae14baf05664f0f/node_modules/he/", {"name":"he","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsdom-15.1.1-21ed01f81d95ef4327f3e564662aef5e65881252/node_modules/jsdom/", {"name":"jsdom","reference":"15.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsdom-11.12.0-1a80d40ddd378a1de59656e9e6dc5a3ba8657bc8/node_modules/jsdom/", {"name":"jsdom","reference":"11.12.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-abab-2.0.0-aba0ab4c5eee2d4c79d3487d85450fb2376ebb0f/node_modules/abab/", {"name":"abab","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-globals-4.3.2-4e2c2313a597fd589720395f6354b41cd5ec8006/node_modules/acorn-globals/", {"name":"acorn-globals","reference":"4.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-globals-4.3.0-e3b6f8da3c1552a95ae627571f7dd6923bb54103/node_modules/acorn-globals/", {"name":"acorn-globals","reference":"4.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-walk-6.1.1-d363b66f5fac5f018ff9c3a1e7b6f8e310cc3913/node_modules/acorn-walk/", {"name":"acorn-walk","reference":"6.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-array-equal-1.0.0-8c2a5ef2472fd9ea742b04c77a75093ba2757c93/node_modules/array-equal/", {"name":"array-equal","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cssom-0.3.6-f85206cee04efa841f3c5982a74ba96ab20d65ad/node_modules/cssom/", {"name":"cssom","reference":"0.3.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cssstyle-1.2.2-427ea4d585b18624f6fdbf9de7a2a1a3ba713077/node_modules/cssstyle/", {"name":"cssstyle","reference":"1.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-cssstyle-1.1.1-18b038a9c44d65f7a8e428a653b9f6fe42faf5fb/node_modules/cssstyle/", {"name":"cssstyle","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-data-urls-1.1.0-15ee0582baa5e22bb59c77140da8f9c76963bbfe/node_modules/data-urls/", {"name":"data-urls","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-mimetype-2.3.0-3d4b1e0312d2079879f826aff18dbeeca5960fbf/node_modules/whatwg-mimetype/", {"name":"whatwg-mimetype","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-domexception-1.0.1-937442644ca6a31261ef36e3ec677fe805582c90/node_modules/domexception/", {"name":"domexception","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-escodegen-1.11.1-c485ff8d6b4cdb89e27f4a856e91f118401ca510/node_modules/escodegen/", {"name":"escodegen","reference":"1.11.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-escodegen-1.11.0-b27a9389481d5bfd5bec76f7bb1eb3f8f4556589/node_modules/escodegen/", {"name":"escodegen","reference":"1.11.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-esprima-3.1.3-fdca51cee6133895e3c88d535ce49dbff62a4633/node_modules/esprima/", {"name":"esprima","reference":"3.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-esprima-4.0.1-13b04cdb3e6c5d19df91ab6987a8695619b0aa71/node_modules/esprima/", {"name":"esprima","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-estraverse-4.2.0-0dee3fed31fcd469618ce7342099fc1afa0bdb13/node_modules/estraverse/", {"name":"estraverse","reference":"4.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-optionator-0.8.2-364c5e409d3f4d6301d6c0b4c05bba50180aeb64/node_modules/optionator/", {"name":"optionator","reference":"0.8.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-deep-is-0.1.3-b369d6fb5dbc13eecf524f91b070feedc357cf34/node_modules/deep-is/", {"name":"deep-is","reference":"0.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fast-levenshtein-2.0.6-3d8a5c66883a16a30ca8643e851f19baa7797917/node_modules/fast-levenshtein/", {"name":"fast-levenshtein","reference":"2.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-levn-0.3.0-3b09924edf9f083c0490fdd4c0bc4421e04764ee/node_modules/levn/", {"name":"levn","reference":"0.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-prelude-ls-1.1.2-21932a549f5e52ffd9a827f570e04be62a97da54/node_modules/prelude-ls/", {"name":"prelude-ls","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-type-check-0.3.2-5884cab512cf1d355e3fb784f30804b2b520db72/node_modules/type-check/", {"name":"type-check","reference":"0.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-wordwrap-1.0.0-27584810891456a4171c8d0226441ade90cbcaeb/node_modules/wordwrap/", {"name":"wordwrap","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-wordwrap-0.0.3-a3d5da6cd5c0bc0008d37234bbaf1bed63059107/node_modules/wordwrap/", {"name":"wordwrap","reference":"0.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-html-encoding-sniffer-1.0.2-e70d84b94da53aa375e11fe3a351be6642ca46f8/node_modules/html-encoding-sniffer/", {"name":"html-encoding-sniffer","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-whatwg-encoding-1.0.5-5abacf777c32166a51d085d6b4f3e7d27113ddb0/node_modules/whatwg-encoding/", {"name":"whatwg-encoding","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-nwsapi-2.1.4-e006a878db23636f8e8a67d33ca0e4edf61a842f/node_modules/nwsapi/", {"name":"nwsapi","reference":"2.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-nwsapi-2.1.0-781065940aed90d9bb01ca5d0ce0fcf81c32712f/node_modules/nwsapi/", {"name":"nwsapi","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pn-1.1.0-e2f4cef0e219f463c179ab37463e4e1ecdccbafb/node_modules/pn/", {"name":"pn","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-request-2.88.0-9c2fca4f7d35b592efe57c7f0a55e81052124fef/node_modules/request/", {"name":"request","reference":"2.88.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-aws-sign2-0.7.0-b46e890934a9591f2d2f6f86d7e6a9f1b3fe76a8/node_modules/aws-sign2/", {"name":"aws-sign2","reference":"0.7.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-aws4-1.8.0-f0e003d9ca9e7f59c7a508945d7b2ef9a04a542f/node_modules/aws4/", {"name":"aws4","reference":"1.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-caseless-0.12.0-1b681c21ff84033c826543090689420d187151dc/node_modules/caseless/", {"name":"caseless","reference":"0.12.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-combined-stream-1.0.7-2d1d24317afb8abe95d6d2c0b07b57813539d828/node_modules/combined-stream/", {"name":"combined-stream","reference":"1.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-delayed-stream-1.0.0-df3ae199acadfb7d440aaae0b29e2272b24ec619/node_modules/delayed-stream/", {"name":"delayed-stream","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-extend-3.0.2-f8b1136b4071fbd8eb140aff858b1019ec2915fa/node_modules/extend/", {"name":"extend","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-forever-agent-0.6.1-fbc71f0c41adeb37f96c577ad1ed42d8fdacca91/node_modules/forever-agent/", {"name":"forever-agent","reference":"0.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-form-data-2.3.3-dcce52c05f644f298c6a7ab936bd724ceffbf3a6/node_modules/form-data/", {"name":"form-data","reference":"2.3.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-asynckit-0.4.0-c79ed97f7f34cb8f2ba1bc9790bcc366474b4b79/node_modules/asynckit/", {"name":"asynckit","reference":"0.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mime-types-2.1.21-28995aa1ecb770742fe6ae7e58f9181c744b3f96/node_modules/mime-types/", {"name":"mime-types","reference":"2.1.21"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-mime-db-1.37.0-0b6a0ce6fdbe9576e25f1f2d2fde8830dc0ad0d8/node_modules/mime-db/", {"name":"mime-db","reference":"1.37.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-har-validator-5.1.3-1ef89ebd3e4996557675eed9893110dc350fa080/node_modules/har-validator/", {"name":"har-validator","reference":"5.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ajv-6.9.1-a4d3683d74abc5670e75f0b16520f70a20ea8dc1/node_modules/ajv/", {"name":"ajv","reference":"6.9.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fast-deep-equal-2.0.1-7b05218ddf9667bf7f370bf7fdb2cb15fdd0aa49/node_modules/fast-deep-equal/", {"name":"fast-deep-equal","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fast-json-stable-stringify-2.0.0-d5142c0caee6b1189f87d3a76111064f86c8bbf2/node_modules/fast-json-stable-stringify/", {"name":"fast-json-stable-stringify","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json-schema-traverse-0.4.1-69f6a87d9513ab8bb8fe63bdb0979c448e684660/node_modules/json-schema-traverse/", {"name":"json-schema-traverse","reference":"0.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-uri-js-4.2.2-94c540e1ff772956e2299507c010aea6c8838eb0/node_modules/uri-js/", {"name":"uri-js","reference":"4.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-har-schema-2.0.0-a94c2224ebcac04782a0d9035521f24735b7ec92/node_modules/har-schema/", {"name":"har-schema","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-http-signature-1.2.0-9aecd925114772f3d95b65a60abb8f7c18fbace1/node_modules/http-signature/", {"name":"http-signature","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-assert-plus-1.0.0-f12e0f3c5d77b0b1cdd9146942e4e96c1e4dd525/node_modules/assert-plus/", {"name":"assert-plus","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsprim-1.4.1-313e66bc1e5cc06e438bc1b7499c2e5c56acb6a2/node_modules/jsprim/", {"name":"jsprim","reference":"1.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-extsprintf-1.3.0-96918440e3041a7a414f8c52e3c574eb3c3e1e05/node_modules/extsprintf/", {"name":"extsprintf","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-extsprintf-1.4.0-e2689f8f356fad62cca65a3a91c5df5f9551692f/node_modules/extsprintf/", {"name":"extsprintf","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json-schema-0.2.3-b480c892e59a2f05954ce727bd3f2a4e882f9e13/node_modules/json-schema/", {"name":"json-schema","reference":"0.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-verror-1.10.0-3a105ca17053af55d6e270c1f8288682e18da400/node_modules/verror/", {"name":"verror","reference":"1.10.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sshpk-1.16.1-fb661c0bef29b39db40769ee39fa70093d6f6877/node_modules/sshpk/", {"name":"sshpk","reference":"1.16.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-asn1-0.2.4-8d2475dfab553bb33e77b54e59e880bb8ce23136/node_modules/asn1/", {"name":"asn1","reference":"0.2.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-bcrypt-pbkdf-1.0.2-a4301d389b6a43f9b67ff3ca11a3f6637e360e9e/node_modules/bcrypt-pbkdf/", {"name":"bcrypt-pbkdf","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tweetnacl-0.14.5-5ae68177f192d4456269d108afa93ff8743f4f64/node_modules/tweetnacl/", {"name":"tweetnacl","reference":"0.14.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-dashdash-1.14.1-853cfa0f7cbe2fed5de20326b8dd581035f6e2f0/node_modules/dashdash/", {"name":"dashdash","reference":"1.14.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-ecc-jsbn-0.1.2-3a83a904e54353287874c564b7549386849a98c9/node_modules/ecc-jsbn/", {"name":"ecc-jsbn","reference":"0.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jsbn-0.1.1-a5e654c2e5a2deb5f201d96cefbca80c0ef2f513/node_modules/jsbn/", {"name":"jsbn","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-getpass-0.1.7-5eff8e3e684d569ae4cb2b1282604e8ba62149fa/node_modules/getpass/", {"name":"getpass","reference":"0.1.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-typedarray-1.0.0-e479c80858df0c1b11ddda6940f96011fcda4a9a/node_modules/is-typedarray/", {"name":"is-typedarray","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-isstream-0.1.2-47e63f7af55afa6f92e1500e690eb8b8529c099a/node_modules/isstream/", {"name":"isstream","reference":"0.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json-stringify-safe-5.0.1-1296a2d58fd45f19a0f6ce01d65701e2c735b6eb/node_modules/json-stringify-safe/", {"name":"json-stringify-safe","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-oauth-sign-0.9.0-47a7b016baa68b5fa0ecf3dee08a85c679ac6455/node_modules/oauth-sign/", {"name":"oauth-sign","reference":"0.9.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-performance-now-2.1.0-6309f4e0e5fa913ec1c69307ae364b4b377c9e7b/node_modules/performance-now/", {"name":"performance-now","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-qs-6.5.2-cb3ae806e8740444584ef154ce8ee98d403f3e36/node_modules/qs/", {"name":"qs","reference":"6.5.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tough-cookie-2.4.3-53f36da3f47783b0925afa06ff9f3b165280f781/node_modules/tough-cookie/", {"name":"tough-cookie","reference":"2.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tough-cookie-2.5.0-cd9fb2a0aa1d5a12b473bd9fb96fa3dcff65ade2/node_modules/tough-cookie/", {"name":"tough-cookie","reference":"2.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tough-cookie-3.0.1-9df4f57e739c26930a018184887f4adb7dca73b2/node_modules/tough-cookie/", {"name":"tough-cookie","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-psl-1.1.31-e9aa86d0101b5b105cbe93ac6b784cd547276184/node_modules/psl/", {"name":"psl","reference":"1.1.31"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tunnel-agent-0.6.0-27a5dea06b36b04a0a9966774b290868f0fc40fd/node_modules/tunnel-agent/", {"name":"tunnel-agent","reference":"0.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-uuid-3.3.2-1b4af4955eb3077c501c23872fc6513811587131/node_modules/uuid/", {"name":"uuid","reference":"3.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-native-1.0.7-a49868a624bdea5069f1251d0a836e0d89aa2c59/node_modules/request-promise-native/", {"name":"request-promise-native","reference":"1.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-native-1.0.5-5281770f68e0c9719e5163fd3fab482215f4fda5/node_modules/request-promise-native/", {"name":"request-promise-native","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-core-1.1.2-339f6aababcafdb31c799ff158700336301d3346/node_modules/request-promise-core/", {"name":"request-promise-core","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-request-promise-core-1.1.1-3eee00b2c5aa83239cfb04c5700da36f81cd08b6/node_modules/request-promise-core/", {"name":"request-promise-core","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-stealthy-require-1.1.1-35b09875b4ff49f26a777e509b3090a3226bf24b/node_modules/stealthy-require/", {"name":"stealthy-require","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-saxes-3.1.10-6028a4d6d65f0b5f5b5d250c0500be6a7950fe13/node_modules/saxes/", {"name":"saxes","reference":"3.1.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-xmlchars-1.3.1-1dda035f833dbb4f86a0c28eaa6ca769214793cf/node_modules/xmlchars/", {"name":"xmlchars","reference":"1.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-symbol-tree-3.2.2-ae27db38f660a7ae2e1c3b7d1bc290819b8519e6/node_modules/symbol-tree/", {"name":"symbol-tree","reference":"3.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-w3c-hr-time-1.0.1-82ac2bff63d950ea9e3189a58a65625fedf19045/node_modules/w3c-hr-time/", {"name":"w3c-hr-time","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-browser-process-hrtime-0.1.3-616f00faef1df7ec1b5bf9cfe2bdc3170f26c7b4/node_modules/browser-process-hrtime/", {"name":"browser-process-hrtime","reference":"0.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-w3c-xmlserializer-1.1.2-30485ca7d70a6fd052420a3d12fd90e6339ce794/node_modules/w3c-xmlserializer/", {"name":"w3c-xmlserializer","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-xml-name-validator-3.0.0-6ae73e06de4d8c6e47f9fb181f78d648ad457c6a/node_modules/xml-name-validator/", {"name":"xml-name-validator","reference":"3.0.0"}],
  ["./.pnp/externals/pnp-9b014519ce8c6df6754c3598b7e86ae703bf63ce/node_modules/@babel/cli/", {"name":"@babel/cli","reference":"pnp:9b014519ce8c6df6754c3598b7e86ae703bf63ce"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-commander-2.19.0-f6198aa84e5b83c46054b94ddedbfed5ee9ff12a/node_modules/commander/", {"name":"commander","reference":"2.19.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-commander-2.17.1-bd77ab7de6de94205ceacc72f1716d29f20a77bf/node_modules/commander/", {"name":"commander","reference":"2.17.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fs-readdir-recursive-1.1.0-e32fc030a2ccee44a6b5371308da54be0b397d27/node_modules/fs-readdir-recursive/", {"name":"fs-readdir-recursive","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-output-file-sync-2.0.1-f53118282f5f553c2799541792b723a4c71430c0/node_modules/output-file-sync/", {"name":"output-file-sync","reference":"2.0.1"}],
  ["./.pnp/externals/pnp-12d0714a6c937f322d9609379be0e61c73ed8931/node_modules/@babel/node/", {"name":"@babel/node","reference":"pnp:12d0714a6c937f322d9609379be0e61c73ed8931"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-polyfill-7.2.5-6c54b964f71ad27edddc567d065e57e87ed7fa7d/node_modules/@babel/polyfill/", {"name":"@babel/polyfill","reference":"7.2.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-register-7.0.0-fa634bae1bfa429f60615b754fc1f1d745edd827/node_modules/@babel/register/", {"name":"@babel/register","reference":"7.0.0"}],
  ["./.pnp/externals/pnp-212ab889e0e907ad9de719031b4506871141fc58/node_modules/@babel/register/", {"name":"@babel/register","reference":"pnp:212ab889e0e907ad9de719031b4506871141fc58"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-find-cache-dir-1.0.0-9288e3e9e3cc3748717d39eade17cf71fc30ee6f/node_modules/find-cache-dir/", {"name":"find-cache-dir","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-find-cache-dir-2.1.0-8d0f94cd13fe43c6c7c261a0d86115ca918c05f7/node_modules/find-cache-dir/", {"name":"find-cache-dir","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-commondir-1.0.1-ddd800da0c66127393cca5950ea968a3aaf1253b/node_modules/commondir/", {"name":"commondir","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-home-or-tmp-3.0.0-57a8fe24cf33cdd524860a15821ddc25c86671fb/node_modules/home-or-tmp/", {"name":"home-or-tmp","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pirates-4.0.0-850b18781b4ac6ec58a43c9ed9ec5fe6796addbd/node_modules/pirates/", {"name":"pirates","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pirates-4.0.1-643a92caf894566f91b2b986d2c66950a8e2fb87/node_modules/pirates/", {"name":"pirates","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-modules-regexp-1.0.0-8d9dbe28964a4ac5712e9131642107c71e90ec40/node_modules/node-modules-regexp/", {"name":"node-modules-regexp","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-source-map-support-0.5.10-2214080bc9d51832511ee2bab96e3c2f9353120c/node_modules/source-map-support/", {"name":"source-map-support","reference":"0.5.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-environment-flags-1.0.5-fa930275f5bf5dae188d6192b24b4c8bbac3d76a/node_modules/node-environment-flags/", {"name":"node-environment-flags","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-object-getownpropertydescriptors-2.0.3-8758c846f5b407adab0f236e0986f14b051caa16/node_modules/object.getownpropertydescriptors/", {"name":"object.getownpropertydescriptors","reference":"2.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-define-properties-1.1.3-cf88da6cbee26fe6db7094f61d870cbd84cee9f1/node_modules/define-properties/", {"name":"define-properties","reference":"1.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-object-keys-1.0.12-09c53855377575310cca62f55bb334abff7b3ed2/node_modules/object-keys/", {"name":"object-keys","reference":"1.0.12"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-es-abstract-1.13.0-ac86145fdd5099d8dd49558ccba2eaf9b88e24e9/node_modules/es-abstract/", {"name":"es-abstract","reference":"1.13.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-es-to-primitive-1.2.0-edf72478033456e8dda8ef09e00ad9650707f377/node_modules/es-to-primitive/", {"name":"es-to-primitive","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-callable-1.1.4-1e1adf219e1eeb684d691f9d6a05ff0d30a24d75/node_modules/is-callable/", {"name":"is-callable","reference":"1.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-date-object-1.0.1-9aa20eb6aeebbff77fbd33e74ca01b33581d3a16/node_modules/is-date-object/", {"name":"is-date-object","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-symbol-1.0.2-a055f6ae57192caee329e7a860118b497a950f38/node_modules/is-symbol/", {"name":"is-symbol","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-symbols-1.0.0-ba1a8f1af2a0fc39650f5c850367704122063b44/node_modules/has-symbols/", {"name":"has-symbols","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-function-bind-1.1.1-a56899d3ea3c9bab874bb9773b7c5ede92f4895d/node_modules/function-bind/", {"name":"function-bind","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-has-1.0.3-722d7cbfc1f6aa8241f16dd814e011e1f41e8796/node_modules/has/", {"name":"has","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-regex-1.0.4-5517489b547091b0930e095654ced25ee97e9491/node_modules/is-regex/", {"name":"is-regex","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-v8flags-3.1.2-fc5cd0c227428181e6c29b2992e4f8f1da5e0c9f/node_modules/v8flags/", {"name":"v8flags","reference":"3.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-homedir-polyfill-1.0.1-4c2bbc8a758998feebf5ed68580f76d46768b4bc/node_modules/homedir-polyfill/", {"name":"homedir-polyfill","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parse-passwd-1.0.0-6d5b934a456993b23d37f40a382d6f1666a8e5c6/node_modules/parse-passwd/", {"name":"parse-passwd","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-member-expression-literals-7.2.0-fa10aa5c58a2cb6afcf2c9ffa8cb4d8b3d489a2d/node_modules/@babel/plugin-transform-member-expression-literals/", {"name":"@babel/plugin-transform-member-expression-literals","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-property-literals-7.2.0-03e33f653f5b25c4eb572c98b9485055b389e905/node_modules/@babel/plugin-transform-property-literals/", {"name":"@babel/plugin-transform-property-literals","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-reserved-words-7.2.0-4792af87c998a49367597d07fedf02636d2e1634/node_modules/@babel/plugin-transform-reserved-words/", {"name":"@babel/plugin-transform-reserved-words","reference":"7.2.0"}],
  ["./.pnp/externals/pnp-d4afbbd6215b1993d05095efb590984f9b6a3a02/node_modules/@babel/preset-flow/", {"name":"@babel/preset-flow","reference":"pnp:d4afbbd6215b1993d05095efb590984f9b6a3a02"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-transform-flow-strip-types-7.2.3-e3ac2a594948454e7431c7db33e1d02d51b5cd69/node_modules/@babel/plugin-transform-flow-strip-types/", {"name":"@babel/plugin-transform-flow-strip-types","reference":"7.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@babel-plugin-syntax-flow-7.2.0-a765f061f803bc48f240c26f8747faf97c26bf7c/node_modules/@babel/plugin-syntax-flow/", {"name":"@babel/plugin-syntax-flow","reference":"7.2.0"}],
  ["./.pnp/externals/pnp-0c89c1675497b0fec2ce71c0ceba145f497433f4/node_modules/@quase/eslint-config-base/", {"name":"@quase/eslint-config-base","reference":"pnp:0c89c1675497b0fec2ce71c0ceba145f497433f4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-eslint-10.0.1-919681dc099614cd7d31d45c8908695092a1faed/node_modules/babel-eslint/", {"name":"babel-eslint","reference":"10.0.1"}],
  ["./.pnp/externals/pnp-40297bf345c2c41dbcbee7fd39cbf070f3594b60/node_modules/babel-eslint/", {"name":"babel-eslint","reference":"pnp:40297bf345c2c41dbcbee7fd39cbf070f3594b60"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-scope-3.7.1-3d63c3edfda02e06e01a452ad88caacc7cdcb6e8/node_modules/eslint-scope/", {"name":"eslint-scope","reference":"3.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-scope-4.0.0-50bf3071e9338bcdc43331794a0cb533f0136172/node_modules/eslint-scope/", {"name":"eslint-scope","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-scope-4.0.3-ca03833310f6889a3264781aa82e63eb9cfe7848/node_modules/eslint-scope/", {"name":"eslint-scope","reference":"4.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-esrecurse-4.2.1-007a3b9fdbc2b3bb87e4879ea19c92fdbd3942cf/node_modules/esrecurse/", {"name":"esrecurse","reference":"4.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-visitor-keys-1.0.0-3f3180fb2e291017716acb4c9d6d5b5c34a6a81d/node_modules/eslint-visitor-keys/", {"name":"eslint-visitor-keys","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-plugin-import-2.16.0-97ac3e75d0791c4fac0e15ef388510217be7f66f/node_modules/eslint-plugin-import/", {"name":"eslint-plugin-import","reference":"2.16.0"}],
  ["./.pnp/externals/pnp-e13d44595399586b5a77811b3bc990943932eacf/node_modules/eslint-plugin-import/", {"name":"eslint-plugin-import","reference":"pnp:e13d44595399586b5a77811b3bc990943932eacf"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-contains-path-0.1.0-fe8cf184ff6670b6baef01a9d4861a5cbec4120a/node_modules/contains-path/", {"name":"contains-path","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-doctrine-1.5.0-379dce730f6166f76cefa4e6707a159b02c5a6fa/node_modules/doctrine/", {"name":"doctrine","reference":"1.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-doctrine-3.0.0-addebead72a6574db783639dc87a121773973961/node_modules/doctrine/", {"name":"doctrine","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-import-resolver-node-0.3.2-58f15fb839b8d0576ca980413476aab2472db66a/node_modules/eslint-import-resolver-node/", {"name":"eslint-import-resolver-node","reference":"0.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-module-utils-2.3.0-546178dab5e046c8b562bbb50705e2456d7bda49/node_modules/eslint-module-utils/", {"name":"eslint-module-utils","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-module-utils-2.4.0-8b93499e9b00eab80ccb6614e69f03678e84e09a/node_modules/eslint-module-utils/", {"name":"eslint-module-utils","reference":"2.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-plugin-node-8.0.1-55ae3560022863d141fa7a11799532340a685964/node_modules/eslint-plugin-node/", {"name":"eslint-plugin-node","reference":"8.0.1"}],
  ["./.pnp/externals/pnp-0002cdcd4b4ece9dc23f69137327ea828b6e2a0b/node_modules/eslint-plugin-node/", {"name":"eslint-plugin-node","reference":"pnp:0002cdcd4b4ece9dc23f69137327ea828b6e2a0b"}],
  ["./.pnp/externals/pnp-00961244b9eda7fb07e72e2d480a765c28949f94/node_modules/eslint-plugin-es/", {"name":"eslint-plugin-es","reference":"pnp:00961244b9eda7fb07e72e2d480a765c28949f94"}],
  ["./.pnp/externals/pnp-5b31eb2e94d010ce3fe4ddb0e395dba114c98734/node_modules/eslint-plugin-es/", {"name":"eslint-plugin-es","reference":"pnp:5b31eb2e94d010ce3fe4ddb0e395dba114c98734"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-utils-1.3.1-9a851ba89ee7c460346f97cf8939c7298827e512/node_modules/eslint-utils/", {"name":"eslint-utils","reference":"1.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-regexpp-2.0.1-8d19d31cf632482b589049f8281f93dbcba4d07f/node_modules/regexpp/", {"name":"regexpp","reference":"2.0.1"}],
  ["./.pnp/externals/pnp-28e2761177fbb5133e7217e1b5aeeace3a6a060d/node_modules/@typescript-eslint/eslint-plugin/", {"name":"@typescript-eslint/eslint-plugin","reference":"pnp:28e2761177fbb5133e7217e1b5aeeace3a6a060d"}],
  ["./.pnp/externals/pnp-8bd157d24be50560e6bb5dca18f73efd37fd1706/node_modules/@typescript-eslint/experimental-utils/", {"name":"@typescript-eslint/experimental-utils","reference":"pnp:8bd157d24be50560e6bb5dca18f73efd37fd1706"}],
  ["./.pnp/externals/pnp-0524386e850511b7227b8d994d2da21014039e65/node_modules/@typescript-eslint/experimental-utils/", {"name":"@typescript-eslint/experimental-utils","reference":"pnp:0524386e850511b7227b8d994d2da21014039e65"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@typescript-eslint-typescript-estree-1.10.2-8403585dd74b6cfb6f78aa98b6958de158b5897b/node_modules/@typescript-eslint/typescript-estree/", {"name":"@typescript-eslint/typescript-estree","reference":"1.10.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-lodash-unescape-4.0.1-bf2249886ce514cda112fae9218cdc065211fc9c/node_modules/lodash.unescape/", {"name":"lodash.unescape","reference":"4.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-functional-red-black-tree-1.0.1-1b0ab3bd553b2a0d6399d29c0e3ea0b252078327/node_modules/functional-red-black-tree/", {"name":"functional-red-black-tree","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tsutils-3.8.0-7a3dbadc88e465596440622b65c04edc8e187ae5/node_modules/tsutils/", {"name":"tsutils","reference":"3.8.0"}],
  ["./.pnp/externals/pnp-18d8d3ba6429cc0d314ad81dd2ee9403bb325efd/node_modules/@typescript-eslint/parser/", {"name":"@typescript-eslint/parser","reference":"pnp:18d8d3ba6429cc0d314ad81dd2ee9403bb325efd"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-eslint-visitor-keys-1.0.0-1ee30d79544ca84d68d4b3cdb0af4f205663dd2d/node_modules/@types/eslint-visitor-keys/", {"name":"@types/eslint-visitor-keys","reference":"1.0.0"}],
  ["./.pnp/externals/pnp-79a1891facb0f591b6362a15e98a77287a6e39bf/node_modules/babel-jest/", {"name":"babel-jest","reference":"pnp:79a1891facb0f591b6362a15e98a77287a6e39bf"}],
  ["./.pnp/externals/pnp-eacf3484420336f4c9cd37f3d25667fa873d1fba/node_modules/babel-jest/", {"name":"babel-jest","reference":"pnp:eacf3484420336f4c9cd37f3d25667fa873d1fba"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-transform-24.8.0-628fb99dce4f9d254c6fd9341e3eea262e06fef5/node_modules/@jest/transform/", {"name":"@jest/transform","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-types-24.8.0-f31e25948c58f0abd8c845ae26fcea1491dea7ad/node_modules/@jest/types/", {"name":"@jest/types","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-istanbul-lib-coverage-2.0.1-42995b446db9a48a11a07ec083499a860e9138ff/node_modules/@types/istanbul-lib-coverage/", {"name":"@types/istanbul-lib-coverage","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-istanbul-reports-1.1.1-7a8cbf6a406f36c8add871625b278eaf0b0d255a/node_modules/@types/istanbul-reports/", {"name":"@types/istanbul-reports","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-istanbul-lib-report-1.1.1-e5471e7fa33c61358dd38426189c037a58433b8c/node_modules/@types/istanbul-lib-report/", {"name":"@types/istanbul-lib-report","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-yargs-12.0.10-17a8ec65cd8e88f51b418ceb271af18d3137df67/node_modules/@types/yargs/", {"name":"@types/yargs","reference":"12.0.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-istanbul-5.1.0-6892f529eff65a3e2d33d87dc5888ffa2ecd4a30/node_modules/babel-plugin-istanbul/", {"name":"babel-plugin-istanbul","reference":"5.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-instrument-3.1.0-a2b5484a7d445f1f311e93190813fa56dfb62971/node_modules/istanbul-lib-instrument/", {"name":"istanbul-lib-instrument","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-coverage-2.0.3-0b891e5ad42312c2b9488554f603795f9a2211ba/node_modules/istanbul-lib-coverage/", {"name":"istanbul-lib-coverage","reference":"2.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-test-exclude-5.1.0-6ba6b25179d2d38724824661323b73e03c0c1de1/node_modules/test-exclude/", {"name":"test-exclude","reference":"5.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-haste-map-24.8.1-f39cc1d2b1d907e014165b4bd5a957afcb992982/node_modules/jest-haste-map/", {"name":"jest-haste-map","reference":"24.8.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-fb-watchman-2.0.0-54e9abf7dfa2f26cd9b1636c588c1afc05de5d58/node_modules/fb-watchman/", {"name":"fb-watchman","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-bser-2.0.0-9ac78d3ed5d915804fd87acb158bc797147a1719/node_modules/bser/", {"name":"bser","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-int64-0.4.0-87a9065cdb355d3182d8f94ce11188b825c68a3b/node_modules/node-int64/", {"name":"node-int64","reference":"0.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-serializer-24.4.0-f70c5918c8ea9235ccb1276d232e459080588db3/node_modules/jest-serializer/", {"name":"jest-serializer","reference":"24.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-util-24.8.0-41f0e945da11df44cc76d64ffb915d0716f46cd1/node_modules/jest-util/", {"name":"jest-util","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-console-24.7.1-32a9e42535a97aedfe037e725bd67e954b459545/node_modules/@jest/console/", {"name":"@jest/console","reference":"24.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-source-map-24.3.0-563be3aa4d224caf65ff77edc95cd1ca4da67f28/node_modules/@jest/source-map/", {"name":"@jest/source-map","reference":"24.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-fake-timers-24.8.0-2e5b80a4f78f284bcb4bd5714b8e10dd36a8d3d1/node_modules/@jest/fake-timers/", {"name":"@jest/fake-timers","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-message-util-24.8.0-0d6891e72a4beacc0292b638685df42e28d6218b/node_modules/jest-message-util/", {"name":"jest-message-util","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-test-result-24.8.0-7675d0aaf9d2484caa65e048d9b467d160f8e9d3/node_modules/@jest/test-result/", {"name":"@jest/test-result","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-stack-utils-1.0.1-0a851d3bd96498fa25c33ab7278ed3bd65f06c3e/node_modules/@types/stack-utils/", {"name":"@types/stack-utils","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-stack-utils-1.0.2-33eba3897788558bebfc2db059dc158ec36cebb8/node_modules/stack-utils/", {"name":"stack-utils","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-mock-24.8.0-2f9d14d37699e863f1febf4e4d5a33b7fdbbde56/node_modules/jest-mock/", {"name":"jest-mock","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-worker-24.6.0-7f81ceae34b7cde0c9827a6980c35b7cdc0161b3/node_modules/jest-worker/", {"name":"jest-worker","reference":"24.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-merge-stream-1.0.1-4041202d508a342ba00174008df0c251b8c135e1/node_modules/merge-stream/", {"name":"merge-stream","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sane-4.1.0-ed881fd922733a6c461bc189dc2b6c006f3ffded/node_modules/sane/", {"name":"sane","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@cnakazawa-watch-1.0.3-099139eaec7ebf07a27c1786a3ff64f39464d2ef/node_modules/@cnakazawa/watch/", {"name":"@cnakazawa/watch","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-exec-sh-0.3.2-6738de2eb7c8e671d0366aea0b0db8c6f7d7391b/node_modules/exec-sh/", {"name":"exec-sh","reference":"0.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-capture-exit-2.0.0-fb953bfaebeb781f62898239dabb426d08a509a4/node_modules/capture-exit/", {"name":"capture-exit","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-rsvp-4.8.4-b50e6b34583f3dd89329a2f23a8a2be072845911/node_modules/rsvp/", {"name":"rsvp","reference":"4.8.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-walker-1.0.7-2f7f9b8fd10d677262b18a884e28d19618e028fb/node_modules/walker/", {"name":"walker","reference":"1.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-makeerror-1.0.11-e01a5c9109f2af79660e4e8b9587790184f5a96c/node_modules/makeerror/", {"name":"makeerror","reference":"1.0.11"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tmpl-1.0.4-23640dd7b42d00433911140820e5cf440e521dd1/node_modules/tmpl/", {"name":"tmpl","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-regex-util-24.3.0-d5a65f60be1ae3e310d5214a0307581995227b36/node_modules/jest-regex-util/", {"name":"jest-regex-util","reference":"24.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-realpath-native-1.1.0-2003294fea23fb0672f2476ebe22fcf498a2d65c/node_modules/realpath-native/", {"name":"realpath-native","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-util-promisify-1.0.0-440f7165a459c9a16dc145eb8e72f35687097030/node_modules/util.promisify/", {"name":"util.promisify","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-core-7.1.0-710f2487dda4dcfd010ca6abb2b4dc7394365c51/node_modules/@types/babel__core/", {"name":"@types/babel__core","reference":"7.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-generator-7.0.2-d2112a6b21fad600d7674274293c85dce0cb47fc/node_modules/@types/babel__generator/", {"name":"@types/babel__generator","reference":"7.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-template-7.0.2-4ff63d6b52eddac1de7b975a5223ed32ecea9307/node_modules/@types/babel__template/", {"name":"@types/babel__template","reference":"7.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-babel-traverse-7.0.6-328dd1a8fc4cfe3c8458be9477b219ea158fd7b2/node_modules/@types/babel__traverse/", {"name":"@types/babel__traverse","reference":"7.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-preset-jest-24.6.0-66f06136eefce87797539c0d63f1769cc3915984/node_modules/babel-preset-jest/", {"name":"babel-preset-jest","reference":"24.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-babel-plugin-jest-hoist-24.6.0-f7f7f7ad150ee96d7a5e8e2c5da8319579e78019/node_modules/babel-plugin-jest-hoist/", {"name":"babel-plugin-jest-hoist","reference":"24.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-eslint-5.16.0-a1e3ac1aae4a3fbd8296fcf8f7ab7314cbb6abea/node_modules/eslint/", {"name":"eslint","reference":"5.16.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-espree-5.0.1-5d6526fa4fc7f0788a5cf75b15f30323e2f81f7a/node_modules/espree/", {"name":"espree","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-acorn-jsx-5.0.1-32a064fd925429216a09b141102bfdd185fae40e/node_modules/acorn-jsx/", {"name":"acorn-jsx","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-esquery-1.0.1-406c51658b1f5991a5f9b62b1dc25b00e3e5c708/node_modules/esquery/", {"name":"esquery","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-file-entry-cache-5.0.1-ca0f6efa6dd3d561333fb14515065c2fafdf439c/node_modules/file-entry-cache/", {"name":"file-entry-cache","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-flat-cache-2.0.1-5d296d6f04bda44a4630a301413bdbc2ec085ec0/node_modules/flat-cache/", {"name":"flat-cache","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-flatted-2.0.0-55122b6536ea496b4b44893ee2608141d10d9916/node_modules/flatted/", {"name":"flatted","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-write-1.0.3-0800e14523b923a387e415123c865616aae0f5c3/node_modules/write/", {"name":"write","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-parent-module-1.0.0-df250bdc5391f4a085fb589dad761f5ad6b865b5/node_modules/parent-module/", {"name":"parent-module","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-js-yaml-3.13.1-aff151b30bfdfa8e49e05da22e7415e9dfa37847/node_modules/js-yaml/", {"name":"js-yaml","reference":"3.13.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-argparse-1.0.10-bcd6791ea5ae09725e17e5ad988134cd40b3d911/node_modules/argparse/", {"name":"argparse","reference":"1.0.10"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sprintf-js-1.0.3-04e6926f662895354f3dd015203633b857297e2c/node_modules/sprintf-js/", {"name":"sprintf-js","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-json-stable-stringify-without-jsonify-1.0.1-9db7b59496ad3f3cfef30a75142d2d930ad72651/node_modules/json-stable-stringify-without-jsonify/", {"name":"json-stable-stringify-without-jsonify","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-natural-compare-1.4.0-4abebfeed7541f2c27acfb29bdbbd15c8d5ba4f7/node_modules/natural-compare/", {"name":"natural-compare","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-progress-2.0.3-7e8cf8d8f5b8f239c1bc68beb4eb78567d572ef8/node_modules/progress/", {"name":"progress","reference":"2.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-table-5.2.3-cde0cc6eb06751c009efab27e8c820ca5b67b7f2/node_modules/table/", {"name":"table","reference":"5.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-astral-regex-1.0.0-6c8c3fb827dd43ee3918f27b82782ab7658a6fd9/node_modules/astral-regex/", {"name":"astral-regex","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-text-table-0.2.0-7f5ee823ae805207c00af2df4a84ec3fcfa570b4/node_modules/text-table/", {"name":"text-table","reference":"0.2.0"}],
  ["./.pnp/externals/pnp-6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d/node_modules/eslint-import-resolver-typescript/", {"name":"eslint-import-resolver-typescript","reference":"pnp:6c6627c6b4ebc11ccdc386ee592dfbe75d32a50d"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-tsconfig-paths-3.8.0-4e34202d5b41958f269cf56b01ed95b853d59f72/node_modules/tsconfig-paths/", {"name":"tsconfig-paths","reference":"3.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@types-json5-0.0.29-ee28707ae94e11d2b827bcbe5270bcea7f3e71ee/node_modules/@types/json5/", {"name":"@types/json5","reference":"0.0.29"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-deepmerge-2.2.1-5d3ff22a01c00f645405a2fbc17d0778a1801170/node_modules/deepmerge/", {"name":"deepmerge","reference":"2.2.1"}],
  ["./.pnp/externals/pnp-b20d52d1b63fe4d37c11acdb1befff790dd9c0c8/node_modules/eslint-plugin-flowtype/", {"name":"eslint-plugin-flowtype","reference":"pnp:b20d52d1b63fe4d37c11acdb1befff790dd9c0c8"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-array-includes-3.0.3-184b48f62d92d7452bb31b323165c7f8bd02266d/node_modules/array-includes/", {"name":"array-includes","reference":"3.0.3"}],
  ["./.pnp/externals/pnp-c895d8e50ffed0a846dcd923855078bfa566d5f7/node_modules/eslint-plugin-jest/", {"name":"eslint-plugin-jest","reference":"pnp:c895d8e50ffed0a846dcd923855078bfa566d5f7"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-flow-bin-0.88.0-e4c7bd93da2331f6ac1733fbe484b1b0c52eb548/node_modules/flow-bin/", {"name":"flow-bin","reference":"0.88.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-24.8.0-d5dff1984d0d1002196e9b7f12f75af1b2809081/node_modules/jest/", {"name":"jest","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-cli-24.8.0-b075ac914492ed114fa338ade7362a301693e989/node_modules/jest-cli/", {"name":"jest-cli","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-core-24.8.0-fbbdcd42a41d0d39cddbc9f520c8bab0c33eed5b/node_modules/@jest/core/", {"name":"@jest/core","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-reporters-24.8.0-075169cd029bddec54b8f2c0fc489fd0b9e05729/node_modules/@jest/reporters/", {"name":"@jest/reporters","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-environment-24.8.0-0342261383c776bdd652168f68065ef144af0eac/node_modules/@jest/environment/", {"name":"@jest/environment","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-exit-0.1.2-0632638f8d877cc82107d30a0fff1a17cba1cd0c/node_modules/exit/", {"name":"exit","reference":"0.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-report-2.0.4-bfd324ee0c04f59119cb4f07dab157d09f24d7e4/node_modules/istanbul-lib-report/", {"name":"istanbul-lib-report","reference":"2.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-lib-source-maps-3.0.2-f1e817229a9146e8424a28e5d69ba220fda34156/node_modules/istanbul-lib-source-maps/", {"name":"istanbul-lib-source-maps","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-istanbul-reports-2.1.1-72ef16b4ecb9a4a7bd0e2001e00f95d1eec8afa9/node_modules/istanbul-reports/", {"name":"istanbul-reports","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-handlebars-4.1.1-6e4e41c18ebe7719ae4d38e5aca3d32fa3dd23d3/node_modules/handlebars/", {"name":"handlebars","reference":"4.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-neo-async-2.6.0-b9d15e4d71c6762908654b5183ed38b753340835/node_modules/neo-async/", {"name":"neo-async","reference":"2.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-optimist-0.6.1-da3ea74686fa21a19a111c326e90eb15a0196686/node_modules/optimist/", {"name":"optimist","reference":"0.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-uglify-js-3.4.9-af02f180c1207d76432e473ed24a28f4a782bae3/node_modules/uglify-js/", {"name":"uglify-js","reference":"3.4.9"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-resolve-24.8.0-84b8e5408c1f6a11539793e2b5feb1b6e722439f/node_modules/jest-resolve/", {"name":"jest-resolve","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-browser-resolve-1.11.3-9b7cbb3d0f510e4cb86bdbd796124d28b5890af6/node_modules/browser-resolve/", {"name":"browser-resolve","reference":"1.11.3"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-pnp-resolver-1.2.1-ecdae604c077a7fbc70defb6d517c3c1c898923a/node_modules/jest-pnp-resolver/", {"name":"jest-pnp-resolver","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-runtime-24.8.0-05f94d5b05c21f6dc54e427cd2e4980923350620/node_modules/jest-runtime/", {"name":"jest-runtime","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-config-24.8.0-77db3d265a6f726294687cbbccc36f8a76ee0f4f/node_modules/jest-config/", {"name":"jest-config","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-@jest-test-sequencer-24.8.0-2f993bcf6ef5eb4e65e8233a95a3320248cf994b/node_modules/@jest/test-sequencer/", {"name":"@jest/test-sequencer","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-runner-24.8.0-4f9ae07b767db27b740d7deffad0cf67ccb4c5bb/node_modules/jest-runner/", {"name":"jest-runner","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-docblock-24.3.0-b9c32dac70f72e4464520d2ba4aec02ab14db5dd/node_modules/jest-docblock/", {"name":"jest-docblock","reference":"24.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-detect-newline-2.1.0-f41f1c10be4b00e87b5f13da680759f2c5bfd3e2/node_modules/detect-newline/", {"name":"detect-newline","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-jasmine2-24.8.0-a9c7e14c83dd77d8b15e820549ce8987cc8cd898/node_modules/jest-jasmine2/", {"name":"jest-jasmine2","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-co-4.6.0-6ea6bdf3d853ae54ccb8e47bfa0bf3f9031fb184/node_modules/co/", {"name":"co","reference":"4.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-expect-24.8.0-471f8ec256b7b6129ca2524b2a62f030df38718d/node_modules/expect/", {"name":"expect","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-get-type-24.8.0-a7440de30b651f5a70ea3ed7ff073a32dfe646fc/node_modules/jest-get-type/", {"name":"jest-get-type","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-matcher-utils-24.8.0-2bce42204c9af12bde46f83dc839efe8be832495/node_modules/jest-matcher-utils/", {"name":"jest-matcher-utils","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-diff-24.8.0-146435e7d1e3ffdf293d53ff97e193f1d1546172/node_modules/jest-diff/", {"name":"jest-diff","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-diff-sequences-24.3.0-0f20e8a1df1abddaf4d9c226680952e64118b975/node_modules/diff-sequences/", {"name":"diff-sequences","reference":"24.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-pretty-format-24.8.0-8dae7044f58db7cb8be245383b565a963e3c27f2/node_modules/pretty-format/", {"name":"pretty-format","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-react-is-16.8.5-c54ac229dd66b5afe0de5acbe47647c3da692ff8/node_modules/react-is/", {"name":"react-is","reference":"16.8.5"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-generator-fn-2.0.0-038c31b774709641bda678b1f06a4e3227c10b3e/node_modules/is-generator-fn/", {"name":"is-generator-fn","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-each-24.8.0-a05fd2bf94ddc0b1da66c6d13ec2457f35e52775/node_modules/jest-each/", {"name":"jest-each","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-snapshot-24.8.0-3bec6a59da2ff7bc7d097a853fb67f9d415cb7c6/node_modules/jest-snapshot/", {"name":"jest-snapshot","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-throat-4.1.0-89037cbc92c56ab18926e6ba4cbb200e15672a6a/node_modules/throat/", {"name":"throat","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-leak-detector-24.8.0-c0086384e1f650c2d8348095df769f29b48e6980/node_modules/jest-leak-detector/", {"name":"jest-leak-detector","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-environment-jsdom-24.8.0-300f6949a146cabe1c9357ad9e9ecf9f43f38857/node_modules/jest-environment-jsdom/", {"name":"jest-environment-jsdom","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-left-pad-1.3.0-5b8a3a7765dfe001261dde915589e782f8c94d1e/node_modules/left-pad/", {"name":"left-pad","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sax-1.2.4-2816234e2378bddc4e5354fab5caa895df7100d9/node_modules/sax/", {"name":"sax","reference":"1.2.4"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-environment-node-24.8.0-d3f726ba8bc53087a60e7a84ca08883a4c892231/node_modules/jest-environment-node/", {"name":"jest-environment-node","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-validate-24.8.0-624c41533e6dfe356ffadc6e2423a35c2d3b4849/node_modules/jest-validate/", {"name":"jest-validate","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-node-notifier-5.4.0-7b455fdce9f7de0c63538297354f3db468426e6a/node_modules/node-notifier/", {"name":"node-notifier","reference":"5.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-growly-1.3.0-f10748cbe76af964b7c96c93c6bcc28af120c081/node_modules/growly/", {"name":"growly","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-is-wsl-1.1.0-1f16e4aa22b04d1336b66188a66af3c600c3a66d/node_modules/is-wsl/", {"name":"is-wsl","reference":"1.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-shellwords-0.1.1-d6b9181c1a48d397324c84871efbcfc73fc0654b/node_modules/shellwords/", {"name":"shellwords","reference":"0.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-string-length-2.0.0-d40dbb686a3ace960c1cffca562bf2c45f8363ed/node_modules/string-length/", {"name":"string-length","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-changed-files-24.8.0-7e7eb21cf687587a85e50f3d249d1327e15b157b/node_modules/jest-changed-files/", {"name":"jest-changed-files","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-resolve-dependencies-24.8.0-19eec3241f2045d3f990dba331d0d7526acff8e0/node_modules/jest-resolve-dependencies/", {"name":"jest-resolve-dependencies","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-jest-watcher-24.8.0-58d49915ceddd2de85e238f6213cef1c93715de4/node_modules/jest-watcher/", {"name":"jest-watcher","reference":"24.8.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-each-series-1.0.0-930f3d12dd1f50e7434457a22cd6f04ac6ad7f71/node_modules/p-each-series/", {"name":"p-each-series","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-p-reduce-1.0.0-18c2b0dd936a4690a529f8231f58a0fdb6a47dfa/node_modules/p-reduce/", {"name":"p-reduce","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-prompts-2.0.2-094119b0b0a553ec652908b583205b9867630154/node_modules/prompts/", {"name":"prompts","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-kleur-3.0.2-83c7ec858a41098b613d5998a7b653962b504f68/node_modules/kleur/", {"name":"kleur","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-sisteransi-1.0.0-77d9622ff909080f1c19e5f4a1df0c1b0a27b88c/node_modules/sisteransi/", {"name":"sisteransi","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-prepend-file-1.3.1-83b16e0b4ac1901fce88dbd945a22f4cc81df579/node_modules/prepend-file/", {"name":"prepend-file","reference":"1.3.1"}],
  ["./.pnp/externals/pnp-fd6678ea8eedcc24dee2638388893d42f3dbc358/node_modules/ts-pnp/", {"name":"ts-pnp","reference":"pnp:fd6678ea8eedcc24dee2638388893d42f3dbc358"}],
  ["../../../AppData/Local/Yarn/Cache/v4/npm-typescript-3.5.2-a09e1dc69bc9551cadf17dba10ee42cf55e5d56c/node_modules/typescript/", {"name":"typescript","reference":"3.5.2"}],
  ["./", topLevelLocator],
]);
exports.findPackageLocator = function findPackageLocator(location) {
  let relativeLocation = normalizePath(path.relative(__dirname, location));

  if (!relativeLocation.match(isStrictRegExp))
    relativeLocation = `./${relativeLocation}`;

  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')
    relativeLocation = `${relativeLocation}/`;

  let match;

  if (relativeLocation.length >= 215 && relativeLocation[214] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 215)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 207 && relativeLocation[206] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 207)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 203 && relativeLocation[202] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 203)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 201 && relativeLocation[200] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 201)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 195 && relativeLocation[194] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 195)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 193 && relativeLocation[192] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 193)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 191 && relativeLocation[190] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 191)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 189 && relativeLocation[188] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 189)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 187 && relativeLocation[186] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 187)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 185 && relativeLocation[184] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 185)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 183 && relativeLocation[182] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 183)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 181 && relativeLocation[180] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 181)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 179 && relativeLocation[178] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 179)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 177 && relativeLocation[176] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 177)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 176 && relativeLocation[175] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 176)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 175 && relativeLocation[174] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 175)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 173 && relativeLocation[172] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 173)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 171 && relativeLocation[170] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 171)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 169 && relativeLocation[168] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 169)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 167 && relativeLocation[166] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 167)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 165 && relativeLocation[164] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 165)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 163 && relativeLocation[162] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 163)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 161 && relativeLocation[160] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 161)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 159 && relativeLocation[158] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 159)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 157 && relativeLocation[156] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 157)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 155 && relativeLocation[154] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 155)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 154 && relativeLocation[153] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 154)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 153 && relativeLocation[152] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 153)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 151 && relativeLocation[150] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 151)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 150 && relativeLocation[149] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 150)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 149 && relativeLocation[148] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 149)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 148 && relativeLocation[147] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 148)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 147 && relativeLocation[146] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 147)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 146 && relativeLocation[145] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 146)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 145 && relativeLocation[144] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 145)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 144 && relativeLocation[143] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 144)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 143 && relativeLocation[142] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 143)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 142 && relativeLocation[141] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 142)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 141 && relativeLocation[140] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 141)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 140 && relativeLocation[139] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 140)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 139 && relativeLocation[138] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 139)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 138 && relativeLocation[137] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 138)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 137 && relativeLocation[136] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 137)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 136 && relativeLocation[135] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 136)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 135 && relativeLocation[134] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 135)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 134 && relativeLocation[133] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 134)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 133 && relativeLocation[132] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 133)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 132 && relativeLocation[131] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 132)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 131 && relativeLocation[130] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 131)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 130 && relativeLocation[129] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 130)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 129 && relativeLocation[128] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 129)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 128 && relativeLocation[127] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 128)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 127 && relativeLocation[126] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 127)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 126 && relativeLocation[125] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 126)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 125 && relativeLocation[124] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 125)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 124 && relativeLocation[123] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 124)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 123 && relativeLocation[122] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 123)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 122 && relativeLocation[121] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 122)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 121 && relativeLocation[120] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 121)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 120 && relativeLocation[119] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 120)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 119 && relativeLocation[118] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 119)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 118 && relativeLocation[117] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 118)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 117 && relativeLocation[116] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 117)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 116 && relativeLocation[115] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 116)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 115 && relativeLocation[114] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 115)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 114 && relativeLocation[113] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 114)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 113 && relativeLocation[112] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 113)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 112 && relativeLocation[111] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 112)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 111 && relativeLocation[110] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 111)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 110 && relativeLocation[109] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 110)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 109 && relativeLocation[108] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 109)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 108 && relativeLocation[107] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 108)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 107 && relativeLocation[106] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 107)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 106 && relativeLocation[105] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 106)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 101 && relativeLocation[100] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 101)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 100 && relativeLocation[99] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 100)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 98 && relativeLocation[97] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 98)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 96 && relativeLocation[95] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 96)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 94 && relativeLocation[93] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 94)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 93 && relativeLocation[92] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 93)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 92 && relativeLocation[91] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 92)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 91 && relativeLocation[90] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 91)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 88 && relativeLocation[87] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 88)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 87 && relativeLocation[86] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 87)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 86 && relativeLocation[85] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 86)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 82 && relativeLocation[81] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 82)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 75 && relativeLocation[74] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 75)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 32 && relativeLocation[31] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 32)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 28 && relativeLocation[27] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 28)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 27 && relativeLocation[26] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 27)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 25 && relativeLocation[24] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 25)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 22 && relativeLocation[21] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 22)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 21 && relativeLocation[20] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 21)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 20 && relativeLocation[19] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 20)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 19 && relativeLocation[18] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 19)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 18 && relativeLocation[17] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 18)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 17 && relativeLocation[16] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 17)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 16 && relativeLocation[15] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 16)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 15 && relativeLocation[14] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 15)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 2 && relativeLocation[1] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 2)))
      return blacklistCheck(match);

  return null;
};


/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

function getIssuerModule(parent) {
  let issuer = parent;

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
    issuer = issuer.parent;
  }

  return issuer;
}

/**
 * Returns information about a package in a safe way (will throw if they cannot be retrieved)
 */

function getPackageInformationSafe(packageLocator) {
  const packageInformation = exports.getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw makeError(
      `INTERNAL`,
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`
    );
  }

  return packageInformation;
}

/**
 * Implements the node resolution for folder access and extension selection
 */

function applyNodeExtensionResolution(unqualifiedPath, {extensions}) {
  // We use this "infinite while" so that we can restart the process as long as we hit package folders
  while (true) {
    let stat;

    try {
      stat = statSync(unqualifiedPath);
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory()) {
      // If the very last component of the resolved path is a symlink to a file, we then resolve it to a file. We only
      // do this first the last component, and not the rest of the path! This allows us to support the case of bin
      // symlinks, where a symlink in "/xyz/pkg-name/.bin/bin-name" will point somewhere else (like "/xyz/pkg-name/index.js").
      // In such a case, we want relative requires to be resolved relative to "/xyz/pkg-name/" rather than "/xyz/pkg-name/.bin/".
      //
      // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)
      // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using
      // peer dependencies. For example, "/xyz/.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires
      // be resolved relative to "/xyz/.pnp/local/pnp-0123456789/" rather than "/xyz/pkg-with-peers/", because otherwise
      // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its
      // ancestors.

      if (lstatSync(unqualifiedPath).isSymbolicLink()) {
        unqualifiedPath = path.normalize(path.resolve(path.dirname(unqualifiedPath), readlinkSync(unqualifiedPath)));
      }

      return unqualifiedPath;
    }

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson;

      try {
        pkgJson = JSON.parse(readFileSync(`${unqualifiedPath}/package.json`, 'utf-8'));
      } catch (error) {}

      let nextUnqualifiedPath;

      if (pkgJson && pkgJson.main) {
        nextUnqualifiedPath = path.resolve(unqualifiedPath, pkgJson.main);
      }

      // If the "main" field changed the path, we start again from this new location

      if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {
        const resolution = applyNodeExtensionResolution(nextUnqualifiedPath, {extensions});

        if (resolution !== null) {
          return resolution;
        }
      }
    }

    // Otherwise we check if we find a file that match one of the supported extensions

    const qualifiedPath = extensions
      .map(extension => {
        return `${unqualifiedPath}${extension}`;
      })
      .find(candidateFile => {
        return existsSync(candidateFile);
      });

    if (qualifiedPath) {
      return qualifiedPath;
    }

    // Otherwise, we check if the path is a folder - in such a case, we try to use its index

    if (stat && stat.isDirectory()) {
      const indexPath = extensions
        .map(extension => {
          return `${unqualifiedPath}/index${extension}`;
        })
        .find(candidateFile => {
          return existsSync(candidateFile);
        });

      if (indexPath) {
        return indexPath;
      }
    }

    // Otherwise there's nothing else we can do :(

    return null;
  }
}

/**
 * This function creates fake modules that can be used with the _resolveFilename function.
 * Ideally it would be nice to be able to avoid this, since it causes useless allocations
 * and cannot be cached efficiently (we recompute the nodeModulePaths every time).
 *
 * Fortunately, this should only affect the fallback, and there hopefully shouldn't be a
 * lot of them.
 */

function makeFakeModule(path) {
  const fakeModule = new Module(path, false);
  fakeModule.filename = path;
  fakeModule.paths = Module._nodeModulePaths(path);
  return fakeModule;
}

/**
 * Normalize path to posix format.
 */

function normalizePath(fsPath) {
  fsPath = path.normalize(fsPath);

  if (process.platform === 'win32') {
    fsPath = fsPath.replace(backwardSlashRegExp, '/');
  }

  return fsPath;
}

/**
 * Forward the resolution to the next resolver (usually the native one)
 */

function callNativeResolution(request, issuer) {
  if (issuer.endsWith('/')) {
    issuer += 'internal.js';
  }

  try {
    enableNativeHooks = false;

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(request, makeFakeModule(issuer), false);
  } finally {
    enableNativeHooks = true;
  }
}

/**
 * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
 * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
 * to override the standard, and can only offer new methods.
 *
 * If an new version of the Plug'n'Play standard is released and some extensions conflict with newly added
 * functions, they'll just have to fix the conflicts and bump their own version number.
 */

exports.VERSIONS = {std: 1};

/**
 * Useful when used together with getPackageInformation to fetch information about the top-level package.
 */

exports.topLevel = {name: null, reference: null};

/**
 * Gets the package information for a given locator. Returns null if they cannot be retrieved.
 */

exports.getPackageInformation = function getPackageInformation({name, reference}) {
  const packageInformationStore = packageInformationStores.get(name);

  if (!packageInformationStore) {
    return null;
  }

  const packageInformation = packageInformationStore.get(reference);

  if (!packageInformation) {
    return null;
  }

  return packageInformation;
};

/**
 * Transforms a request (what's typically passed as argument to the require function) into an unqualified path.
 * This path is called "unqualified" because it only changes the package name to the package location on the disk,
 * which means that the end result still cannot be directly accessed (for example, it doesn't try to resolve the
 * file extension, or to resolve directories to their "index.js" content). Use the "resolveUnqualified" function
 * to convert them to fully-qualified paths, or just use "resolveRequest" that do both operations in one go.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveToUnqualified = function resolveToUnqualified(request, issuer, {considerBuiltins = true} = {}) {
  // The 'pnpapi' request is reserved and will always return the path to the PnP file, from everywhere

  if (request === `pnpapi`) {
    return pnpFile;
  }

  // Bailout if the request is a native module

  if (considerBuiltins && builtinModules.has(request)) {
    return null;
  }

  // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,
  // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is
  // typically solved using workspaces, but not all of them have been converted already.

  if (ignorePattern && ignorePattern.test(normalizePath(issuer))) {
    const result = callNativeResolution(request, issuer);

    if (result === false) {
      throw makeError(
        `BUILTIN_NODE_RESOLUTION_FAIL`,
        `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp "null")`,
        {
          request,
          issuer,
        }
      );
    }

    return result;
  }

  let unqualifiedPath;

  // If the request is a relative or absolute path, we just return it normalized

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    if (path.isAbsolute(request)) {
      unqualifiedPath = path.normalize(request);
    } else if (issuer.match(isDirRegExp)) {
      unqualifiedPath = path.normalize(path.resolve(issuer, request));
    } else {
      unqualifiedPath = path.normalize(path.resolve(path.dirname(issuer), request));
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch;

    const issuerLocator = exports.findPackageLocator(issuer);

    // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
    // resolution algorithm in the chain, usually the native Node resolution one

    if (!issuerLocator) {
      const result = callNativeResolution(request, issuer);

      if (result === false) {
        throw makeError(
          `BUILTIN_NODE_RESOLUTION_FAIL`,
          `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree)`,
          {
            request,
            issuer,
          }
        );
      }

      return result;
    }

    const issuerInformation = getPackageInformationSafe(issuerLocator);

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);

    // If we can't find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.
    // It's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able
    // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.

    if (issuerLocator !== topLevelLocator) {
      for (let t = 0, T = fallbackLocators.length; dependencyReference === undefined && t < T; ++t) {
        const fallbackInformation = getPackageInformationSafe(fallbackLocators[t]);
        dependencyReference = fallbackInformation.packageDependencies.get(dependencyName);
      }
    }

    // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

    if (!dependencyReference) {
      if (dependencyReference === null) {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you're the top-level package)`,
            {request, issuer, dependencyName}
          );
        } else {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn't`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName}
          );
        }
      } else {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies (via "${issuer}")`,
            {request, issuer, dependencyName}
          );
        } else {
          const candidates = Array.from(issuerInformation.packageDependencies.keys());
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" (via "${issuer}") is trying to require the package "${dependencyName}" (via "${request}") without it being listed in its dependencies (${candidates.join(
              `, `
            )})`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates}
          );
        }
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyLocator = {name: dependencyName, reference: dependencyReference};
    const dependencyInformation = exports.getPackageInformation(dependencyLocator);
    const dependencyLocation = path.resolve(__dirname, dependencyInformation.packageLocation);

    if (!dependencyLocation) {
      throw makeError(
        `MISSING_DEPENDENCY`,
        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn't been installed and thus cannot be required (it might be caused if you install a partial tree, such as on production environments)`,
        {request, issuer, dependencyLocator: Object.assign({}, dependencyLocator)}
      );
    }

    // Now that we know which package we should resolve to, we only have to find out the file location

    if (subPath) {
      unqualifiedPath = path.resolve(dependencyLocation, subPath);
    } else {
      unqualifiedPath = dependencyLocation;
    }
  }

  return path.normalize(unqualifiedPath);
};

/**
 * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically
 * appends ".js" / ".json", and transforms directory accesses into "index.js").
 */

exports.resolveUnqualified = function resolveUnqualified(
  unqualifiedPath,
  {extensions = Object.keys(Module._extensions)} = {}
) {
  const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, {extensions});

  if (qualifiedPath) {
    return path.normalize(qualifiedPath);
  } else {
    throw makeError(
      `QUALIFIED_PATH_RESOLUTION_FAILED`,
      `Couldn't find a suitable Node resolution for unqualified path "${unqualifiedPath}"`,
      {unqualifiedPath}
    );
  }
};

/**
 * Transforms a request into a fully qualified path.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveRequest = function resolveRequest(request, issuer, {considerBuiltins, extensions} = {}) {
  let unqualifiedPath;

  try {
    unqualifiedPath = exports.resolveToUnqualified(request, issuer, {considerBuiltins});
  } catch (originalError) {
    // If we get a BUILTIN_NODE_RESOLUTION_FAIL error there, it means that we've had to use the builtin node
    // resolution, which usually shouldn't happen. It might be because the user is trying to require something
    // from a path loaded through a symlink (which is not possible, because we need something normalized to
    // figure out which package is making the require call), so we try to make the same request using a fully
    // resolved issuer and throws a better and more actionable error if it works.
    if (originalError.code === `BUILTIN_NODE_RESOLUTION_FAIL`) {
      let realIssuer;

      try {
        realIssuer = realpathSync(issuer);
      } catch (error) {}

      if (realIssuer) {
        if (issuer.endsWith(`/`)) {
          realIssuer = realIssuer.replace(/\/?$/, `/`);
        }

        try {
          exports.resolveToUnqualified(request, realIssuer, {considerBuiltins});
        } catch (error) {
          // If an error was thrown, the problem doesn't seem to come from a path not being normalized, so we
          // can just throw the original error which was legit.
          throw originalError;
        }

        // If we reach this stage, it means that resolveToUnqualified didn't fail when using the fully resolved
        // file path, which is very likely caused by a module being invoked through Node with a path not being
        // correctly normalized (ie you should use "node $(realpath script.js)" instead of "node script.js").
        throw makeError(
          `SYMLINKED_PATH_DETECTED`,
          `A pnp module ("${request}") has been required from what seems to be a symlinked path ("${issuer}"). This is not possible, you must ensure that your modules are invoked through their fully resolved path on the filesystem (in this case "${realIssuer}").`,
          {
            request,
            issuer,
            realIssuer,
          }
        );
      }
    }
    throw originalError;
  }

  if (unqualifiedPath === null) {
    return null;
  }

  try {
    return exports.resolveUnqualified(unqualifiedPath, {extensions});
  } catch (resolutionError) {
    if (resolutionError.code === 'QUALIFIED_PATH_RESOLUTION_FAILED') {
      Object.assign(resolutionError.data, {request, issuer});
    }
    throw resolutionError;
  }
};

/**
 * Setups the hook into the Node environment.
 *
 * From this point on, any call to `require()` will go through the "resolveRequest" function, and the result will
 * be used as path of the file to load.
 */

exports.setup = function setup() {
  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load;

  Module._load = function(request, parent, isMain) {
    if (!enableNativeHooks) {
      return originalModuleLoad.call(Module, request, parent, isMain);
    }

    // Builtins are managed by the regular Node loader

    if (builtinModules.has(request)) {
      try {
        enableNativeHooks = false;
        return originalModuleLoad.call(Module, request, parent, isMain);
      } finally {
        enableNativeHooks = true;
      }
    }

    // The 'pnpapi' name is reserved to return the PnP api currently in use by the program

    if (request === `pnpapi`) {
      return pnpModule.exports;
    }

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain);

    // Check if the module has already been created for the given file

    const cacheEntry = Module._cache[modulePath];

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

    const module = new Module(modulePath, parent);
    Module._cache[modulePath] = module;

    // The main module is exposed as global variable

    if (isMain) {
      process.mainModule = module;
      module.id = '.';
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.load(modulePath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        delete Module._cache[modulePath];
      }
    }

    // Some modules might have to be patched for compatibility purposes

    for (const [filter, patchFn] of patchedModules) {
      if (filter.test(request)) {
        module.exports = patchFn(exports.findPackageLocator(parent.filename), module.exports);
      }
    }

    return module.exports;
  };

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request, parent, isMain, options) {
    if (!enableNativeHooks) {
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);
    }

    let issuers;

    if (options) {
      const optionNames = new Set(Object.keys(options));
      optionNames.delete('paths');

      if (optionNames.size > 0) {
        throw makeError(
          `UNSUPPORTED`,
          `Some options passed to require() aren't supported by PnP yet (${Array.from(optionNames).join(', ')})`
        );
      }

      if (options.paths) {
        issuers = options.paths.map(entry => `${path.normalize(entry)}/`);
      }
    }

    if (!issuers) {
      const issuerModule = getIssuerModule(parent);
      const issuer = issuerModule ? issuerModule.filename : `${process.cwd()}/`;

      issuers = [issuer];
    }

    let firstError;

    for (const issuer of issuers) {
      let resolution;

      try {
        resolution = exports.resolveRequest(request, issuer);
      } catch (error) {
        firstError = firstError || error;
        continue;
      }

      return resolution !== null ? resolution : request;
    }

    throw firstError;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request, paths, isMain) {
    if (!enableNativeHooks) {
      return originalFindPath.call(Module, request, paths, isMain);
    }

    for (const path of paths) {
      let resolution;

      try {
        resolution = exports.resolveRequest(request, path);
      } catch (error) {
        continue;
      }

      if (resolution) {
        return resolution;
      }
    }

    return false;
  };

  process.versions.pnp = String(exports.VERSIONS.std);
};

exports.setupCompatibilityLayer = () => {
  // ESLint currently doesn't have any portable way for shared configs to specify their own
  // plugins that should be used (https://github.com/eslint/eslint/issues/10125). This will
  // likely get fixed at some point, but it'll take time and in the meantime we'll just add
  // additional fallback entries for common shared configs.

  for (const name of [`react-scripts`]) {
    const packageInformationStore = packageInformationStores.get(name);
    if (packageInformationStore) {
      for (const reference of packageInformationStore.keys()) {
        fallbackLocators.push({name, reference});
      }
    }
  }

  // Modern versions of `resolve` support a specific entry point that custom resolvers can use
  // to inject a specific resolution logic without having to patch the whole package.
  //
  // Cf: https://github.com/browserify/resolve/pull/174

  patchedModules.push([
    /^\.\/normalize-options\.js$/,
    (issuer, normalizeOptions) => {
      if (!issuer || issuer.name !== 'resolve') {
        return normalizeOptions;
      }

      return (request, opts) => {
        opts = opts || {};

        if (opts.forceNodeResolution) {
          return opts;
        }

        opts.preserveSymlinks = true;
        opts.paths = function(request, basedir, getNodeModulesDir, opts) {
          // Extract the name of the package being requested (1=full name, 2=scope name, 3=local name)
          const parts = request.match(/^((?:(@[^\/]+)\/)?([^\/]+))/);

          // make sure that basedir ends with a slash
          if (basedir.charAt(basedir.length - 1) !== '/') {
            basedir = path.join(basedir, '/');
          }
          // This is guaranteed to return the path to the "package.json" file from the given package
          const manifestPath = exports.resolveToUnqualified(`${parts[1]}/package.json`, basedir);

          // The first dirname strips the package.json, the second strips the local named folder
          let nodeModules = path.dirname(path.dirname(manifestPath));

          // Strips the scope named folder if needed
          if (parts[2]) {
            nodeModules = path.dirname(nodeModules);
          }

          return [nodeModules];
        };

        return opts;
      };
    },
  ]);
};

if (module.parent && module.parent.id === 'internal/preload') {
  exports.setupCompatibilityLayer();

  exports.setup();
}

if (process.mainModule === module) {
  exports.setupCompatibilityLayer();

  const reportError = (code, message, data) => {
    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\n`);
  };

  const reportSuccess = resolution => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`);
  };

  const processResolution = (request, issuer) => {
    try {
      reportSuccess(exports.resolveRequest(request, issuer));
    } catch (error) {
      reportError(error.code, error.message, error.data);
    }
  };

  const processRequest = data => {
    try {
      const [request, issuer] = JSON.parse(data);
      processResolution(request, issuer);
    } catch (error) {
      reportError(`INVALID_JSON`, error.message, error.data);
    }
  };

  if (process.argv.length > 2) {
    if (process.argv.length !== 4) {
      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\n`);
      process.exitCode = 64; /* EX_USAGE */
    } else {
      processResolution(process.argv[2], process.argv[3]);
    }
  } else {
    let buffer = '';
    const decoder = new StringDecoder.StringDecoder();

    process.stdin.on('data', chunk => {
      buffer += decoder.write(chunk);

      do {
        const index = buffer.indexOf('\n');
        if (index === -1) {
          break;
        }

        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);

        processRequest(line);
      } while (true);
    });
  }
}
