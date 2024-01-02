import { Input } from "./runtime/input";
import { Tokenizer } from "./runtime/tokenizer";
import { Parser } from "./runtime/parser";

const EMPTY_OBJ = {};

class GrammarTokenizer extends Tokenizer {
  getIdToLabel() {
    return {
      "0": "#string:O",
      "1": "#string:A",
      "2": "#string:B",
      "3": "#string:C",
      "4": "#string:D",
      "5": "#string:E",
      "6": "#string:F",
      "7": "#string:STRING",
      "8": "#string:<<<",
      "9": "#string:<<",
      "10": "#string:a",
      "11": "W",
      "12": "TY",
      "-1": "#eof"
    };
  }
  getIdToChannels() {
    return {
      "0": {
        "s": false,
        "c": []
      },
      "1": {
        "s": false,
        "c": []
      },
      "2": {
        "s": false,
        "c": []
      },
      "3": {
        "s": false,
        "c": []
      },
      "4": {
        "s": false,
        "c": []
      },
      "5": {
        "s": false,
        "c": []
      },
      "6": {
        "s": false,
        "c": []
      },
      "7": {
        "s": false,
        "c": []
      },
      "8": {
        "s": false,
        "c": []
      },
      "9": {
        "s": false,
        "c": []
      },
      "10": {
        "s": false,
        "c": []
      },
      "11": {
        "s": false,
        "c": [
          "channel1"
        ]
      },
      "12": {
        "s": false,
        "c": [
          "channel1"
        ]
      },
      "-1": {
        "s": false,
        "c": []
      }
    };
  }
  token$lexer() {
    let $startIndex, $startPos=null, id=null, token=null, $11_text=null, $12_num=null, loc=null;
    s2:do{
      $startPos = this.getPos();
      switch(this.ll(1)){
        case 87 /*'W'*/:
          $startIndex = this.getIndex();
          this.e(87 /*'W'*/);
          $11_text = this.getText($startIndex);
          id = 11;
          token = $11_text;
          break s2;
        case NaN:
          $12_num = 10;
          id = 12;
          token = $12_num;
          break s2;
        case -1 /*-1*/:
          this.e(-1 /*-1*/);
          id = -1;
          break;
        case 60 /*'<'*/:
          this.e(60 /*'<'*/);
          this.e(60 /*'<'*/);
          switch(this.ll(1)){
            case NaN:
              id = 9;
              break;
            case 60 /*'<'*/:
              this.e(60 /*'<'*/);
              id = 8;
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
        case 83 /*'S'*/:
          this.e(83 /*'S'*/);
          this.e(84 /*'T'*/);
          this.e(82 /*'R'*/);
          this.e(73 /*'I'*/);
          this.e(78 /*'N'*/);
          this.e(71 /*'G'*/);
          id = 7;
          break;
        case 97 /*'a'*/:
          this.e(97 /*'a'*/);
          id = 10;
          break;
        default:
          this.err();
      }
      token = EMPTY_OBJ;
    }while(0);
    loc = this.getLoc($startPos);
    return this.ctx.o({id, loc, token});
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
    this.e(83 /*'S'*/);
    this.e(84 /*'T'*/);
    this.e(82 /*'R'*/);
    this.e(73 /*'I'*/);
    this.e(78 /*'N'*/);
    this.e(71 /*'G'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$8() {
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$9() {
    this.e(60 /*'<'*/);
    this.e(60 /*'<'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  token$10() {
    this.e(97 /*'a'*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  tokenW() {
    let $startIndex, text=null;
    $startIndex = this.getIndex();
    this.e(87 /*'W'*/);
    text = this.getText($startIndex);
    return this.ctx.o(text);
  }
  tokenTY() {
    let num=null;
    num = 10;
    return this.ctx.o(num);
  }
}

class GrammarParser extends Parser {
  ruleA() {
    let $ll1, $ll2, $ll3, B=null, D=[], my_obj=null, C=null, T=null;
    s7:do{
      s8:do{
        s5:do{
          s4:do{
            s3:do{
              $ll1 = this.ll(1);
              if($ll1 === 0 /*#string:O*/){
              } else if($ll1 === 1 /*#string:A*/){
                $ll2 = this.ll(2);
                if($ll2 === 0 /*#string:O*/ || $ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
                  B = this.ctx.u(1/* A 1 */, this.ruleB());
                  switch(this.ll(1)){
                    case 0 /*#string:O*/:
                      break;
                    case 1 /*#string:A*/:
                      break s3;
                    case 2 /*#string:B*/:
                      break s4;
                    default:
                      this.err();
                  }
                } else { //$ll2 === 3 /*#string:C*/
                  $ll3 = this.ll(3);
                  if($ll3 === -1 /*#eof*/ || $ll3 === 0 /*#string:O*/ || $ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/ || $ll3 === 6 /*#string:F*/ || $ll3 === 7 /*#string:STRING*/){
                    break s3;
                  } else { //$ll3 === 4 /*#string:D*/
                    throw new Error("Ambiguity");
                    B = this.ctx.u(1/* A 1 */, this.ruleB());
                    switch(this.ll(1)){
                      case 0 /*#string:O*/:
                        break;
                      case 1 /*#string:A*/:
                        break s3;
                      case 2 /*#string:B*/:
                        break s4;
                      default:
                        this.err();
                    }
                    //Ambiguity
                    break s3;
                  }
                }
              } else { //$ll1 === 2 /*#string:B*/
                break s4;
              }
              this.e(0 /*#string:O*/);
              switch(this.ll(1)){
                case 1 /*#string:A*/:
                  break;
                case 2 /*#string:B*/:
                  break s4;
                default:
                  this.err();
              }
            }while(0);
            this.e(1 /*#string:A*/);
            break s5;
          }while(0);
          this.e(2 /*#string:B*/);
        }while(0);
        this.e(3 /*#string:C*/);
        while(1){
          switch(this.ll(1)){
            case 4 /*#string:D*/:
              D.push(this.e(4 /*#string:D*/));
              this.e(5 /*#string:E*/);
              continue;
            case -1 /*#eof*/:
            case 1 /*#string:A*/:
            case 1 /*#string:A*/:
            case 1 /*#string:A*/:
            case 2 /*#string:B*/:
            case 2 /*#string:B*/:
            case 2 /*#string:B*/:
            case 7 /*#string:STRING*/:
              break s7;
            case 0 /*#string:O*/:
              break s8;
            case 6 /*#string:F*/:
              while(1){
                this.e(6 /*#string:F*/);
                switch(this.ll(1)){
                  case -1 /*#eof*/:
                  case 1 /*#string:A*/:
                  case 1 /*#string:A*/:
                  case 1 /*#string:A*/:
                  case 2 /*#string:B*/:
                  case 2 /*#string:B*/:
                  case 2 /*#string:B*/:
                  case 7 /*#string:STRING*/:
                    break s7;
                  case 0 /*#string:O*/:
                    break s8;
                  case 6 /*#string:F*/:
                    continue;
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
      this.e(0 /*#string:O*/);
    }while(0);
    my_obj = {id: 10};
    my_obj.id;
    my_obj.id;
    my_obj.unknown_field;
    C = this.ctx.u(2/* A 11 */, this.ruleC(10, 20));
    T = this.ctx.u(3/* A 12 */, this.ruleTricky2());
    this.e(-1 /*#eof*/);
    return this.ctx.o({o: my_obj, b: B, c: C, d: D, t: T, external: this.external.externalCall(my_obj, C)});
  }
  ruleB() {
    let $ll1;
    s2:do{
      this.e(1 /*#string:A*/);
      $ll1 = this.ll(1);
      if($ll1 === 2 /*#string:B*/){
        while(1){
          this.e(2 /*#string:B*/);
          this.e(4 /*#string:D*/);
          $ll1 = this.ll(1);
          if($ll1 === 2 /*#string:B*/){
            continue;
          } else { //($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 1 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 1 */]))
            break s2;
          }
        }
      } else if($ll1 === 3 /*#string:C*/){
        while(1){
          this.e(3 /*#string:C*/);
          this.e(4 /*#string:D*/);
          $ll1 = this.ll(1);
          if($ll1 === 3 /*#string:C*/){
            continue;
          } else { //($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 1 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 1 */]))
            break s2;
          }
        }
      } else { //($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 1 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 1 */]))
      }
    }while(0);
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleC(x,y) {
    let $ll1, text=null, ret=null;
    $ll1 = this.ll(1);
    if($ll1 === 7 /*#string:STRING*/){
      text = this.e(7 /*#string:STRING*/);
      ret = {x, y};
    } else { //($ll1 === -1 /*#eof*/ && this.ctx.f([2/* A 11 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([2/* A 11 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([2/* A 11 */]))
      ret = {x: y, y: x};
    }
    return this.ctx.o({ret, text});
  }
  ruleD(arg) {
    let ret=null;
    switch(this.ll(1)){
      case NaN:
        ret = {x: arg.x, y: arg.y};
        break;
      case NaN:
        ret = {x: arg.y, y: arg.x};
        break;
      default:
        this.err();
    }
    return this.ctx.o(ret);
  }
  ruleE() {
    let obj=null;
    obj = {num: 10};
    return this.ctx.o(obj.num);
  }
  ruleF(arg) {
    let ret=null, w=null;
    ret = {x: arg.x};
    w = this.e(11 /*W*/);
    this.ctx.u(4/* F 3 */, this.ruleH(10));
    return this.ctx.o(w);
  }
  ruleG() {
    switch(this.ll(1)){
      case 8 /*#string:<<<*/:
        this.e(8 /*#string:<<<*/);
        break;
      case 9 /*#string:<<*/:
        this.e(9 /*#string:<<*/);
        break;
      default:
        this.err();
    }
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleH(x) {
    let y=null;
    switch(this.ll(1)){
      case 10 /*#string:a*/:
        y = this.e(10 /*#string:a*/);
        break;
      case NaN:
        y = x;
        break;
      default:
        this.err();
    }
    return this.ctx.o(y);
  }
  ruleTricky1() {
    let $ll1, $ll2, $ll3;
    $ll1 = this.ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === 1 /*#string:A*/ || ($ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */]))){
        throw new Error("Ambiguity");
        this.ctx.u(5/* Tricky1 1 */, this.ruleTricky1());
        $ll1 = this.ll(1);
        if(($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))){
        } else { //$ll1 === 2 /*#string:B*/
          this.e(2 /*#string:B*/);
        }
        //Ambiguity
        this.e(1 /*#string:A*/);
        //Ambiguity
        this.ctx.u(6/* Tricky1 4 */, this.ruleTricky1());
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.ll(3);
        if($ll3 === 2 /*#string:B*/){
          this.ctx.u(5/* Tricky1 1 */, this.ruleTricky1());
          $ll1 = this.ll(1);
          if(($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))){
          } else { //$ll1 === 2 /*#string:B*/
            this.e(2 /*#string:B*/);
          }
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))
          throw new Error("Ambiguity");
          this.ctx.u(5/* Tricky1 1 */, this.ruleTricky1());
          $ll1 = this.ll(1);
          if(($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))){
          } else { //$ll1 === 2 /*#string:B*/
            this.e(2 /*#string:B*/);
          }
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          this.ctx.u(6/* Tricky1 4 */, this.ruleTricky1());
        }
      }
    } else if($ll1 === 2 /*#string:B*/){
      this.ctx.u(5/* Tricky1 1 */, this.ruleTricky1());
      $ll1 = this.ll(1);
      if(($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))){
      } else { //$ll1 === 2 /*#string:B*/
        this.e(2 /*#string:B*/);
      }
    } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))
      throw new Error("Ambiguity");
      this.ctx.u(5/* Tricky1 1 */, this.ruleTricky1());
      $ll1 = this.ll(1);
      if(($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([5/* Tricky1 1 */, 6/* Tricky1 4 */]))){
      } else { //$ll1 === 2 /*#string:B*/
        this.e(2 /*#string:B*/);
      }
      //Ambiguity
      // epsilon
    }
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleTricky2() {
    let $ll1, $ll2, $ll3, x=null, y=null, z=null;
    $ll1 = this.ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.ll(3);
        if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
          throw new Error("Ambiguity");
          x = this.ctx.u(7/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(8/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(9/* Tricky2 4 */, this.ruleTricky2());
        } else { //($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(7/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(9/* Tricky2 4 */, this.ruleTricky2());
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.ll(3);
        if($ll3 === 2 /*#string:B*/){
          z = this.ctx.u(8/* Tricky2 1 */, this.ruleTricky2());
          this.e(2 /*#string:B*/);
        } else { //($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(7/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(8/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(9/* Tricky2 4 */, this.ruleTricky2());
        }
      } else { //($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */]))
        throw new Error("Ambiguity");
        x = this.ctx.u(7/* Tricky2 1 */, this.ruleTricky2());
        //Ambiguity
        this.e(1 /*#string:A*/);
        //Ambiguity
        y = this.ctx.u(9/* Tricky2 4 */, this.ruleTricky2());
      }
    } else if($ll1 === 2 /*#string:B*/){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/){
        z = this.ctx.u(8/* Tricky2 1 */, this.ruleTricky2());
        this.e(2 /*#string:B*/);
      } else { //($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */]))
        throw new Error("Ambiguity");
        x = this.ctx.u(7/* Tricky2 1 */, this.ruleTricky2());
        //Ambiguity
        z = this.ctx.u(8/* Tricky2 1 */, this.ruleTricky2());
        //Ambiguity
        this.e(2 /*#string:B*/);
      }
    } else { //($ll1 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */, 7/* Tricky2 1 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */, 9/* Tricky2 4 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 7/* Tricky2 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 7/* Tricky2 1 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([3/* A 12 */, 9/* Tricky2 4 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 1 */, 9/* Tricky2 4 */]))
      throw new Error("Ambiguity");
      x = this.ctx.u(7/* Tricky2 1 */, this.ruleTricky2());
      //Ambiguity
      // epsilon
    }
    return this.ctx.o({x, y, z});
  }
  ruleTricky3(arg) {
    let $ll1, $ll2, $ll3, x=null, y=null, z=null;
    $ll1 = this.ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.ll(3);
        if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
          throw new Error("Ambiguity");
          x = this.ctx.u(10/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(11/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(12/* Tricky3 4 */, this.ruleTricky3(20));
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */, 10/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(10/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(12/* Tricky3 4 */, this.ruleTricky3(20));
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.ll(3);
        if(($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */, 10/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */]))){
          throw new Error("Ambiguity");
          x = this.ctx.u(10/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(11/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(12/* Tricky3 4 */, this.ruleTricky3(20));
        } else { //$ll3 === 2 /*#string:B*/
          z = this.ctx.u(11/* Tricky3 1 */, this.ruleTricky3(30));
          this.e(2 /*#string:B*/);
        }
      } else { //($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */, 10/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */]))
        throw new Error("Ambiguity");
        x = this.ctx.u(10/* Tricky3 1 */, this.ruleTricky3(10));
        //Ambiguity
        this.e(1 /*#string:A*/);
        //Ambiguity
        y = this.ctx.u(12/* Tricky3 4 */, this.ruleTricky3(20));
      }
    } else if($ll1 === 2 /*#string:B*/){
      $ll2 = this.ll(2);
      if(($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */, 10/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(10/* Tricky3 1 */, this.ruleTricky3(10));
        //Ambiguity
        z = this.ctx.u(11/* Tricky3 1 */, this.ruleTricky3(30));
        //Ambiguity
        this.e(2 /*#string:B*/);
      } else { //$ll2 === 2 /*#string:B*/
        z = this.ctx.u(11/* Tricky3 1 */, this.ruleTricky3(30));
        this.e(2 /*#string:B*/);
      }
    } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */, 10/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 10/* Tricky3 1 */, 12/* Tricky3 4 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 1 */, 12/* Tricky3 4 */]))
      throw new Error("Ambiguity");
      x = this.ctx.u(10/* Tricky3 1 */, this.ruleTricky3(10));
      //Ambiguity
      // epsilon
    }
    return this.ctx.o({x, y, z});
  }
  ruleTricky4() {
    let $ll1, $ll2;
    $ll1 = this.ll(1);
    if($ll1 === -1 /*#eof*/){
      $ll2 = this.ll(2);
      if($ll2 === -1 /*#eof*/ || $ll2 === 2 /*#string:B*/){
        this.ctx.u(13/* Tricky4 1 */, this.ruleTricky4());
        switch(this.ll(1)){
          case -1 /*#eof*/:
            break;
          case 2 /*#string:B*/:
            this.e(2 /*#string:B*/);
            break;
          default:
            this.err();
        }
      } else { //($ll2 === -1 /*#eof*/ && this.ctx.f([14/* Tricky4 5 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([13/* Tricky4 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([13/* Tricky4 1 */]))
      }
    } else if($ll1 === 1 /*#string:A*/){
      throw new Error("Ambiguity");
      this.ctx.u(13/* Tricky4 1 */, this.ruleTricky4());
      switch(this.ll(1)){
        case -1 /*#eof*/:
          break;
        case 2 /*#string:B*/:
          this.e(2 /*#string:B*/);
          break;
        default:
          this.err();
      }
      //Ambiguity
      this.e(1 /*#string:A*/);
      //Ambiguity
      this.ctx.u(14/* Tricky4 5 */, this.ruleTricky4());
    } else { //$ll1 === 2 /*#string:B*/
      this.ctx.u(13/* Tricky4 1 */, this.ruleTricky4());
      switch(this.ll(1)){
        case -1 /*#eof*/:
          break;
        case 2 /*#string:B*/:
          this.e(2 /*#string:B*/);
          break;
        default:
          this.err();
      }
    }
    this.e(-1 /*#eof*/);
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleY() {
    let y=null;
    y = this.e(12 /*TY*/);
    return this.ctx.o(y);
  }
}

export function parse(external, string) {
  const input = new Input({ string });
  const tokenizer = new GrammarTokenizer(input, external);
  const parser = new GrammarParser(tokenizer, external);
  return parser.ctx.u(-1, parser.ruleA());
}
