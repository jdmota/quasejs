require("@babel/register")({
  extensions: [".js", ".ts"],
  ignore: [/node_modules/],
  // Ignore any node_modules (not just those in current working directory)
  // https://github.com/babel/babel/blob/master/packages/babel-register/src/node.js#L146
});
