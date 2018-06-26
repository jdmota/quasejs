module.exports = function( api ) {
  api.cache( true );

  return {
    // "sourceMaps": true,
    sourceType: "module",
    parserOpts: {
      sourceType: "module"
    },
    plugins: [
      // "istanbul",
      // [ "module:fast-async", { "spec": true } ],
      "@babel/plugin-transform-flow-strip-types",
      "@babel/plugin-proposal-object-rest-spread",
      [ "@babel/plugin-proposal-class-properties", { loose: true } ]
    ],
    ignore: [
      "**/*.min.js",
      "**/node_modules/**"
    ],
    presets: [
      [ "@babel/preset-env", {
        targets: {
          node: "8"
          // "browsers": [ "last 3 versions", "not ie <= 11", "not ie_mob <= 11" ],
          // http://browserl.ist/?q=last+3+versions%2C+not+ie+%3C%3D+11%2C+not+ie_mob+%3C%3D+11
          // "electron": "1.7"
        },
        loose: true
        // "modules": true,
        // "exclude": [ "transform-regenerator", "transform-async-to-generator" ]
      } ]
    ]
  };
};