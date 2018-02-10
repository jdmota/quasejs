import JsLanguage from "../src/languages/js";
import HtmlLanguage from "../src/languages/html";
import babelPlugin from "../src/plugins/babel";

const BABEL_OPTS = {
  babelrc: false,
  parserOpts: {
    sourceType: "module",
    plugins: [
      "classProperties",
      "dynamicImport",
      "exportDefaultFrom",
      "exportNamespaceFrom"
    ]
  },
  presets: [
    [ "@babel/env", {
      targets: { chrome: 50 },
      modules: false,
      loose: true
    } ]
  ]
};

export default function( config, fixturePath ) {
  config = config || {};
  config.cwd = fixturePath;
  config.sourceMaps = config.sourceMaps === undefined ? true : config.sourceMaps;
  config.languages = [
    [ JsLanguage, { resolve: config.resolve } ],
    HtmlLanguage
  ];
  config.plugins = config.plugins || [];
  config.plugins.push( [ babelPlugin, Object.assign( {}, BABEL_OPTS, config.babelOpts ) ] );
  return config;
}
