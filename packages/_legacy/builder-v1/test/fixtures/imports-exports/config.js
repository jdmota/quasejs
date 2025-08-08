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
    }
  }
  _out: [
    "1 2 3 4 5 6 7 8 9 10 11"
  ]
};
