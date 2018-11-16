// @flow

export type AssignmentOperator = null | "+" | "-" | "*" | "**" | "/" | "%" | "<<" | ">>" | ">>>" | "|" | "^" | "&";

export type UpdateOperator = "++" | "--";

export type BinaryAndUnary = "-" | "+";

export type UnaryNotBinaryIdentifier = "typeof";

export type UnaryNotBinaryNotIdentifier = UpdateOperator | "!" | "~";

export type UnaryNotBinary = UnaryNotBinaryIdentifier | UnaryNotBinaryNotIdentifier;

export type UnaryOperator = BinaryAndUnary | UnaryNotBinary;

export type BinaryOperatorIdentifier = "in" | "is" | "as";

export type BinaryOperatorNotIdentifier =
  BinaryAndUnary | "*" | "**" | "/" | "%" |
  "==" | "!=" | "===" | "!==" |
  "<" | "<=" | ">" | ">=" |
  "<<" | ">>" | ">>>" |
  "|" | "^" | "&" |
  "||" | "&&" |
  "!in" | "!is" | "as?";

export type BinaryOperator = BinaryOperatorIdentifier | BinaryOperatorNotIdentifier;

export type AssignToken = {|
  +label: "_=",
  +isAssign: true,
  +op: AssignmentOperator
|};

export type IdentifierToken = {|
  +label: "identifier",
  +value: string,
  +isLoop?: boolean
|};

export type KeywordToken = {|
  +label: "identifier",
  +value: string,
  +keyword: true,
  +isLoop?: boolean
|} | {|
  +label: "identifier",
  +value: BinaryOperatorIdentifier,
  +keyword: true,
  +binop: number
|} | {|
  +label: "identifier",
  +value: UnaryNotBinaryIdentifier,
  +keyword: true,
  +prefix: boolean,
  +postfix: boolean
|};

export type StringToken = {|
  +label: "string",
  +value: string,
  +raw: string
|};

export type TemplateToken = {|
  +label: "template",
  +raw: string
|};

export type CharToken = {|
  +label: "char",
  +value: string,
  +raw: string,
|};

export type NumberToken = {|
  +label: "number",
  +raw: string,
  +integer: boolean,
  +bigint: boolean,
  +float: boolean,
  +radix: number
|};

export type RegExpToken = {|
  +label: "regexp",
  +pattern: string,
  +flags: string,
  +raw: string
|};

type Eof = {|
  +label: "eof"
|};

type Initial = {|
  +label: ""
|};

type OtherToken = {|
  +label: "other",
  +value: string
|} | {|
  +label: "other",
  +value: BinaryOperatorNotIdentifier,
  +binop: number,
  +rightAssociative?: boolean
|} | {|
  +label: "other",
  +value: UnaryNotBinaryNotIdentifier,
  +prefix?: boolean,
  +postfix?: boolean
|} | {|
  +label: "other",
  +value: BinaryAndUnary,
  +binop: number,
  +rightAssociative?: boolean,
  +prefix?: boolean,
  +postfix?: boolean
|};

export type Token = Initial | Eof | AssignToken | IdentifierToken | KeywordToken | StringToken | TemplateToken | CharToken | NumberToken | RegExpToken | OtherToken;

function t( value: string ): Token {
  return {
    label: "other",
    value
  };
}

function binop( value: BinaryOperatorNotIdentifier, binop: number ): Token {
  return {
    label: "other",
    value,
    binop
  };
}

function binopKeyword( value: BinaryOperatorIdentifier, binop: number ): KeywordToken {
  return {
    label: "identifier",
    value,
    binop,
    keyword: true
  };
}

const tokens = {
  eof: { label: "eof" },

  // Punctuation token types
  bracketL: t( "[" ),
  bracketR: t( "]" ),
  braceL: t( "{" ),
  braceBarL: t( "{|" ),
  braceR: t( "}" ),
  braceBarR: t( "|}" ),
  parenL: t( "(" ),
  parenR: t( ")" ),
  comma: t( "," ),
  semi: t( ";" ),
  colon: t( ":" ),
  doubleColon: t( "::" ),
  dot: t( "." ),
  question: t( "?" ),
  questionDot: t( "?." ),
  questionBracketL: t( "?[" ),
  questionParenL: t( "?(" ),
  arrow: t( "=>" ),
  ellipsis: t( "..." ),
  backQuote: t( "`" ),
  quote: t( "\"" ),
  dollarBraceL: t( "${" ),
  at: t( "@" ),
  hash: t( "#" ),

  eq: { label: "_=", isAssign: true, op: null },

  inc: { label: "other", value: "++", prefix: true, postfix: true },
  dec: { label: "other", value: "--", prefix: true, postfix: true },

  bang: { label: "other", value: "!", prefix: true, postfix: true },
  tilde: { label: "other", value: "~", prefix: true },

  logicalOR: binop( "||", 1 ),
  logicalAND: binop( "&&", 2 ),
  bitwiseOR: binop( "|", 3 ),
  bitwiseXOR: binop( "^", 4 ),
  bitwiseAND: binop( "&", 5 ),

  equals: binop( "==", 6 ),
  notEquals: binop( "!=", 6 ),
  strictEquals: binop( "===", 6 ),
  strictNotEquals: binop( "!==", 6 ),

  less: binop( "<", 7 ),
  greater: binop( ">", 7 ),
  lessEqual: binop( "<=", 7 ),
  greaterEqual: binop( ">=", 7 ),

  strictAs: binopKeyword( "as", 7 ),
  optionalAs: binop( "as?", 7 ),

  is: binopKeyword( "is", 7 ),
  in: binopKeyword( "in", 7 ),
  isNot: binop( "!is", 7 ),
  inNot: binop( "!in", 7 ),

  leftShift: binop( "<<", 8 ),
  signRightShift: binop( ">>", 8 ),
  zeroRightShift: binop( ">>>", 8 ),

  plus: { label: "other", value: "+", binop: 9, prefix: true },
  minus: { label: "other", value: "-", binop: 9, prefix: true },
  modulo: binop( "%", 10 ),
  star: binop( "*", 10 ),
  slash: binop( "/", 10 ),
  exponent: { label: "other", value: "**", binop: 11, rightAssociative: true }
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Arithmetic_Operators

const keywordsArr = [
  "abstract", "allopen", "as", "async", "await", "break", "case", "catch", "class", "continue", "debugger", "do", "else",
  "export", "extends", "false", "final", "finally", "for", "fun", "gen", "if", "import", "in", "interface", "internal", "is",
  "match", "memoized", "new", "null", "open", "override", "private", "protected", "public", "pure", "rec", "return",
  "sealed", "static", "super", "switch", "tail", "this", "throw", "true", "try", "type", "typeof", "val", "var", "while", "yield"
];

export const funModifiers = {
  async: true,
  gen: true,
  memoized: true,
  pure: true,
  rec: true,
  tail: true
};

export const classModifiers = {
  abstract: true,
  allopen: true,
  final: true,
  open: true,
  sealed: true
};

export const propModifiers = {
  abstract: true,
  final: true,
  open: true,
  override: true,
  private: true,
  protected: true,
  public: true,
  static: true
};

const modifiers: { [key: string]: boolean } = {};
for ( const obj of [ funModifiers, classModifiers, propModifiers ] ) {
  for ( const m in obj ) {
    modifiers[ m ] = true;
  }
}

const keywords: { [key: string]: KeywordToken } = {
  do: {
    label: "identifier",
    value: "do",
    keyword: true,
    isLoop: true
  },
  for: {
    label: "identifier",
    value: "for",
    keyword: true,
    isLoop: true
  },
  while: {
    label: "identifier",
    value: "while",
    keyword: true,
    isLoop: true
  },
  typeof: {
    label: "identifier",
    value: "typeof",
    keyword: true,
    prefix: true,
    postfix: false
  },
  val: {
    label: "identifier",
    value: "val",
    keyword: true
  },
  var: {
    label: "identifier",
    value: "var",
    keyword: true
  },
  as: tokens.strictAs,
  in: tokens.in,
  is: tokens.is
};

for ( const name of keywordsArr ) {
  if ( !keywords[ name ] ) {
    keywords[ name ] = {
      label: "identifier",
      value: name,
      keyword: true
    };
  }
}

export { tokens, keywords, modifiers };
