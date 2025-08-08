module.exports = [
  [ "rename", "./a.js", "./b.js" ],
  [ "writeFile", "./index.js", "import b from './b';" ]
];
