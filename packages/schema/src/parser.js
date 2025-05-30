/* eslint-disable */
const Q = require("@quase/parser");

class Tokenizer extends Q.Tokenizer {
  constructor(input) {
    super(input);
    this.labels = [
      "",
      "'type'",
      "'{'",
      "'}'",
      "';'",
      "'='",
      "':'",
      "'@'",
      "'('",
      "','",
      "')'",
      "'|'",
      "'[]'",
      "'?'",
      "'['",
      "']'",
      "BOOLEAN",
      "NUM",
      "STRING",
      "JS_RAW",
      "JS_RAW_0",
      "JS_STRING",
      "JS_COMMENT",
      "JS_ESC",
      "ID",
      "SKIP",
    ];
    this.idToChannels = { 25: [] };
    this.channels = {};
  }
  readToken() {
    const prevPos = this.pos;
    let id = -1;

    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (this.current === 9 /*'	'*/) {
            this.consume1(9 /*'	'*/);
            $$state = 2;
          } else if (this.current === 10 /*'
'*/) {
            this.consume1(10 /*'
'*/);
            $$state = 2;
          } else if (this.current === 11 /*''*/) {
            this.consume1(11 /*''*/);
            $$state = 2;
          } else if (this.current === 12 /*''*/) {
            this.consume1(12 /*''*/);
            $$state = 2;
          } else if (this.current === 13 /*'
'*/) {
            this.consume1(13 /*'
'*/);
            $$state = 2;
          } else if (this.current === 32 /*' '*/) {
            this.consume1(32 /*' '*/);
            $$state = 2;
          } else if (this.current === 34 /*'"'*/) {
            this.consume1(34 /*'"'*/);
            $$state = 3;
          } else if (this.current === 40 /*'('*/) {
            this.consume1(40 /*'('*/);
            $$state = 6;
          } else if (this.current === 41 /*')'*/) {
            this.consume1(41 /*')'*/);
            $$state = 7;
          } else if (this.current === 44 /*','*/) {
            this.consume1(44 /*','*/);
            $$state = 8;
          } else if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 9;
          } else if (this.current === 58 /*':'*/) {
            this.consume1(58 /*':'*/);
            $$state = 10;
          } else if (this.current === 59 /*';'*/) {
            this.consume1(59 /*';'*/);
            $$state = 11;
          } else if (this.current === 61 /*'='*/) {
            this.consume1(61 /*'='*/);
            $$state = 12;
          } else if (this.current === 63 /*'?'*/) {
            this.consume1(63 /*'?'*/);
            $$state = 13;
          } else if (this.current === 64 /*'@'*/) {
            this.consume1(64 /*'@'*/);
            $$state = 14;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 91 /*'['*/) {
            this.consume1(91 /*'['*/);
            $$state = 16;
          } else if (this.current === 93 /*']'*/) {
            this.consume1(93 /*']'*/);
            $$state = 18;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 101 /*'e'*/
          ) {
            this.consume2(97 /*'a'*/, 101 /*'e'*/);
            $$state = 15;
          } else if (this.current === 102 /*'f'*/) {
            this.consume1(102 /*'f'*/);
            $$state = 19;
          } else if (
            /*'g'*/ 103 <= this.current &&
            this.current <= 105 /*'i'*/
          ) {
            this.consume2(103 /*'g'*/, 105 /*'i'*/);
            $$state = 15;
          } else if (this.current === 106 /*'j'*/) {
            this.consume1(106 /*'j'*/);
            $$state = 24;
          } else if (
            /*'k'*/ 107 <= this.current &&
            this.current <= 115 /*'s'*/
          ) {
            this.consume2(107 /*'k'*/, 115 /*'s'*/);
            $$state = 15;
          } else if (this.current === 116 /*'t'*/) {
            this.consume1(116 /*'t'*/);
            $$state = 27;
          } else if (
            /*'u'*/ 117 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(117 /*'u'*/, 122 /*'z'*/);
            $$state = 15;
          } else if (this.current === 123 /*'{'*/) {
            this.consume1(123 /*'{'*/);
            $$state = 32;
          } else if (this.current === 124 /*'|'*/) {
            this.consume1(124 /*'|'*/);
            $$state = 33;
          } else if (this.current === 125 /*'}'*/) {
            this.consume1(125 /*'}'*/);
            $$state = 34;
          } else {
            $$loop = false;
          }
          break;
        case 2:
          if (this.current === 9 /*'	'*/) {
            this.consume1(9 /*'	'*/);
            $$state = 2;
          } else if (this.current === 10 /*'
'*/) {
            this.consume1(10 /*'
'*/);
            $$state = 2;
          } else if (this.current === 11 /*''*/) {
            this.consume1(11 /*''*/);
            $$state = 2;
          } else if (this.current === 12 /*''*/) {
            this.consume1(12 /*''*/);
            $$state = 2;
          } else if (this.current === 13 /*'
'*/) {
            this.consume1(13 /*'
'*/);
            $$state = 2;
          } else if (this.current === 32 /*' '*/) {
            this.consume1(32 /*' '*/);
            $$state = 2;
          } else {
            id = 25;
            $$state = 35;
          }
          break;
        case 3:
          if (/*' '*/ 0 <= this.current && this.current <= 33 /*'!'*/) {
            this.consume2(0 /*' '*/, 33 /*'!'*/);
            $$state = 3;
          } else if (this.current === 34 /*'"'*/) {
            this.consume1(34 /*'"'*/);
            $$state = 4;
          } else if (/*'#'*/ 35 <= this.current && this.current <= 91 /*'['*/) {
            this.consume2(35 /*'#'*/, 91 /*'['*/);
            $$state = 3;
          } else if (this.current === 92 /*'\'*/) {
            this.consume1(92 /*'\'*/);
            $$state = 5;
          } else if (
            /*']'*/ 93 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(93 /*']'*/, 1114111 /*'􏿿'*/);
            $$state = 3;
          } else {
            $$loop = false;
          }
          break;
        case 4:
          {
            id = 18;
            $$state = 35;
          }
          break;
        case 5:
          if (/*' '*/ 0 <= this.current && this.current <= 1114111 /*'􏿿'*/) {
            this.consume2(0 /*' '*/, 1114111 /*'􏿿'*/);
            $$state = 3;
          } else {
            $$loop = false;
          }
          break;
        case 6:
          {
            id = 8;
            $$state = 35;
          }
          break;
        case 7:
          {
            id = 10;
            $$state = 35;
          }
          break;
        case 8:
          {
            id = 9;
            $$state = 35;
          }
          break;
        case 9:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 9;
          } else {
            id = 17;
            $$state = 35;
          }
          break;
        case 10:
          {
            id = 6;
            $$state = 35;
          }
          break;
        case 11:
          {
            id = 4;
            $$state = 35;
          }
          break;
        case 12:
          {
            id = 5;
            $$state = 35;
          }
          break;
        case 13:
          {
            id = 13;
            $$state = 35;
          }
          break;
        case 14:
          {
            id = 7;
            $$state = 35;
          }
          break;
        case 15:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(97 /*'a'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 16:
          if (this.current === 93 /*']'*/) {
            this.consume1(93 /*']'*/);
            $$state = 17;
          } else {
            id = 14;
            $$state = 35;
          }
          break;
        case 17:
          {
            id = 12;
            $$state = 35;
          }
          break;
        case 18:
          {
            id = 15;
            $$state = 35;
          }
          break;
        case 19:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (this.current === 97 /*'a'*/) {
            this.consume1(97 /*'a'*/);
            $$state = 20;
          } else if (
            /*'b'*/ 98 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(98 /*'b'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 20:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 107 /*'k'*/
          ) {
            this.consume2(97 /*'a'*/, 107 /*'k'*/);
            $$state = 15;
          } else if (this.current === 108 /*'l'*/) {
            this.consume1(108 /*'l'*/);
            $$state = 21;
          } else if (
            /*'m'*/ 109 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(109 /*'m'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 21:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 114 /*'r'*/
          ) {
            this.consume2(97 /*'a'*/, 114 /*'r'*/);
            $$state = 15;
          } else if (this.current === 115 /*'s'*/) {
            this.consume1(115 /*'s'*/);
            $$state = 22;
          } else if (
            /*'t'*/ 116 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(116 /*'t'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 22:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 100 /*'d'*/
          ) {
            this.consume2(97 /*'a'*/, 100 /*'d'*/);
            $$state = 15;
          } else if (this.current === 101 /*'e'*/) {
            this.consume1(101 /*'e'*/);
            $$state = 23;
          } else if (
            /*'f'*/ 102 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(102 /*'f'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 23:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(97 /*'a'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 16;
            $$state = 35;
          }
          break;
        case 24:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 114 /*'r'*/
          ) {
            this.consume2(97 /*'a'*/, 114 /*'r'*/);
            $$state = 15;
          } else if (this.current === 115 /*'s'*/) {
            this.consume1(115 /*'s'*/);
            $$state = 25;
          } else if (
            /*'t'*/ 116 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(116 /*'t'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 25:
          if (this.current === 40 /*'('*/) {
            this.ruleJS_RAW_0();
            $$state = 26;
          } else if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(97 /*'a'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 26:
          {
            id = 19;
            $$state = 35;
          }
          break;
        case 27:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 113 /*'q'*/
          ) {
            this.consume2(97 /*'a'*/, 113 /*'q'*/);
            $$state = 15;
          } else if (this.current === 114 /*'r'*/) {
            this.consume1(114 /*'r'*/);
            $$state = 28;
          } else if (
            /*'s'*/ 115 <= this.current &&
            this.current <= 120 /*'x'*/
          ) {
            this.consume2(115 /*'s'*/, 120 /*'x'*/);
            $$state = 15;
          } else if (this.current === 121 /*'y'*/) {
            this.consume1(121 /*'y'*/);
            $$state = 29;
          } else if (this.current === 122 /*'z'*/) {
            this.consume1(122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 28:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 116 /*'t'*/
          ) {
            this.consume2(97 /*'a'*/, 116 /*'t'*/);
            $$state = 15;
          } else if (this.current === 117 /*'u'*/) {
            this.consume1(117 /*'u'*/);
            $$state = 22;
          } else if (
            /*'v'*/ 118 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(118 /*'v'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 29:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 111 /*'o'*/
          ) {
            this.consume2(97 /*'a'*/, 111 /*'o'*/);
            $$state = 15;
          } else if (this.current === 112 /*'p'*/) {
            this.consume1(112 /*'p'*/);
            $$state = 30;
          } else if (
            /*'q'*/ 113 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(113 /*'q'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 30:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 100 /*'d'*/
          ) {
            this.consume2(97 /*'a'*/, 100 /*'d'*/);
            $$state = 15;
          } else if (this.current === 101 /*'e'*/) {
            this.consume1(101 /*'e'*/);
            $$state = 31;
          } else if (
            /*'f'*/ 102 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(102 /*'f'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 24;
            $$state = 35;
          }
          break;
        case 31:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 15;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 15;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 15;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(97 /*'a'*/, 122 /*'z'*/);
            $$state = 15;
          } else {
            id = 1;
            $$state = 35;
          }
          break;
        case 32:
          {
            id = 2;
            $$state = 35;
          }
          break;
        case 33:
          {
            id = 11;
            $$state = 35;
          }
          break;
        case 34:
          {
            id = 3;
            $$state = 35;
          }
          break;
        case 35:
          {
            $$loop = false;
          }
          break;
      }
    }

    if (id === -1) {
      throw this.unexpected();
    }

    const image = this.input.slice(prevPos, this.pos);
    const splitted = image.split(/\r\n?|\n/g);
    const newLines = splitted.length - 1;
    if (newLines > 0) {
      this._lineStart = this.pos - splitted[newLines].length;
      this._curLine += newLines;
    }
    return {
      id,
      label: this.labels[id],
      image,
    };
  }
  ruleBOOLEAN() {
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (this.current === 102 /*'f'*/) {
            this.consume1(102 /*'f'*/);
            $$state = 2;
          } else if (this.current === 116 /*'t'*/) {
            this.consume1(116 /*'t'*/);
            $$state = 6;
          } else {
            $$loop = false;
          }
          break;
        case 2:
          if (this.current === 97 /*'a'*/) {
            this.consume1(97 /*'a'*/);
            $$state = 3;
          } else {
            $$loop = false;
          }
          break;
        case 3:
          if (this.current === 108 /*'l'*/) {
            this.consume1(108 /*'l'*/);
            $$state = 4;
          } else {
            $$loop = false;
          }
          break;
        case 4:
          if (this.current === 115 /*'s'*/) {
            this.consume1(115 /*'s'*/);
            $$state = 5;
          } else {
            $$loop = false;
          }
          break;
        case 5:
          if (this.current === 101 /*'e'*/) {
            this.consume1(101 /*'e'*/);
            $$state = 8;
          } else {
            $$loop = false;
          }
          break;
        case 6:
          if (this.current === 114 /*'r'*/) {
            this.consume1(114 /*'r'*/);
            $$state = 7;
          } else {
            $$loop = false;
          }
          break;
        case 7:
          if (this.current === 117 /*'u'*/) {
            this.consume1(117 /*'u'*/);
            $$state = 5;
          } else {
            $$loop = false;
          }
          break;
        case 8:
          {
            $$loop = false;
          }
          break;
      }
    }
  }
  ruleNUM() {
    this.consume2(48 /*'0'*/, 57 /*'9'*/);
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
        this.consume2(48 /*'0'*/, 57 /*'9'*/);
        $$state = 2;
      } else {
        $$loop = false;
      }
    }
  }
  ruleSTRING() {
    this.consume1(34 /*'"'*/);
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (/*' '*/ 0 <= this.current && this.current <= 33 /*'!'*/) {
            this.consume2(0 /*' '*/, 33 /*'!'*/);
            $$state = 2;
          } else if (this.current === 34 /*'"'*/) {
            this.consume1(34 /*'"'*/);
            $$state = 4;
          } else if (/*'#'*/ 35 <= this.current && this.current <= 91 /*'['*/) {
            this.consume2(35 /*'#'*/, 91 /*'['*/);
            $$state = 2;
          } else if (this.current === 92 /*'\'*/) {
            this.consume1(92 /*'\'*/);
            $$state = 3;
          } else if (
            /*']'*/ 93 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(93 /*']'*/, 1114111 /*'􏿿'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 3:
          if (/*' '*/ 0 <= this.current && this.current <= 1114111 /*'􏿿'*/) {
            this.consume2(0 /*' '*/, 1114111 /*'􏿿'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 4:
          {
            $$loop = false;
          }
          break;
      }
    }
  }
  ruleJS_RAW() {
    this.consume1(106 /*'j'*/);
    this.consume1(115 /*'s'*/);
    this.ruleJS_RAW_0();
  }
  ruleJS_RAW_0() {
    this.consume1(40 /*'('*/);
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (/*' '*/ 0 <= this.current && this.current <= 33 /*'!'*/) {
            this.consume2(0 /*' '*/, 33 /*'!'*/);
            $$state = 2;
          } else if (this.current === 34 /*'"'*/) {
            this.ruleJS_STRING();
            $$state = 2;
          } else if (/*'#'*/ 35 <= this.current && this.current <= 38 /*'&'*/) {
            this.consume2(35 /*'#'*/, 38 /*'&'*/);
            $$state = 2;
          } else if (this.current === 39 /*'''*/) {
            this.ruleJS_STRING();
            $$state = 2;
          } else if (this.current === 40 /*'('*/) {
            this.ruleJS_RAW_0();
            $$state = 2;
          } else if (this.current === 41 /*')'*/) {
            this.consume1(41 /*')'*/);
            $$state = 3;
          } else if (/*'*'*/ 42 <= this.current && this.current <= 46 /*'.'*/) {
            this.consume2(42 /*'*'*/, 46 /*'.'*/);
            $$state = 2;
          } else if (this.current === 47 /*'/'*/) {
            this.ruleJS_COMMENT();
            $$state = 2;
          } else if (/*'0'*/ 48 <= this.current && this.current <= 91 /*'['*/) {
            this.consume2(48 /*'0'*/, 91 /*'['*/);
            $$state = 2;
          } else if (this.current === 92 /*'\'*/) {
            this.ruleJS_ESC();
            $$state = 2;
          } else if (/*']'*/ 93 <= this.current && this.current <= 95 /*'_'*/) {
            this.consume2(93 /*']'*/, 95 /*'_'*/);
            $$state = 2;
          } else if (this.current === 96 /*'`'*/) {
            this.ruleJS_STRING();
            $$state = 2;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(97 /*'a'*/, 1114111 /*'􏿿'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 3:
          {
            $$loop = false;
          }
          break;
      }
    }
  }
  ruleJS_STRING() {
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (this.current === 34 /*'"'*/) {
            this.consume1(34 /*'"'*/);
            $$state = 2;
          } else if (this.current === 39 /*'''*/) {
            this.consume1(39 /*'''*/);
            $$state = 4;
          } else if (this.current === 96 /*'`'*/) {
            this.consume1(96 /*'`'*/);
            $$state = 6;
          } else {
            $$loop = false;
          }
          break;
        case 2:
          if (/*' '*/ 0 <= this.current && this.current <= 33 /*'!'*/) {
            this.consume2(0 /*' '*/, 33 /*'!'*/);
            $$state = 2;
          } else if (this.current === 34 /*'"'*/) {
            this.consume1(34 /*'"'*/);
            $$state = 8;
          } else if (/*'#'*/ 35 <= this.current && this.current <= 91 /*'['*/) {
            this.consume2(35 /*'#'*/, 91 /*'['*/);
            $$state = 2;
          } else if (this.current === 92 /*'\'*/) {
            this.consume1(92 /*'\'*/);
            $$state = 3;
          } else if (
            /*']'*/ 93 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(93 /*']'*/, 1114111 /*'􏿿'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 3:
          if (/*' '*/ 0 <= this.current && this.current <= 1114111 /*'􏿿'*/) {
            this.consume2(0 /*' '*/, 1114111 /*'􏿿'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 4:
          if (/*' '*/ 0 <= this.current && this.current <= 38 /*'&'*/) {
            this.consume2(0 /*' '*/, 38 /*'&'*/);
            $$state = 4;
          } else if (this.current === 39 /*'''*/) {
            this.consume1(39 /*'''*/);
            $$state = 8;
          } else if (/*'('*/ 40 <= this.current && this.current <= 91 /*'['*/) {
            this.consume2(40 /*'('*/, 91 /*'['*/);
            $$state = 4;
          } else if (this.current === 92 /*'\'*/) {
            this.consume1(92 /*'\'*/);
            $$state = 5;
          } else if (
            /*']'*/ 93 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(93 /*']'*/, 1114111 /*'􏿿'*/);
            $$state = 4;
          } else {
            $$loop = false;
          }
          break;
        case 5:
          if (/*' '*/ 0 <= this.current && this.current <= 1114111 /*'􏿿'*/) {
            this.consume2(0 /*' '*/, 1114111 /*'􏿿'*/);
            $$state = 4;
          } else {
            $$loop = false;
          }
          break;
        case 6:
          if (/*' '*/ 0 <= this.current && this.current <= 91 /*'['*/) {
            this.consume2(0 /*' '*/, 91 /*'['*/);
            $$state = 6;
          } else if (this.current === 92 /*'\'*/) {
            this.consume1(92 /*'\'*/);
            $$state = 7;
          } else if (/*']'*/ 93 <= this.current && this.current <= 95 /*'_'*/) {
            this.consume2(93 /*']'*/, 95 /*'_'*/);
            $$state = 6;
          } else if (this.current === 96 /*'`'*/) {
            this.consume1(96 /*'`'*/);
            $$state = 8;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(97 /*'a'*/, 1114111 /*'􏿿'*/);
            $$state = 6;
          } else {
            $$loop = false;
          }
          break;
        case 7:
          if (/*' '*/ 0 <= this.current && this.current <= 1114111 /*'􏿿'*/) {
            this.consume2(0 /*' '*/, 1114111 /*'􏿿'*/);
            $$state = 6;
          } else {
            $$loop = false;
          }
          break;
        case 8:
          {
            $$loop = false;
          }
          break;
      }
    }
  }
  ruleJS_COMMENT() {
    this.consume1(47 /*'/'*/);
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (this.current === 42 /*'*'*/) {
            this.consume1(42 /*'*'*/);
            $$state = 3;
          } else if (this.current === 47 /*'/'*/) {
            this.consume1(47 /*'/'*/);
            $$state = 6;
          } else {
            $$loop = false;
          }
          break;
        case 3:
          if (/*' '*/ 0 <= this.current && this.current <= 41 /*')'*/) {
            this.consume2(0 /*' '*/, 41 /*')'*/);
            $$state = 4;
          } else if (this.current === 42 /*'*'*/) {
            this.consume1(42 /*'*'*/);
            $$state = 5;
          } else if (/*'+'*/ 43 <= this.current && this.current <= 46 /*'.'*/) {
            this.consume2(43 /*'+'*/, 46 /*'.'*/);
            $$state = 4;
          } else if (
            /*'0'*/ 48 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(48 /*'0'*/, 1114111 /*'􏿿'*/);
            $$state = 4;
          } else {
            $$loop = false;
          }
          break;
        case 4:
          if (/*' '*/ 0 <= this.current && this.current <= 41 /*')'*/) {
            this.consume2(0 /*' '*/, 41 /*')'*/);
            $$state = 4;
          } else if (this.current === 42 /*'*'*/) {
            this.consume1(42 /*'*'*/);
            $$state = 5;
          } else if (/*'+'*/ 43 <= this.current && this.current <= 46 /*'.'*/) {
            this.consume2(43 /*'+'*/, 46 /*'.'*/);
            $$state = 4;
          } else if (this.current === 47 /*'/'*/) {
            this.consume1(47 /*'/'*/);
            $$state = 4;
          } else if (
            /*'0'*/ 48 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(48 /*'0'*/, 1114111 /*'􏿿'*/);
            $$state = 4;
          } else {
            $$loop = false;
          }
          break;
        case 5:
          if (/*' '*/ 0 <= this.current && this.current <= 41 /*')'*/) {
            this.consume2(0 /*' '*/, 41 /*')'*/);
            $$state = 4;
          } else if (this.current === 42 /*'*'*/) {
            this.consume1(42 /*'*'*/);
            $$state = 5;
          } else if (/*'+'*/ 43 <= this.current && this.current <= 46 /*'.'*/) {
            this.consume2(43 /*'+'*/, 46 /*'.'*/);
            $$state = 4;
          } else if (this.current === 47 /*'/'*/) {
            this.consume1(47 /*'/'*/);
            $$state = 7;
          } else if (
            /*'0'*/ 48 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(48 /*'0'*/, 1114111 /*'􏿿'*/);
            $$state = 4;
          } else {
            $$loop = false;
          }
          break;
        case 6:
          if (/*' '*/ 0 <= this.current && this.current <= 9 /*'	'*/) {
            this.consume2(0 /*' '*/, 9 /*'	'*/);
            $$state = 6;
          } else if (this.current === 10 /*'
'*/) {
            this.consume1(10 /*'
'*/);
            $$state = 7;
          } else if (/*''*/ 11 <= this.current && this.current <= 12 /*''*/) {
            this.consume2(11 /*''*/, 12 /*''*/);
            $$state = 6;
          } else if (this.current === 13 /*'
'*/) {
            this.consume1(13 /*'
'*/);
            $$state = 7;
          } else if (
            /*''*/ 14 <= this.current &&
            this.current <= 1114111 /*'􏿿'*/
          ) {
            this.consume2(14 /*''*/, 1114111 /*'􏿿'*/);
            $$state = 6;
          } else {
            $$loop = false;
          }
          break;
        case 7:
          {
            $$loop = false;
          }
          break;
      }
    }
  }
  ruleJS_ESC() {
    this.consume1(92 /*'\'*/);
    this.consume2(0 /*' '*/, 1114111 /*'􏿿'*/);
  }
  ruleID() {
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 2;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 2;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(97 /*'a'*/, 122 /*'z'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 2:
          if (/*'0'*/ 48 <= this.current && this.current <= 57 /*'9'*/) {
            this.consume2(48 /*'0'*/, 57 /*'9'*/);
            $$state = 2;
          } else if (/*'A'*/ 65 <= this.current && this.current <= 90 /*'Z'*/) {
            this.consume2(65 /*'A'*/, 90 /*'Z'*/);
            $$state = 2;
          } else if (this.current === 95 /*'_'*/) {
            this.consume1(95 /*'_'*/);
            $$state = 2;
          } else if (
            /*'a'*/ 97 <= this.current &&
            this.current <= 122 /*'z'*/
          ) {
            this.consume2(97 /*'a'*/, 122 /*'z'*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
      }
    }
  }
  ruleSKIP() {
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (this.current === 9 /*'	'*/) {
            this.consume1(9 /*'	'*/);
            $$state = 2;
          } else if (this.current === 10 /*'
'*/) {
            this.consume1(10 /*'
'*/);
            $$state = 2;
          } else if (this.current === 11 /*''*/) {
            this.consume1(11 /*''*/);
            $$state = 2;
          } else if (this.current === 12 /*''*/) {
            this.consume1(12 /*''*/);
            $$state = 2;
          } else if (this.current === 13 /*'
'*/) {
            this.consume1(13 /*'
'*/);
            $$state = 2;
          } else if (this.current === 32 /*' '*/) {
            this.consume1(32 /*' '*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
        case 2:
          if (this.current === 9 /*'	'*/) {
            this.consume1(9 /*'	'*/);
            $$state = 2;
          } else if (this.current === 10 /*'
'*/) {
            this.consume1(10 /*'
'*/);
            $$state = 2;
          } else if (this.current === 11 /*''*/) {
            this.consume1(11 /*''*/);
            $$state = 2;
          } else if (this.current === 12 /*''*/) {
            this.consume1(12 /*''*/);
            $$state = 2;
          } else if (this.current === 13 /*'
'*/) {
            this.consume1(13 /*'
'*/);
            $$state = 2;
          } else if (this.current === 32 /*' '*/) {
            this.consume1(32 /*' '*/);
            $$state = 2;
          } else {
            $$loop = false;
          }
          break;
      }
    }
  }
}
class Parser extends Q.Parser {
  constructor(text) {
    super(new Tokenizer(text));
  }
  unexpected(id) {
    const labels = this.tokenizer.labels;
    super.unexpected(labels[id] || id);
  }

  ruleSchema() {
    let $$loc = this.startNode();
    let $types = [];
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      if (this.current === 1 /*'type'*/) {
        $types.push(this.ruleTypeDeclaration());
        $$state = 1;
      } else if (this.current === 0 /*EOF*/) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "Schema", types: $types, loc: this.locNode($$loc) };
  }
  ruleTypeDeclaration() {
    let $$loc = this.startNode();
    let $name,
      $decorators = [],
      $properties = [],
      $init = null;
    this.consume1(1 /*'type'*/);
    $name = this.consume1(24 /*ID*/);
    $name = $name.image;
    let $$state = 4,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 4:
          if (this.current === 2 /*'{'*/) {
            this.consume1(2 /*'{'*/);
            $$state = 5;
          } else if (this.current === 5 /*'='*/) {
            this.consume1(5 /*'='*/);
            $$state = 6;
          } else if (this.current === 7 /*'@'*/) {
            $decorators.push(this.ruleDecorator());
            $$state = 4;
          } else {
            throw this.unexpected();
          }
          break;
        case 5:
          if (this.current === 3 /*'}'*/) {
            this.consume1(3 /*'}'*/);
            $$state = 9;
          } else if (this.current === 24 /*ID*/) {
            $properties.push(this.ruleTypeProperty());
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 6:
          if (
            this.current === 1 /*'type'*/ ||
            this.current === 8 /*'('*/ ||
            this.current === 14 /*'['*/ ||
            this.current === 16 /*BOOLEAN*/ ||
            this.current === 17 /*NUM*/ ||
            this.current === 18 /*STRING*/ ||
            this.current === 24 /*ID*/
          ) {
            $init = this.ruleType();
            $$state = 7;
          } else {
            throw this.unexpected();
          }
          break;
        case 7:
          if (this.current === 4 /*';'*/) {
            this.consume1(4 /*';'*/);
            $$state = 8;
          } else {
            throw this.unexpected();
          }
          break;
        case 8:
          if (this.current === 1 /*'type'*/ || this.current === 0 /*EOF*/) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
        case 9:
          if (this.current === 1 /*'type'*/) {
            $$loop = false;
          } else if (this.current === 4 /*';'*/) {
            this.consume1(4 /*';'*/);
            $$state = 8;
          } else if (this.current === 0 /*EOF*/) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return {
      type: "TypeDeclaration",
      name: $name,
      decorators: $decorators,
      properties: $properties,
      init: $init,
      loc: this.locNode($$loc),
    };
  }
  ruleTypeProperty() {
    let $$loc = this.startNode();
    let $name,
      $typeSignature,
      $decorators = [];
    $name = this.consume1(24 /*ID*/);
    $name = $name.image;
    this.consume1(6 /*':'*/);
    $typeSignature = this.ruleType();
    let $$state = 5,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 5:
          if (this.current === 4 /*';'*/) {
            this.consume1(4 /*';'*/);
            $$state = 6;
          } else if (this.current === 7 /*'@'*/) {
            $decorators.push(this.ruleDecorator());
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 6:
          if (this.current === 3 /*'}'*/ || this.current === 24 /*ID*/) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return {
      type: "TypeProperty",
      name: $name,
      typeSignature: $typeSignature,
      decorators: $decorators,
      loc: this.locNode($$loc),
    };
  }
  ruleDecoratorArg() {
    let $$loc = this.startNode();
    let $t;
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (this.current === 16 /*BOOLEAN*/) {
            $t = this.ruleBoolean();
            $$state = 2;
          } else if (this.current === 17 /*NUM*/) {
            $t = this.ruleNumber();
            $$state = 2;
          } else if (this.current === 18 /*STRING*/) {
            $t = this.ruleString();
            $$state = 2;
          } else if (this.current === 19 /*JS_RAW*/) {
            $t = this.ruleJs();
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 2:
          if (this.current === 9 /*','*/ || this.current === 10 /*')'*/) {
            return $t;
            $$state = 3;
          } else {
            throw this.unexpected();
          }
          break;
        case 3:
          if (this.current === 9 /*','*/ || this.current === 10 /*')'*/) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return { type: "DecoratorArg", t: $t, loc: this.locNode($$loc) };
  }
  ruleDecorator() {
    let $$loc = this.startNode();
    let $name,
      $arguments = [];
    this.consume1(7 /*'@'*/);
    $name = this.consume1(24 /*ID*/);
    $name = $name.image;
    let $$state = 8,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 4:
          if (this.current === 10 /*')'*/) {
            this.consume1(10 /*')'*/);
            $$state = 7;
          } else if (
            this.current === 16 /*BOOLEAN*/ ||
            this.current === 17 /*NUM*/ ||
            this.current === 18 /*STRING*/ ||
            this.current === 19 /*JS_RAW*/
          ) {
            $arguments.push(this.ruleDecoratorArg());
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 5:
          if (this.current === 9 /*','*/) {
            this.consume1(9 /*','*/);
            $$state = 6;
          } else if (this.current === 10 /*')'*/) {
            this.consume1(10 /*')'*/);
            $$state = 7;
          } else {
            throw this.unexpected();
          }
          break;
        case 6:
          if (
            this.current === 16 /*BOOLEAN*/ ||
            this.current === 17 /*NUM*/ ||
            this.current === 18 /*STRING*/ ||
            this.current === 19 /*JS_RAW*/
          ) {
            $arguments.push(this.ruleDecoratorArg());
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 7:
          if (
            this.current === 2 /*'{'*/ ||
            this.current === 4 /*';'*/ ||
            this.current === 5 /*'='*/ ||
            this.current === 7 /*'@'*/
          ) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
        case 8:
          if (
            this.current === 2 /*'{'*/ ||
            this.current === 4 /*';'*/ ||
            this.current === 5 /*'='*/ ||
            this.current === 7 /*'@'*/
          ) {
            $$loop = false;
          } else if (this.current === 8 /*'('*/) {
            this.consume1(8 /*'('*/);
            $$state = 4;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return {
      type: "Decorator",
      name: $name,
      arguments: $arguments,
      loc: this.locNode($$loc),
    };
  }
  ruleType() {
    let $$loc = this.startNode();
    let $t;
    $t = this.ruleMaybeUnion();
    return $t;
    let $$state = 3,
      $$loop = true;
    while ($$loop) {
      if (
        this.current === 4 /*';'*/ ||
        this.current === 7 /*'@'*/ ||
        this.current === 9 /*','*/ ||
        this.current === 10 /*')'*/ ||
        this.current === 15 /*']'*/
      ) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "Type", t: $t, loc: this.locNode($$loc) };
  }
  ruleMaybeUnion() {
    let $$loc = this.startNode();
    let $t1,
      $t2 = null;
    $t1 = this.ruleMaybeArrayOrOptional();
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/
          ) {
            return $t1;
            $$state = 5;
          } else if (this.current === 11 /*'|'*/) {
            this.consume1(11 /*'|'*/);
            $$state = 3;
          } else if (this.current === 15 /*']'*/) {
            return $t1;
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 3:
          if (
            this.current === 1 /*'type'*/ ||
            this.current === 8 /*'('*/ ||
            this.current === 14 /*'['*/ ||
            this.current === 16 /*BOOLEAN*/ ||
            this.current === 17 /*NUM*/ ||
            this.current === 18 /*STRING*/ ||
            this.current === 24 /*ID*/
          ) {
            $t2 = this.ruleMaybeArrayOrOptional();
            $$state = 4;
          } else {
            throw this.unexpected();
          }
          break;
        case 4:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 15 /*']'*/
          ) {
            $t1 = { type: "Union", type1: $t1, type2: $t2 };
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 5:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 15 /*']'*/
          ) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return { type: "MaybeUnion", t1: $t1, t2: $t2, loc: this.locNode($$loc) };
  }
  ruleMaybeArrayOrOptional() {
    let $$loc = this.startNode();
    let $t;
    $t = this.ruleTypeAtom();
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/
          ) {
            return $t;
            $$state = 5;
          } else if (this.current === 12 /*'[]'*/) {
            this.consume1(12 /*'[]'*/);
            $$state = 3;
          } else if (this.current === 13 /*'?'*/) {
            this.consume1(13 /*'?'*/);
            $$state = 4;
          } else if (this.current === 15 /*']'*/) {
            return $t;
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 3:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 12 /*'[]'*/ ||
            this.current === 13 /*'?'*/ ||
            this.current === 15 /*']'*/
          ) {
            $t = { type: "Array", type1: $t };
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 4:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 12 /*'[]'*/ ||
            this.current === 13 /*'?'*/ ||
            this.current === 15 /*']'*/
          ) {
            $t = { type: "Optional", type1: $t };
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 5:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 15 /*']'*/
          ) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return { type: "MaybeArrayOrOptional", t: $t, loc: this.locNode($$loc) };
  }
  ruleTypeAtom() {
    let $$loc = this.startNode();
    let $t;
    let $$state = 1,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 1:
          if (this.current === 1 /*'type'*/) {
            $t = this.ruleTypeObject();
            $$state = 2;
          } else if (this.current === 8 /*'('*/) {
            this.consume1(8 /*'('*/);
            $$state = 3;
          } else if (this.current === 14 /*'['*/) {
            $t = this.ruleTypeTuple();
            $$state = 2;
          } else if (this.current === 16 /*BOOLEAN*/) {
            $t = this.ruleBoolean();
            $$state = 2;
          } else if (this.current === 17 /*NUM*/) {
            $t = this.ruleNumber();
            $$state = 2;
          } else if (this.current === 18 /*STRING*/) {
            $t = this.ruleString();
            $$state = 2;
          } else if (this.current === 24 /*ID*/) {
            $t = this.ruleIdentifier();
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 2:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 12 /*'[]'*/ ||
            this.current === 13 /*'?'*/ ||
            this.current === 15 /*']'*/
          ) {
            return $t;
            $$state = 5;
          } else {
            throw this.unexpected();
          }
          break;
        case 3:
          if (
            this.current === 1 /*'type'*/ ||
            this.current === 8 /*'('*/ ||
            this.current === 14 /*'['*/ ||
            this.current === 16 /*BOOLEAN*/ ||
            this.current === 17 /*NUM*/ ||
            this.current === 18 /*STRING*/ ||
            this.current === 24 /*ID*/
          ) {
            $t = this.ruleType();
            $$state = 4;
          } else {
            throw this.unexpected();
          }
          break;
        case 4:
          if (this.current === 10 /*')'*/) {
            this.consume1(10 /*')'*/);
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 5:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 12 /*'[]'*/ ||
            this.current === 13 /*'?'*/ ||
            this.current === 15 /*']'*/
          ) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return { type: "TypeAtom", t: $t, loc: this.locNode($$loc) };
  }
  ruleTypeObject() {
    let $$loc = this.startNode();
    let $decorators = [],
      $properties = [];
    this.consume1(1 /*'type'*/);
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (this.current === 2 /*'{'*/) {
            this.consume1(2 /*'{'*/);
            $$state = 3;
          } else if (this.current === 7 /*'@'*/) {
            $decorators.push(this.ruleDecorator());
            $$state = 2;
          } else {
            throw this.unexpected();
          }
          break;
        case 3:
          if (this.current === 3 /*'}'*/) {
            this.consume1(3 /*'}'*/);
            $$state = 4;
          } else if (this.current === 24 /*ID*/) {
            $properties.push(this.ruleTypeProperty());
            $$state = 3;
          } else {
            throw this.unexpected();
          }
          break;
        case 4:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 12 /*'[]'*/ ||
            this.current === 13 /*'?'*/ ||
            this.current === 15 /*']'*/
          ) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return {
      type: "TypeObject",
      decorators: $decorators,
      properties: $properties,
      loc: this.locNode($$loc),
    };
  }
  ruleTypeTuple() {
    let $$loc = this.startNode();
    let $types = [];
    this.consume1(14 /*'['*/);
    let $$state = 2,
      $$loop = true;
    while ($$loop) {
      switch ($$state) {
        case 2:
          if (
            this.current === 1 /*'type'*/ ||
            this.current === 8 /*'('*/ ||
            this.current === 14 /*'['*/ ||
            this.current === 16 /*BOOLEAN*/ ||
            this.current === 17 /*NUM*/ ||
            this.current === 18 /*STRING*/ ||
            this.current === 24 /*ID*/
          ) {
            $types.push(this.ruleType());
            $$state = 3;
          } else {
            throw this.unexpected();
          }
          break;
        case 3:
          if (this.current === 9 /*','*/) {
            this.consume1(9 /*','*/);
            $$state = 2;
          } else if (this.current === 15 /*']'*/) {
            this.consume1(15 /*']'*/);
            $$state = 4;
          } else {
            throw this.unexpected();
          }
          break;
        case 4:
          if (
            this.current === 4 /*';'*/ ||
            this.current === 7 /*'@'*/ ||
            this.current === 9 /*','*/ ||
            this.current === 10 /*')'*/ ||
            this.current === 11 /*'|'*/ ||
            this.current === 12 /*'[]'*/ ||
            this.current === 13 /*'?'*/ ||
            this.current === 15 /*']'*/
          ) {
            $$loop = false;
          } else {
            throw this.unexpected();
          }
          break;
      }
    }
    return { type: "TypeTuple", types: $types, loc: this.locNode($$loc) };
  }
  ruleIdentifier() {
    let $$loc = this.startNode();
    let $name;
    $name = this.consume1(24 /*ID*/);
    $name = $name.image;
    let $$state = 3,
      $$loop = true;
    while ($$loop) {
      if (
        this.current === 4 /*';'*/ ||
        this.current === 7 /*'@'*/ ||
        this.current === 9 /*','*/ ||
        this.current === 10 /*')'*/ ||
        this.current === 11 /*'|'*/ ||
        this.current === 12 /*'[]'*/ ||
        this.current === 13 /*'?'*/ ||
        this.current === 15 /*']'*/
      ) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "Identifier", name: $name, loc: this.locNode($$loc) };
  }
  ruleNumber() {
    let $$loc = this.startNode();
    let $raw;
    $raw = this.consume1(17 /*NUM*/);
    $raw = $raw.image;
    let $$state = 3,
      $$loop = true;
    while ($$loop) {
      if (
        this.current === 4 /*';'*/ ||
        this.current === 7 /*'@'*/ ||
        this.current === 9 /*','*/ ||
        this.current === 10 /*')'*/ ||
        this.current === 11 /*'|'*/ ||
        this.current === 12 /*'[]'*/ ||
        this.current === 13 /*'?'*/ ||
        this.current === 15 /*']'*/
      ) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "Number", raw: $raw, loc: this.locNode($$loc) };
  }
  ruleString() {
    let $$loc = this.startNode();
    let $raw;
    $raw = this.consume1(18 /*STRING*/);
    $raw = $raw.image;
    let $$state = 3,
      $$loop = true;
    while ($$loop) {
      if (
        this.current === 4 /*';'*/ ||
        this.current === 7 /*'@'*/ ||
        this.current === 9 /*','*/ ||
        this.current === 10 /*')'*/ ||
        this.current === 11 /*'|'*/ ||
        this.current === 12 /*'[]'*/ ||
        this.current === 13 /*'?'*/ ||
        this.current === 15 /*']'*/
      ) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "String", raw: $raw, loc: this.locNode($$loc) };
  }
  ruleBoolean() {
    let $$loc = this.startNode();
    let $raw;
    $raw = this.consume1(16 /*BOOLEAN*/);
    $raw = $raw.image;
    let $$state = 3,
      $$loop = true;
    while ($$loop) {
      if (
        this.current === 4 /*';'*/ ||
        this.current === 7 /*'@'*/ ||
        this.current === 9 /*','*/ ||
        this.current === 10 /*')'*/ ||
        this.current === 11 /*'|'*/ ||
        this.current === 12 /*'[]'*/ ||
        this.current === 13 /*'?'*/ ||
        this.current === 15 /*']'*/
      ) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "Boolean", raw: $raw, loc: this.locNode($$loc) };
  }
  ruleJs() {
    let $$loc = this.startNode();
    let $raw;
    $raw = this.consume1(19 /*JS_RAW*/);
    $raw = $raw.image.replace(/^js/, "");
    let $$state = 3,
      $$loop = true;
    while ($$loop) {
      if (this.current === 9 /*','*/ || this.current === 10 /*')'*/) {
        $$loop = false;
      } else {
        throw this.unexpected();
      }
    }
    return { type: "Js", raw: $raw, loc: this.locNode($$loc) };
  }
  parse() {
    const r = this.ruleSchema();
    this.consume1(0);
    return r;
  }
}
module.exports = Parser;
