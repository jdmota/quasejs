module.exports = {
  babelOpts: {
    parserOpts: {
      sourceType: "module",
      plugins: [
        "dynamicImport",
        "importMeta",
        "exportDefaultFrom",
        "exportNamespaceFrom"
      ]
    },
    presets: [
      [ "@babel/preset-env", {
        targets: { chrome: 50 },
        modules: false,
        loose: true
      } ]
    ],
  },
  _error: "./a exports nothing. See index.js:1:7"
};
