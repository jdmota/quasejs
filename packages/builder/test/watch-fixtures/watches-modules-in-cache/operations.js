module.exports = [
  [ "writeFile", "./index.js", "import stuff from './stuff';" ],
  [ "writeFile", "./a.js", "export default 30;" ],
  [ "writeFile", "./index.js", "import a from './a';" ]
];
