import { error } from "../../runtime/error";
import { Tokenizer as RuntimeTokenizer } from "../../runtime/tokenizer";
import {
  Position as RuntimePosition,
  Location as RuntimeLocation,
} from "../../runtime/tokenizer";

/* eslint default-case: 0, no-fallthrough: 0 */

export type Position = RuntimePosition;

export type Location = RuntimeLocation;

export type Comment = {
  type: "CommentBlock" | "CommentLine";
  value: string;
  loc: Location;
};

const idStart = /[_a-z]/i;
const idChars = /[_0-9a-z]/i;
const hexDigit = /[0-9a-f]/i;

const escapeToValue: { [key: string]: string } = {
  b: "\b",
  t: "\t",
  n: "\n",
  f: "\f",
  r: "\r",
  "'": "'",
  "\\": "\\",
};

const lineBreak = /\r\n?|\n/;
const lineBreakG = new RegExp(lineBreak.source, "g");

export type IdToken = {
  id: 1;
  label: "id";
  image: string;
};

export type StringToken = {
  id: 2;
  label: "string";
  image: string;
  value: string;
};

export type RegexpToken = {
  id: 3;
  label: "regexp";
  image: string;
  pattern: string;
  flags: string;
};

export type ActionToken = {
  id: 4;
  label: "action";
  image: string;
  value: string;
};

export type OtherToken = {
  id: 5;
  label: string;
  image: string;
};

export type Token =
  | IdToken
  | StringToken
  | RegexpToken
  | ActionToken
  | OtherToken
  | typeof RuntimeTokenizer.EOF;

export class GrammarTokenizer extends RuntimeTokenizer<Token, string> {
  private comments: Comment[];
  private lastToken: Token | null;

  constructor(input: string) {
    super(input);
    this.comments = [];
    this.lastToken = null;
  }

  getComments(): readonly Comment[] {
    return this.comments;
  }

  // Override
  nextToken() {
    this.performSkip();
    this.lastToken = super.nextToken();
    return this.lastToken;
  }

  private error(message: string) {
    throw error(message, this.curPosition());
  }

  private charAt(index: number) {
    return this.input.charAt(index);
  }

  private isNewLine(code: number): boolean {
    return code === 10 || code === 13;
  }

  private skip(): boolean {
    const code = this.codeAt(this.pos);
    switch (code) {
      case 13: // '\r' carriage return
        // If the next char is '\n', move to pos+1 and let the next branch handle it
        if (this.codeAt(this.pos + 1) === 10) {
          this.pos++;
        }
      case 10: // '\n' line feed
        this.pos++;
        this.nextLine();
        return true;
      case 9: // horizontal tab
      case 12: // form feed
      case 32: // space
        this.pos++;
        return true;

      case 47: // '/'
        switch (this.codeAt(this.pos + 1)) {
          case 42: // '*'
            this.skipBlockComment();
            return true;
          case 47:
            this.skipLineComment();
            return true;
        }
    }
    return false;
  }

  private performSkip(): void {
    while (this.pos < this.inputLen) {
      if (!this.skip()) {
        break;
      }
    }
  }

  private skipLineComment(): void {
    const start = this.curPosition();

    let ch = this.codeAt((this.pos += 2));
    if (this.pos < this.inputLen) {
      while (!this.isNewLine(ch) && ++this.pos < this.inputLen) {
        ch = this.codeAt(this.pos);
      }
    }

    this.pushComment(
      false,
      this.input.slice(start.pos + 2, this.pos),
      start,
      this.curPosition()
    );
  }

  private skipBlockComment(): void {
    const start = this.curPosition();

    const end = this.input.indexOf("*/", (this.pos += 2));
    if (end === -1) {
      throw new Error("Unterminated comment");
    }
    this.pos = end + 2;

    const comment = this.input.slice(start.pos + 2, end);

    lineBreakG.lastIndex = start.pos;

    let match;
    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
      this._curLine++;
      this._lineStart = match.index + match[0].length;
    }

    this.pushComment(true, comment, start, this.curPosition());
  }

  private pushComment(
    block: boolean,
    value: string,
    start: Position,
    end: Position
  ) {
    this.comments.push({
      type: block ? "CommentBlock" : "CommentLine",
      value,
      loc: {
        start,
        end,
      },
    });
  }

  private readIdentifier(): Token {
    return {
      id: 1,
      label: "id",
      image: this.readWord(),
    };
  }

  private readWord() {
    const start = this.pos;
    while (this.pos < this.inputLen) {
      if (idChars.test(this.charAt(this.pos))) {
        this.pos++;
      } else {
        break;
      }
    }
    return this.input.slice(start, this.pos);
  }

  private readHex() {
    let hex = "";
    while (true) {
      const c = this.charAt(this.pos);

      if (hexDigit.test(c)) {
        hex += c;
        this.pos++;

        if (hex.length > 6) {
          throw this.error("Invalid unicode escape sequence");
        }
      } else {
        break;
      }
    }

    if (hex.length === 0) {
      throw this.error("Invalid unicode escape sequence");
    }

    return String.fromCodePoint(Number.parseInt(hex, 16));
  }

  private readString(): StringToken {
    const start = this.pos;
    this.pos++;

    let value = "";

    while (true) {
      const c = this.charAt(this.pos);

      // End of input or new line
      if (this.pos >= this.inputLen || this.isNewLine(c.charCodeAt(0))) {
        throw this.error("Unterminated string");
      }

      // String close
      if (c === "'") {
        if (this.pos - start === 1) {
          throw this.error("Empty string");
        }
        this.pos++;
        break;
      }

      // Escape
      if (c === "\\") {
        this.pos++;
        const c = this.charAt(this.pos);

        if (c === "u") {
          this.pos++;
          value += this.readHex();
        } else {
          const v = escapeToValue[c];
          if (v) {
            value += v;
            this.pos++;
          } else {
            throw this.error("Invalid escape sequence");
          }
        }
      } else {
        value += c;
        this.pos++;
      }
    }

    return {
      id: 2,
      label: "string",
      value,
      image: this.input.slice(start, this.pos),
    };
  }

  private readRegexp(): RegexpToken {
    const start = this.pos;
    let escaped = false;
    let inClass = false;

    this.pos++;

    while (true) {
      const c = this.codeAt(this.pos);

      if (this.pos >= this.inputLen || this.isNewLine(c)) {
        throw this.error("Unterminated regular expression");
      }

      if (escaped) {
        escaped = false;
      } else {
        if (c === 91) {
          // "["
          inClass = true;
        } else if (c === 93 && inClass) {
          // "]"
          inClass = false;
        } else if (c === 47 && !inClass) {
          // "/"
          this.pos++;
          break;
        }
        escaped = c === 92; // "\\"
      }
      this.pos++;
    }

    const pattern = this.input.slice(start + 1, this.pos - 1);

    const flags = this.readWord();
    if (flags) {
      const validFlags = /^[gmsiyu]*$/;
      if (!validFlags.test(flags)) {
        throw this.error("Invalid regular expression flag");
      }
    }

    return {
      id: 3,
      label: "regexp",
      pattern,
      flags,
      image: this.input.slice(start, this.pos),
    };
  }

  private readAction(): ActionToken {
    const start = this.pos;
    const stack: string[] = ["action"];
    this.pos++;

    let char;
    while (stack.length) {
      if (this.pos >= this.inputLen) {
        throw this.error("Unterminated action");
      }

      char = this.charAt(this.pos);

      switch (char) {
        case "{":
          stack.push("{");
          break;
        case "}": {
          const top = stack.pop();
          if (top === "{" || top === "action") {
            break;
          }
          throw this.unexpected();
        }
        case '"':
        case "'":
        case "`": {
          const top = stack[stack.length - 1];
          if (top === char) {
            stack.pop(); // End of string
          } else {
            switch (top) {
              case '"':
              case "'":
              case "`":
                break; // Still in string
              default:
                stack.push(char); // Start of string
            }
          }
          break;
        }
        case "\\": {
          this.pos++;
          break;
        }
        default:
      }

      this.pos++;
    }

    return {
      id: 4,
      label: "action",
      value: this.input.slice(start + 1, this.pos - 1),
      image: this.input.slice(start, this.pos),
    };
  }

  // Override
  readToken(): Token {
    const char = this.charAt(this.pos);

    if (char === "'") {
      return this.readString();
    }

    if (char === "/") {
      return this.readRegexp();
    }

    if (idStart.test(char)) {
      return this.readIdentifier();
    }

    if (char === "{") {
      return this.readAction();
    }

    if (char === "-" && this.charAt(this.pos + 1) === ">") {
      this.pos += 2;
      return {
        id: 5,
        label: "->",
        image: "->",
      };
    }

    switch (char) {
      case "(":
      case ")":
      case "|":
      case "?":
      case "*":
      case "+":
        if (this.charAt(this.pos + 1) === "=") {
          this.pos += 2;
          return {
            id: 5,
            label: "+=",
            image: "+=",
          };
        }
      case ":": // eslint-disable-line no-fallthrough
      case "=":
      case ";":
      case "@":
      case ".":
        this.pos++;
        return {
          id: 5,
          label: char,
          image: char,
        };
      default:
    }

    throw this.unexpected();
  }
}
