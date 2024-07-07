const filename = ".npmrc";

function checkLine(line: string) {
  if (line.includes("_auth=")) {
    return `Found _auth token in ${filename}`;
  }
  if (line.includes("_authToken=")) {
    return `Found _authToken token in ${filename}`;
  }
}

export default function (_filename: string, text: string) {
  const lines = text.split("\n");
  const errors = [];
  for (const line of lines) {
    const err = checkLine(line);
    if (err) {
      errors.push(err);
    }
  }
  return errors;
}
