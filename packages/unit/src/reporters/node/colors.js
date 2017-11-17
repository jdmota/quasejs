const chalk = require( "chalk" );

export default {
  _reset: chalk.styles && chalk.styles.reset,
  title: chalk.bold && chalk.bold.white,
  error: chalk.red,
  skip: chalk.yellow,
  todo: chalk.blue,
  pass: chalk.green,
  duration: chalk.gray && chalk.gray.dim,
  slow: chalk.yellow,
  sourceLine: chalk.bgRed,
  sourceNumber: chalk.grey,
  errorStack: chalk.gray,
  added: chalk.green,
  removed: chalk.red,
  addedBg: chalk.bgGreen && chalk.bgGreen.black,
  removedBg: chalk.bgRed && chalk.bgRed.black,
  information: chalk.magenta,
  identity: v => v
};
