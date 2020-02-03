module.exports = function(api) {
  api.cache.forever();

  return {
    // "sourceMaps": true,
    sourceType: "module",
    ignore: ["**/*.min.js", "**/node_modules/**"],
    overrides: [
      {
        test: "**/*.ts",
        presets: ["@babel/preset-typescript"],
      },
    ],
    plugins: [
      // "istanbul",
      "@babel/plugin-proposal-object-rest-spread",
      ["@babel/plugin-proposal-class-properties", { loose: true }],
    ],
    presets: [
      [
        "@babel/preset-env",
        {
          loose: true,
          targets: {
            node: "13",
            // "browsers": [ "last 3 versions", "not ie <= 11", "not ie_mob <= 11" ],
            // http://browserl.ist/?q=last+3+versions%2C+not+ie+%3C%3D+11%2C+not+ie_mob+%3C%3D+11
            // "electron": "1.7"
          },
        },
      ],
    ],
  };
};
