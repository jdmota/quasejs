import { Input } from "./runtime/input";
import { Tokenizer } from "./runtime/tokenizer";
import { Parser } from "./runtime/parser";

/* eslint-disable */
export type $Position = {pos:number;line:number;column:number;};
export type $Location = {start:$Position;end:$Position;};
export type $Nodes = A|B|C|D|E|F|G|Tricky1|Tricky2|Tricky3|Tricky4;
export type $ExternalCalls = {
  externalCall: ((arg0: Readonly<{ id: number }>, arg1: Readonly<{ ret: (Readonly<{ x: C_x, y: C_y }> | Readonly<{ x: C_y, y: C_x }>), text: null }>) => A);
};
export type A = A;
export type B = Readonly<Record<string, never>>;
export type C_x = C_x;
export type C_y = C_y;
export type C = Readonly<{ ret: (Readonly<{ x: C_x, y: C_y }> | Readonly<{ x: C_y, y: C_x }>), text: null }>;
export type D_arg = (Readonly<{ x: $rec1 }> & Readonly<{ y: $rec2 }> & Readonly<{ y: $rec3 }> & Readonly<{ x: $rec4 }>);
export type D = (Readonly<{ x: $rec1, y: $rec2 }> | Readonly<{ x: $rec3, y: $rec4 }>);
export type E = number;
export type F_arg = (Readonly<{ x: unknown }> & Readonly<{ x: unknown }>);
export type F = never;
export type G = Readonly<Record<string, never>>;
export type Tricky1 = Readonly<Record<string, never>>;
export type Tricky2 = Readonly<{ x: (null | Tricky2), y: (null | Tricky2), z: (null | Tricky2) }>;
export type Tricky3_arg = unknown;
export type Tricky3 = Readonly<{ x: (null | Tricky3), y: (null | Tricky3), z: (null | Tricky3) }>;
export type Tricky4 = Readonly<Record<string, never>>;
export type $rec1 = $rec1;
export type $rec2 = $rec2;
export type $rec3 = $rec3;
export type $rec4 = $rec4;

const EMPTY_OBJ = {};

class GrammarTokenizer extends Tokenizer<$ExternalCalls> {
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
      "10": "W",
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
    let $startIndex, $startPos:any=null, id:any=null, token:any=null, $10_text:any=null, loc:any=null;
    s2:do{
      $startPos = this.getPos();
      switch(this.ll(1)){
        case 87 /*'W'*/:
          $startIndex = this.getIndex();
          this.e(87 /*'W'*/);
          $10_text = this.getText($startIndex);
          id = 10;
          token = $10_text;
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
  tokenW() {
    let $startIndex, text:any=null;
    $startIndex = this.getIndex();
    this.e(87 /*'W'*/);
    text = this.getText($startIndex);
    return this.ctx.o(text);
  }
}

class GrammarParser extends Parser<$ExternalCalls> {
  ruleA() {
    let $ll1, $ll2, $ll3, my_obj:any=null, C:any=null;
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
                  this.ctx.u(1/* A 1 */, this.ruleB());
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
                  if($ll3 === -1 /*#eof*/ || $ll3 === 0 /*#string:O*/ || $ll3 === 6 /*#string:F*/ || $ll3 === 7 /*#string:STRING*/){
                    break s3;
                  } else { //$ll3 === 4 /*#string:D*/
                    throw new Error("Ambiguity");
                    this.ctx.u(1/* A 1 */, this.ruleB());
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
            case -1 /*#eof*/:
            case 7 /*#string:STRING*/:
              break s7;
            case 0 /*#string:O*/:
              break s8;
            case 4 /*#string:D*/:
              this.e(4 /*#string:D*/);
              this.e(5 /*#string:E*/);
              continue;
            case 6 /*#string:F*/:
              while(1){
                this.e(6 /*#string:F*/);
                switch(this.ll(1)){
                  case -1 /*#eof*/:
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
    C = this.ctx.u(2/* A 10 */, this.ruleC(10, 20));
    this.e(-1 /*#eof*/);
    return this.ctx.o(this.external.externalCall(my_obj, C));
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
    let $ll1, text:any=null, ret:any=null;
    $ll1 = this.ll(1);
    if($ll1 === 7 /*#string:STRING*/){
      text = this.e(7 /*#string:STRING*/);
      ret = {x, y};
    } else { //$ll1 === -1 /*#eof*/ && this.ctx.f([2/* A 10 */])
      ret = {x: y, y: x};
    }
    return this.ctx.o({ret, text});
  }
  ruleD(arg) {
    let ret:any=null;
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
    let obj:any=null;
    obj = {num: 10};
    return this.ctx.o(obj.num);
  }
  ruleF(arg) {
    let ret:any=null, w:any=null;
    ret = {x: arg.x};
    w = this.e(10 /*W*/);
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
  ruleTricky1() {
    let $ll1, $ll2, $ll3;
    $ll1 = this.ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.ll(3);
        { //$ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/ || ($ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
          throw new Error("Ambiguity");
          this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
          $ll1 = this.ll(1);
          if($ll1 === 2 /*#string:B*/){
            this.e(2 /*#string:B*/);
          } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
          }
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          this.ctx.u(4/* Tricky1 4 */, this.ruleTricky1());
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.ll(3);
        if($ll3 === 2 /*#string:B*/){
          this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
          $ll1 = this.ll(1);
          if($ll1 === 2 /*#string:B*/){
            this.e(2 /*#string:B*/);
          } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
          }
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
          throw new Error("Ambiguity");
          this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
          $ll1 = this.ll(1);
          if($ll1 === 2 /*#string:B*/){
            this.e(2 /*#string:B*/);
          } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
          }
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          this.ctx.u(4/* Tricky1 4 */, this.ruleTricky1());
        }
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])){
        throw new Error("Ambiguity");
        this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
        $ll1 = this.ll(1);
        if($ll1 === 2 /*#string:B*/){
          this.e(2 /*#string:B*/);
        } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
        }
        //Ambiguity
        this.e(1 /*#string:A*/);
        //Ambiguity
        this.ctx.u(4/* Tricky1 4 */, this.ruleTricky1());
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])
        $ll3 = this.ll(3);
        { //$ll3 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */, 3/* Tricky1 1 */])
          throw new Error("Ambiguity");
          this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
          $ll1 = this.ll(1);
          if($ll1 === 2 /*#string:B*/){
            this.e(2 /*#string:B*/);
          } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
          }
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          this.ctx.u(4/* Tricky1 4 */, this.ruleTricky1());
        }
      }
    } else if($ll1 === 2 /*#string:B*/){
      this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
      $ll1 = this.ll(1);
      if($ll1 === 2 /*#string:B*/){
        this.e(2 /*#string:B*/);
      } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
      }
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])){
      $ll2 = this.ll(2);
      { //$ll2 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */, 3/* Tricky1 1 */])
        throw new Error("Ambiguity");
        this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
        $ll1 = this.ll(1);
        if($ll1 === 2 /*#string:B*/){
          this.e(2 /*#string:B*/);
        } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
        }
      }
    } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */])
      throw new Error("Ambiguity");
      this.ctx.u(3/* Tricky1 1 */, this.ruleTricky1());
      $ll1 = this.ll(1);
      if($ll1 === 2 /*#string:B*/){
        this.e(2 /*#string:B*/);
      } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))
      }
    }
    return this.ctx.o(EMPTY_OBJ);
  }
  ruleTricky2() {
    let $ll1, $ll2, $ll3, x:any=null, y:any=null, z:any=null;
    $ll1 = this.ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.ll(3);
        if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.ll(3);
        if(($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */]))){
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
        } else { //$ll3 === 2 /*#string:B*/
          z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
          this.e(2 /*#string:B*/);
        }
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
        }
      } else if(($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
        //Ambiguity
        this.e(1 /*#string:A*/);
        //Ambiguity
        y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */])
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(7/* Tricky2 4 */, this.ruleTricky2());
        }
      }
    } else if($ll1 === 2 /*#string:B*/){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
        }
      } else if(($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
        //Ambiguity
        z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
        //Ambiguity
        this.e(2 /*#string:B*/);
      } else if($ll2 === 2 /*#string:B*/){
        z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
        this.e(2 /*#string:B*/);
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */])
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          z = this.ctx.u(6/* Tricky2 1 */, this.ruleTricky2());
          //Ambiguity
          this.e(2 /*#string:B*/);
        }
      }
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */])){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */])
        throw new Error("Ambiguity");
        x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
      }
    } else if(($ll1 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */]))){
      throw new Error("Ambiguity");
      x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */])){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
        }
      } else if(($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */])
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
        }
      }
    } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */])
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 5/* Tricky2 1 */, 7/* Tricky2 4 */, 6/* Tricky2 1 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([6/* Tricky2 1 */, 7/* Tricky2 4 */, 5/* Tricky2 1 */, 6/* Tricky2 1 */, 7/* Tricky2 4 */])
        throw new Error("Ambiguity");
        x = this.ctx.u(5/* Tricky2 1 */, this.ruleTricky2());
      }
    }
    return this.ctx.o({x, y, z});
  }
  ruleTricky3(arg) {
    let $ll1, $ll2, $ll3, x:any=null, y:any=null, z:any=null;
    $ll1 = this.ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.ll(3);
        if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.ll(3);
        if(($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */]))){
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
        } else { //$ll3 === 2 /*#string:B*/
          z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
          this.e(2 /*#string:B*/);
        }
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
        }
      } else if(($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
        //Ambiguity
        this.e(1 /*#string:A*/);
        //Ambiguity
        y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */])
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          this.e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.u(10/* Tricky3 4 */, this.ruleTricky3(20));
        }
      }
    } else if($ll1 === 2 /*#string:B*/){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
        }
      } else if(($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
        //Ambiguity
        z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
        //Ambiguity
        this.e(2 /*#string:B*/);
      } else if($ll2 === 2 /*#string:B*/){
        z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
        this.e(2 /*#string:B*/);
      } else if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */])
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.u(9/* Tricky3 1 */, this.ruleTricky3(30));
          //Ambiguity
          this.e(2 /*#string:B*/);
        }
      }
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */])){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */])
        throw new Error("Ambiguity");
        x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
      }
    } else if(($ll1 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */]))){
      throw new Error("Ambiguity");
      x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
    } else if($ll1 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */])){
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
        }
      } else if(($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */]))){
        throw new Error("Ambiguity");
        x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */])
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
        }
      }
    } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */])
      $ll2 = this.ll(2);
      if($ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */])){
        $ll3 = this.ll(3);
        { //($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 10/* Tricky3 4 */, 8/* Tricky3 1 */, 9/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */]))
          throw new Error("Ambiguity");
          x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
        }
      } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([9/* Tricky3 1 */, 8/* Tricky3 1 */, 10/* Tricky3 4 */, 9/* Tricky3 1 */, 8/* Tricky3 1 */])
        throw new Error("Ambiguity");
        x = this.ctx.u(8/* Tricky3 1 */, this.ruleTricky3(10));
      }
    }
    return this.ctx.o({x, y, z});
  }
  ruleTricky4() {
    let $ll1, $ll2, $ll3;
    $ll1 = this.ll(1);
    if($ll1 === -1 /*#eof*/){
      $ll2 = this.ll(2);
      if($ll2 === -1 /*#eof*/ || $ll2 === 2 /*#string:B*/){
        this.ctx.u(11/* Tricky4 1 */, this.ruleTricky4());
        switch(this.ll(1)){
          case -1 /*#eof*/:
            break;
          case 2 /*#string:B*/:
            this.e(2 /*#string:B*/);
            break;
          default:
            this.err();
        }
      } else { //($ll2 === -1 /*#eof*/ && this.ctx.f([11/* Tricky4 1 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky4 1 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([12/* Tricky4 5 */]))
      }
    } else if($ll1 === 1 /*#string:A*/){
      $ll2 = this.ll(2);
      if($ll2 === -1 /*#eof*/ || $ll2 === 2 /*#string:B*/){
        $ll3 = this.ll(3);
        { //$ll3 === -1 /*#eof*/
          throw new Error("Ambiguity");
          this.ctx.u(11/* Tricky4 1 */, this.ruleTricky4());
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
          this.ctx.u(12/* Tricky4 5 */, this.ruleTricky4());
        }
      } else { //$ll2 === 1 /*#string:A*/
        $ll3 = this.ll(3);
        { //$ll3 === -1 /*#eof*/ || $ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/
          throw new Error("Ambiguity");
          this.ctx.u(11/* Tricky4 1 */, this.ruleTricky4());
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
          this.ctx.u(12/* Tricky4 5 */, this.ruleTricky4());
        }
      }
    } else { //$ll1 === 2 /*#string:B*/
      this.ctx.u(11/* Tricky4 1 */, this.ruleTricky4());
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
}

export function parse(external: $ExternalCalls, string: string) {
  const input = new Input({ string });
  const tokenizer = new GrammarTokenizer(input, external);
  const parser = new GrammarParser(tokenizer, external);
  return parser.ctx.u(-1, parser.ruleA());
}
