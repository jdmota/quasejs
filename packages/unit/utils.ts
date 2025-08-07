export function hasInspectArg(execArgv: readonly string[]) {
  return execArgv.some(arg => /^--inspect(=|-|$)/.test(arg));
}
