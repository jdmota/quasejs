module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  },
  _error: "Circular 'export * from \"\";' declarations. files/a.js->files/b.js->files/c.js->files/a.js"
};
