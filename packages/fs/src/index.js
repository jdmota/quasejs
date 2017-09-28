const fs = require( "fs-extra" );

// TODO add https://github.com/zkochan/symlink-dir
// TODO add https://github.com/IndigoUnited/node-proper-lockfile

export const {
  FSWatcher,
  ReadStream,
  Stats,
  WriteStream,
  constants,
  createReadStream,
  createWriteStream,
  unwatchFile,
  watch,

  access,
  appendFile,
  chmod,
  chown,
  close,
  exists,
  fchmod,
  fchown,
  fdatasync,
  fstat,
  fsync,
  ftruncate,
  futimes,
  lchmod,
  lchown,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  read,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rmdir,
  stat,
  symlink,
  truncate,
  unlink,
  utimes,
  write,
  writeFile,

  copy,
  emptyDir,
  ensureDir,
  ensureFile,
  ensureLink,
  ensureSymlink,
  move,
  outputFile,
  outputJson,
  readJson,
  remove,
  writeJson
} = fs;

// Alias
export {
  emptyDir as emptydir,
  ensureDir as mkdirs,
  ensureDir as mkdirp,
  ensureFile as createFile,
  readJson as readJSON,
  writeJson as writeJSON
};
