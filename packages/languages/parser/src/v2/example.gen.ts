import { Input } from "./runtime/input";
import { Tokenizer } from "./runtime/tokenizer";
import { Parser } from "./runtime/parser";

const EMPTY_OBJ = {};

class GrammarTokenizer extends Tokenizer {
  token$lexer() {
    this.push("$lexer");
    let $startLoc, id:any=null, token:any=null, $9_text:any=null;
    s2:do{
      switch(this.ll(1)){
        case 87 /*'W'*/:
          $startLoc = this.external.$getLoc();
          this.e(87 /*'W'*/);
          $9_text = this.external.$getText($startLoc);
          id = 9;
          token = $9_text;
          break s2;
        case -1 /*-1*/:
          this.e(-1 /*-1*/);
          id = -1;
          break;
        case 60 /*'<'*/:
          this.e(60 /*'<'*/);
          this.e(60 /*'<'*/);
          switch(this.ll(1)){
            case false:
              id = 8;
              break;
            case 60 /*'<'*/:
              this.e(60 /*'<'*/);
              id = 7;
              break;
            default:
              this.err();
          }
          break;
        case 65 /*'A'*/:
          this.e(65 /*'A'*/);
          id = 1;
          break;
        case 66 /*'B'*/:
          this.e(66 /*'B'*/);
          id = 2;
          break;
        case 67 /*'C'*/:
          this.e(67 /*'C'*/);
          id = 3;
          break;
        case 68 /*'D'*/:
          this.e(68 /*'D'*/);
          id = 4;
          break;
        case 69 /*'E'*/:
          this.e(69 /*'E'*/);
          id = 5;
          break;
        case 70 /*'F'*/:
          this.e(70 /*'F'*/);
          id = 6;
          break;
        case 79 /*'O'*/:
          this.e(79 /*'O'*/);
          id = 0;
          break;
        default:
          this.err();
      }
      token = EMPTY_OBJ;
    }while(0);
    return this.pop({id, token});
  }
  token$_1() {
    this.push("$_1");
    this.e(-1 /*-1*/);
    return this.pop(EMPTY_OBJ);
  }
  token$0() {
    this.push("$0");
    this.e(79 /*'O'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$1() {
    this.push("$1");
    this.e(65 /*'A'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$2() {
    this.push("$2");
    this.e(66 /*'B'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$3() {
    this.push("$3");
    this.e(67 /*'C'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$4() {
    this.push("$4");
    this.e(68 /*'D'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$5() {
    this.push("$5");
    this.e(69 /*'E'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$6() {
    this.push("$6");
    this.e(70 /*'F'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$7() {
    this.push("$7");
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    return this.pop(EMPTY_OBJ);
  }
  token$8() {
    this.push("$8");
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    return this.pop(EMPTY_OBJ);
  }
  tokenW() {
    this.push("W");
    let $startLoc, text:any=null;
    $startLoc = this.external.$getLoc();
    this.e(87 /*'W'*/);
    text = this.external.$getText($startLoc);
    return this.pop(text);
  }
}

class GrammarParser extends Parser {
  ruleA() {
    this.push("A");
    let $ll1, $ll2, $ll3, my_obj:any=null;
    s5:do{
      s6:do{
        s3:do{
          $ll1 = this.ll(1);
          $ll2 = this.ll(2);
          $ll3 = this.ll(3);
          if(($ll1 === 1 /*#string:A*/ && $ll2 === 0 /*#string:O*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/ && $ll3 === 4 /*#string:D*/)){
            this.ruleB();
            switch(this.ll(1)){
              case 0 /*#string:O*/:
                this.e(0 /*#string:O*/);
                break;
              case 1 /*#string:A*/:
                this.e(1 /*#string:A*/);
                break s3;
              case 2 /*#string:B*/:
                this.e(2 /*#string:B*/);
                break s3;
              default:
                this.err();
            }
          } else if($ll1 === 0 /*#string:O*/){
            this.e(0 /*#string:O*/);
          } else if(($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/ && $ll3 === 0 /*#string:O*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/ && $ll3 === 4 /*#string:D*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/ && $ll3 === 6 /*#string:F*/)){
            this.e(1 /*#string:A*/);
            break s3;
          } else if($ll1 === 2 /*#string:B*/){
            this.e(2 /*#string:B*/);
            break s3;
          } else {
            this.err();
          }
          switch(this.ll(1)){
            case 1 /*#string:A*/:
              this.e(1 /*#string:A*/);
              break;
            case 2 /*#string:B*/:
              this.e(2 /*#string:B*/);
              break;
            default:
              this.err();
          }
        }while(0);
        this.e(3 /*#string:C*/);
        l1:while(1){
          switch(this.ll(1)){
            case -1 /*#eof*/:
              my_obj = {id: 10};
              break s5;
            case 0 /*#string:O*/:
              this.e(0 /*#string:O*/);
              break s6;
            case 4 /*#string:D*/:
              this.e(4 /*#string:D*/);
              this.e(5 /*#string:E*/);
              continue l1;
            case 6 /*#string:F*/:
              this.e(6 /*#string:F*/);
              l2:while(1){
                switch(this.ll(1)){
                  case -1 /*#eof*/:
                    my_obj = {id: 10};
                    break s5;
                  case 0 /*#string:O*/:
                    this.e(0 /*#string:O*/);
                    break s6;
                  case 6 /*#string:F*/:
                    this.e(6 /*#string:F*/);
                    continue l2;
                  default:
                    this.err();
                }
              }
              break;
            default:
              this.err();
          }
        }
      }while(0);
      my_obj = {id: 10};
    }while(0);
    my_obj.id;
    my_obj.id;
    this.ruleC(10, 20);
    this.e(-1 /*#eof*/);
    return this.pop(this.external.externalCall(my_obj));
  }
  ruleB() {
    this.push("B");
    let $ll1;
    this.e(1 /*#string:A*/);
    $ll1 = this.ll(1);
    if($ll1 === 0 /*#string:O*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      return this.pop(EMPTY_OBJ);
    } else if($ll1 === 2 /*#string:B*/){
      this.e(2 /*#string:B*/);
      l1:while(1){
        this.e(4 /*#string:D*/);
        $ll1 = this.ll(1);
        if($ll1 === 0 /*#string:O*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
          return this.pop(EMPTY_OBJ);
        } else if($ll1 === 2 /*#string:B*/){
          this.e(2 /*#string:B*/);
          continue l1;
        } else {
          this.err();
        }
      }
    } else if($ll1 === 3 /*#string:C*/){
      this.e(3 /*#string:C*/);
      l2:while(1){
        this.e(4 /*#string:D*/);
        $ll1 = this.ll(1);
        if($ll1 === 0 /*#string:O*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
          return this.pop(EMPTY_OBJ);
        } else if($ll1 === 3 /*#string:C*/){
          this.e(3 /*#string:C*/);
          continue l2;
        } else {
          this.err();
        }
      }
    } else {
      this.err();
    }
  }
  ruleC(x,y) {
    this.push("C");
    let $ll1, ret:any=null;
    $ll1 = this.ll(1);
    if($ll1 === -1 /*#eof*/){
      ret = {x, y};
    } else if($ll1 === -1 /*#eof*/){
      ret = {x: y, y: x};
    } else {
      this.err();
    }
    return this.pop(ret);
  }
  ruleD(arg) {
    this.push("D");
    let ret:any=null;
    switch(this.ll(1)){
      case false:
        ret = {x: arg.x, y: arg.y};
        break;
      case false:
        ret = {x: arg.y, y: arg.x};
        break;
      default:
        this.err();
    }
    return this.pop(ret);
  }
  ruleE() {
    this.push("E");
    let obj:any=null;
    obj = {num: 10};
    return this.pop(obj.num);
  }
  ruleF(arg) {
    this.push("F");
    let ret:any=null, w:any=null;
    ret = {x: arg.x};
    w = this.e(9 /*W*/);
    return this.pop(w);
  }
  ruleG() {
    this.push("G");
    switch(this.ll(1)){
      case 7 /*#string:<<<*/:
        this.e(7 /*#string:<<<*/);
        break;
      case 8 /*#string:<<*/:
        this.e(8 /*#string:<<*/);
        break;
      default:
        this.err();
    }
    return this.pop(EMPTY_OBJ);
  }
}

export function parse(string: string) {
  const input = new Input({ string });
  const tokenizer = new GrammarTokenizer(input);
  const parser = new GrammarParser(tokenizer);
  return parser.ruleA();
}
