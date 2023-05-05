import { Input } from "./runtime/input";
import { Tokenizer } from "./runtime/tokenizer";
import { Parser } from "./runtime/parser";

const EMPTY_OBJ = {};

class GrammarTokenizer extends Tokenizer {
  token$lexer() {
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
    return this.ctx.o({id, token});
  }
  token$_1() {
    this.e(-1 /*-1*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$0() {
    this.e(79 /*'O'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$1() {
    this.e(65 /*'A'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$2() {
    this.e(66 /*'B'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$3() {
    this.e(67 /*'C'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$4() {
    this.e(68 /*'D'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$5() {
    this.e(69 /*'E'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$6() {
    this.e(70 /*'F'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$7() {
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$8() {
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  tokenW() {
    let $startLoc, text:any=null;
    $startLoc = this.external.$getLoc();
    this.e(87 /*'W'*/);
    text = this.external.$getText($startLoc);
    return this.ctx.o(text);
  }
}

class GrammarParser extends Parser {
  ruleA() {
    let $ll1, $ll2, $ll3, my_obj:any=null;
    s5:do{
      s6:do{
        s3:do{
          $ll1 = this.ll(1);
          $ll2 = this.ll(2);
          $ll3 = this.ll(3);
          if(($ll1 === 1 /*#string:A*/ && $ll2 === 0 /*#string:O*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/ && $ll3 === 4 /*#string:D*/)){
            this.ctx.u(1/* A 1 */, this.ruleB());
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
    this.ctx.u(2/* A 11 */, this.ruleC(10, 20));
    this.e(-1 /*#eof*/);
    return this.ctx.o(this.external.externalCall(my_obj));
  }
  ruleB() {
    let $ll1;
    this.e(1 /*#string:A*/);
    $ll1 = this.ll(1);
    if($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 1 */]) || $ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 1 */])){
      return this.ctx.o(EMPTY_OBJ);
    } else if($ll1 === 2 /*#string:B*/){
      this.e(2 /*#string:B*/);
      l1:while(1){
        this.e(4 /*#string:D*/);
        $ll1 = this.ll(1);
        if($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 1 */]) || $ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 1 */])){
          return this.ctx.o(EMPTY_OBJ);
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
        if($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 1 */]) || $ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 1 */])){
          return this.ctx.o(EMPTY_OBJ);
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
    let $ll1, ret:any=null;
    $ll1 = this.ll(1);
    if($ll1 === -1 /*#eof*/ && this.ctx.f([2/* A 11 */])){
      ret = {x, y};
    } else if($ll1 === -1 /*#eof*/ && this.ctx.f([2/* A 11 */])){
      ret = {x: y, y: x};
    } else {
      this.err();
    }
    return this.ctx.o(ret);
  }
  ruleD(arg) {
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
    return this.ctx.o(ret);
  }
  ruleE() {
    let obj:any=null;
    obj = {num: 10};
    return this.ctx.o(obj.num);
  }
  ruleF(arg) {
    let ret:any=null, w:any=null;
    ret = {x: arg.x};
    w = this.e(9 /*W*/);
    return this.ctx.o(w);
  }
  ruleG() {
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
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleTricky1() {
    let $ll1, $ll2, $ll3;
    $ll1 = this.ll(1);
    $ll2 = this.ll(2);
    $ll3 = this.ll(3);
    if($ll1 === 2 /*#string:B*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */, 3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */, 3/* Tricky1 1 */]))){
      this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
      $ll1 = this.ll(1);
      if($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])){
        return this.ctx.o(EMPTY_OBJ);
      } else if($ll1 === 2 /*#string:B*/){
        this.e(2 /*#string:B*/);
      } else {
        this.err();
      }
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */, 3/* Tricky1 1 */]))){
      return this.ctx.o(EMPTY_OBJ);
    } else if(($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */, 3/* Tricky1 1 */]))){
      this.e(1 /*#string:A*/);
      this.ctx.u(4/* Tricky1 4 */, this.ruleTricky1());
    } else {
      this.err();
    }
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleTricky2() {
    let $ll1, $ll2, $ll3, $val, x:any=null, y:any=null, z:any=null;
    $ll1 = this.ll(1);
    $ll2 = this.ll(2);
    $ll3 = this.ll(3);
    if($ll1 === 2 /*#string:B*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */]) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */, 5/* Tricky2 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */, 5/* Tricky2 1 */]))){
      $val = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
      $ll1 = this.ll(1);
      if($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])){
        x = $val;
      } else if($ll1 === 2 /*#string:B*/){
        z = $val;
        this.e(2 /*#string:B*/);
      } else {
        this.err();
      }
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */]) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */, 5/* Tricky2 1 */]))){
      return this.ctx.o({x, y, z});
    } else if(($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky2 1 */, 6/* Tricky2 5 */, 5/* Tricky2 1 */]))){
      this.e(1 /*#string:A*/);
      y = this.ctx.u(6/* Tricky2 5 */, this.ruleTricky2());
    } else {
      this.err();
    }
    return this.ctx.o({x, y, z});
  }
  ruleTricky3(arg) {
    let $ll1, $ll2, $ll3, x:any=null, y:any=null, z:any=null;
    $ll1 = this.ll(1);
    $ll2 = this.ll(2);
    $ll3 = this.ll(3);
    if($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */]) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */]))){
      x = this.ctx.u(7/* Tricky3 1 */, this.ruleTricky3(10));
    } else if(($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */]))){
      z = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(30));
      this.e(2 /*#string:B*/);
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */]) || $ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */]) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */]))){
      return this.ctx.o({x, y, z});
    } else if(($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 8/* Tricky3 1 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */]) && $ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 6 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 9/* Tricky3 6 */, 7/* Tricky3 1 */])) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky3 1 */, 7/* Tricky3 1 */, 9/* Tricky3 6 */]))){
      this.e(1 /*#string:A*/);
      y = this.ctx.u(9/* Tricky3 6 */, this.ruleTricky3(20));
    } else {
      this.err();
    }
    return this.ctx.o({x, y, z});
  }
  ruleTricky4() {
    let $ll1, $ll2, $ll3;
    s2:do{
      $ll1 = this.ll(1);
      $ll2 = this.ll(2);
      $ll3 = this.ll(3);
      if($ll1 === 2 /*#string:B*/ || ($ll1 === -1 /*#eof*/ && $ll2 === -1 /*#eof*/) || ($ll1 === -1 /*#eof*/ && $ll2 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === -1 /*#eof*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === -1 /*#eof*/)){
        this.ctx.u(10/* Tricky4 1 */, this.ruleTricky4());
        switch(this.ll(1)){
          case -1 /*#eof*/:
            this.e(-1 /*#eof*/);
            break s2;
          case 2 /*#string:B*/:
            this.e(2 /*#string:B*/);
            break;
          default:
            this.err();
        }
      } else if(($ll1 === -1 /*#eof*/ && $ll2 === -1 /*#eof*/ && this.ctx.f([10/* Tricky4 1 */])) || ($ll1 === -1 /*#eof*/ && $ll2 === 2 /*#string:B*/ && this.ctx.f([10/* Tricky4 1 */])) || ($ll1 === -1 /*#eof*/ && $ll2 === -1 /*#eof*/ && this.ctx.f([11/* Tricky4 5 */]))){
        this.e(-1 /*#eof*/);
        break s2;
      } else if(($ll1 === 1 /*#string:A*/ && $ll2 === -1 /*#eof*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === -1 /*#eof*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 1 /*#string:A*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 1 /*#string:A*/ && $ll3 === 2 /*#string:B*/) || ($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/ && $ll3 === -1 /*#eof*/)){
        this.e(1 /*#string:A*/);
        this.ctx.u(11/* Tricky4 5 */, this.ruleTricky4());
      } else {
        this.err();
      }
      this.e(-1 /*#eof*/);
    }while(0);
    return this.ctx.o(EMPTY_OBJ);
  }
}

export function parse(string: string) {
  const input = new Input({ string });
  const tokenizer = new GrammarTokenizer(input);
  const parser = new GrammarParser(tokenizer);
  return parser.ctx.u(-1, parser.ruleA());
}