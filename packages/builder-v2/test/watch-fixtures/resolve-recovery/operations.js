module.exports = [
  [ "remove", "./x.js" ],
  [ "ensureDir", "./x" ],
  [ "writeFile", "./x/index.js", "export default 'good';\n" ],
];
