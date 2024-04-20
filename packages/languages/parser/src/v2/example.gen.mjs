import { Input } from "./runtime/input";
import { Tokenizer } from "./runtime/tokenizer";
import { Parser } from "./runtime/parser";

const EMPTY_OBJ = {};

class GrammarTokenizer extends Tokenizer {
  $getIdToLabel() {
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
      "11": "#string:P",
      "12": "W",
      "13": "TY",
      "-1": "#eof"
    };
  }
  $getIdToChannels() {
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
        "c": []
      },
      "12": {
        "s": false,
        "c": [
          "channel1"
        ]
      },
      "13": {
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
    let $startMarker, $startPos=null, id=null, token=null, $0_t=null, $1_t=null, $2_t=null, $3_t=null, $4_t=null, $5_t=null, $6_t=null, $7_t=null, $8_t=null, $9_t=null, $10_t=null, $11_t=null, $12_text=null, $13_num=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 60 /*'<'*/:
      case 65 /*'A'*/:
      case 66 /*'B'*/:
      case 67 /*'C'*/:
      case 68 /*'D'*/:
      case 69 /*'E'*/:
      case 70 /*'F'*/:
      case 79 /*'O'*/:
      case 80 /*'P'*/:
      case 83 /*'S'*/:
      case 87 /*'W'*/:
      case 97 /*'a'*/:
        $startMarker = this.$startText();
        switch(this.$ll(1)){
          case 60 /*'<'*/:
            this.$e(60 /*'<'*/);
            this.$e(60 /*'<'*/);
            switch(this.$ll(1)){
              case NaN:
                $9_t = this.$endText($startMarker);
                id = 9;
                token = $9_t;
                break;
              case 60 /*'<'*/:
                this.$e(60 /*'<'*/);
                $8_t = this.$endText($startMarker);
                id = 8;
                token = $8_t;
                break;
              default:
                this.$err();
            }
            break;
          case 65 /*'A'*/:
            this.$e(65 /*'A'*/);
            $1_t = this.$endText($startMarker);
            id = 1;
            token = $1_t;
            break;
          case 66 /*'B'*/:
            this.$e(66 /*'B'*/);
            $2_t = this.$endText($startMarker);
            id = 2;
            token = $2_t;
            break;
          case 67 /*'C'*/:
            this.$e(67 /*'C'*/);
            $3_t = this.$endText($startMarker);
            id = 3;
            token = $3_t;
            break;
          case 68 /*'D'*/:
            this.$e(68 /*'D'*/);
            $4_t = this.$endText($startMarker);
            id = 4;
            token = $4_t;
            break;
          case 69 /*'E'*/:
            this.$e(69 /*'E'*/);
            $5_t = this.$endText($startMarker);
            id = 5;
            token = $5_t;
            break;
          case 70 /*'F'*/:
            this.$e(70 /*'F'*/);
            $6_t = this.$endText($startMarker);
            id = 6;
            token = $6_t;
            break;
          case 79 /*'O'*/:
            this.$e(79 /*'O'*/);
            $0_t = this.$endText($startMarker);
            id = 0;
            token = $0_t;
            break;
          case 80 /*'P'*/:
            this.$e(80 /*'P'*/);
            $11_t = this.$endText($startMarker);
            id = 11;
            token = $11_t;
            break;
          case 83 /*'S'*/:
            this.$e(83 /*'S'*/);
            this.$e(84 /*'T'*/);
            this.$e(82 /*'R'*/);
            this.$e(73 /*'I'*/);
            this.$e(78 /*'N'*/);
            this.$e(71 /*'G'*/);
            $7_t = this.$endText($startMarker);
            id = 7;
            token = $7_t;
            break;
          case 87 /*'W'*/:
            this.$e(87 /*'W'*/);
            $12_text = this.$endText($startMarker);
            id = 12;
            token = $12_text;
            break;
          case 97 /*'a'*/:
            this.$e(97 /*'a'*/);
            $10_t = this.$endText($startMarker);
            id = 10;
            token = $10_t;
            break;
          default:
            this.$err();
        }
        break;
      case NaN:
        $13_num = 10;
        id = 13;
        token = $13_num;
        break;
      case -1 /*-1*/:
        this.$e(-1 /*-1*/);
        id = -1;
        token = null;
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {id, token, $loc};
  }
  token$_1() {
    this.$e(-1 /*-1*/);
    return null;
  }
  token$0() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(79 /*'O'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$1() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(65 /*'A'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$2() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(66 /*'B'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$3() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(67 /*'C'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$4() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(68 /*'D'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$5() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(69 /*'E'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$6() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(70 /*'F'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$7() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(83 /*'S'*/);
    this.$e(84 /*'T'*/);
    this.$e(82 /*'R'*/);
    this.$e(73 /*'I'*/);
    this.$e(78 /*'N'*/);
    this.$e(71 /*'G'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$8() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(60 /*'<'*/);
    this.$e(60 /*'<'*/);
    this.$e(60 /*'<'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$9() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(60 /*'<'*/);
    this.$e(60 /*'<'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$10() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(97 /*'a'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$11() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(80 /*'P'*/);
    t = this.$endText($startMarker);
    return t;
  }
  tokenW() {
    let $startMarker, text=null;
    $startMarker = this.$startText();
    this.$e(87 /*'W'*/);
    text = this.$endText($startMarker);
    return text;
  }
  tokenTY() {
    let num=null;
    num = 10;
    return num;
  }
}

class GrammarParser extends Parser {
  rule$$START$$(arg) {
    let $startPos=null, $$ret=null, $loc=null;
    $startPos = this.$getPos();
    $$ret = this.ctx.p(0/* $$START$$ 2 */, () => this.ruleA(arg));
    this.$e(-1 /*#eof*/);
    $loc = this.$getLoc($startPos);
    return $$ret;
  }
  ruleA(arg) {
    let $ll1, $ll2, $ll3, $startPos=null, B=null, D=[], my_obj=null, C=null, T=null, $loc=null;
    $startPos = this.$getPos();
    s5:do{
      s4:do{
        s3:do{
          $ll1 = this.$ll(1);
          if($ll1 === 0 /*#string:O*/){
          } else if($ll1 === 1 /*#string:A*/){
            $ll2 = this.$ll(2);
            if($ll2 === 0 /*#string:O*/ || $ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
              B = this.ctx.p(1/* A 2 */, () => this.ruleB());
              switch(this.$ll(1)){
                case 0 /*#string:O*/:
                  break;
                case 1 /*#string:A*/:
                  break s3;
                case 2 /*#string:B*/:
                  break s4;
                default:
                  this.$err();
              }
            } else { //$ll2 === 3 /*#string:C*/
              $ll3 = this.$ll(3);
              if($ll3 === 0 /*#string:O*/ || $ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/ || $ll3 === 6 /*#string:F*/ || $ll3 === 7 /*#string:STRING*/ || ($ll3 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */]))){
                break;
              } else { //$ll3 === 4 /*#string:D*/
                throw new Error("Ambiguity");
                B = this.ctx.p(1/* A 2 */, () => this.ruleB());
                switch(this.$ll(1)){
                  case 0 /*#string:O*/:
                    break;
                  case 1 /*#string:A*/:
                    break s3;
                  case 2 /*#string:B*/:
                    break s4;
                  default:
                    this.$err();
                }
                //Ambiguity
                break;
              }
            }
          } else { //$ll1 === 2 /*#string:B*/
            break s4;
          }
          this.$e(0 /*#string:O*/);
          switch(this.$ll(1)){
            case 1 /*#string:A*/:
              break;
            case 2 /*#string:B*/:
              break s4;
            default:
              this.$err();
          }
        }while(0);
        this.$e(1 /*#string:A*/);
        break s5;
      }while(0);
      this.$e(2 /*#string:B*/);
    }while(0);
    this.$e(3 /*#string:C*/);
    s7:do{
      l1:while(1){
        $ll1 = this.$ll(1);
        if($ll1 === 0 /*#string:O*/){
          break;
        } else if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/ || ($ll1 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */]))){
          break s7;
        } else if($ll1 === 4 /*#string:D*/){
          D.push(this.$e(4 /*#string:D*/));
          this.$e(5 /*#string:E*/);
          continue;
        } else { //$ll1 === 6 /*#string:F*/
          while(1){
            this.$e(6 /*#string:F*/);
            $ll1 = this.$ll(1);
            if($ll1 === 0 /*#string:O*/){
              break l1;
            } else if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/ || ($ll1 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */]))){
              break s7;
            } else { //$ll1 === 6 /*#string:F*/
              continue;
            }
          }
        }
      }
      this.$e(0 /*#string:O*/);
    }while(0);
    my_obj = {id: 10};
    C = this.ctx.p(2/* A 9 */, () => this.ruleC(10, 20));
    T = this.ctx.p(3/* A 10 */, () => this.ruleTricky2());
    $loc = this.$getLoc($startPos);
    return {o: my_obj, b: B, c: C, d: D, t: T, external: this.external.externalCall(my_obj, C), $loc};
  }
  ruleB() {
    let $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.$e(1 /*#string:A*/);
    $ll1 = this.$ll(1);
    if($ll1 === 2 /*#string:B*/){
      while(1){
        this.$e(2 /*#string:B*/);
        this.$e(4 /*#string:D*/);
        $ll1 = this.$ll(1);
        if($ll1 === 2 /*#string:B*/){
          continue;
        } else { //($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 2 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 2 */]))
          break;
        }
      }
    } else if($ll1 === 3 /*#string:C*/){
      while(1){
        this.$e(3 /*#string:C*/);
        this.$e(4 /*#string:D*/);
        $ll1 = this.$ll(1);
        if($ll1 === 3 /*#string:C*/){
          continue;
        } else { //($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 2 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 2 */]))
          break;
        }
      }
    } else { //($ll1 === 0 /*#string:O*/ && this.ctx.f([1/* A 2 */])) || ($ll1 === 1 /*#string:A*/ && this.ctx.f([1/* A 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([1/* A 2 */]))
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleC(x,y) {
    let $ll1, $startPos=null, text=null, ret=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 7 /*#string:STRING*/){
      text = this.$e(7 /*#string:STRING*/);
      ret = {x, y};
    } else { //($ll1 === 1 /*#string:A*/ && this.ctx.f([2/* A 9 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([2/* A 9 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 2/* A 9 */]))
      ret = {x: y, y: x};
    }
    $loc = this.$getLoc($startPos);
    return {ret, text, $loc};
  }
  ruleF(arg) {
    let $startPos=null, ret=null, w=null, $loc=null;
    $startPos = this.$getPos();
    ret = {x: arg};
    w = this.$e(12 /*W*/);
    this.ctx.p(4/* F 4 */, () => this.ruleH(10));
    $loc = this.$getLoc($startPos);
    return w;
  }
  ruleG() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 8 /*#string:<<<*/:
        this.$e(8 /*#string:<<<*/);
        break;
      case 9 /*#string:<<*/:
        this.$e(9 /*#string:<<*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleH(x) {
    let $startPos=null, y=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 10 /*#string:a*/:
        y = this.$e(10 /*#string:a*/);
        break;
      case NaN:
        y = x;
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return y;
  }
  ruleTricky1() {
    let $ll1, $ll2, $ll3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    do{
      $ll1 = this.$ll(1);
      if($ll1 === 1 /*#string:A*/){
        $ll2 = this.$ll(2);
        if($ll2 === 1 /*#string:A*/){
          $ll3 = this.$ll(3);
          if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
            throw new Error("Ambiguity");
            1;
            $ll1 = this.$ll(1);
            if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
              this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
            } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
              throw new Error("Ambiguity");
              this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
              //Ambiguity
              // epsilon
            }
            //Ambiguity
            2;
            //Ambiguity
            this.$e(1 /*#string:A*/);
            //Ambiguity
            this.ctx.p(6/* Tricky1 8 */, () => this.ruleTricky1());
            //Ambiguity
            20;
            //Ambiguity
            break;
            //Ambiguity
            3;
            //Ambiguity
            this.ctx.p(7/* Tricky1 10 */, () => this.ruleTricky1());
            //Ambiguity
            this.$e(2 /*#string:B*/);
            //Ambiguity
            30;
            //Ambiguity
            break;
          } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
            throw new Error("Ambiguity");
            1;
            $ll1 = this.$ll(1);
            if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
              this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
            } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
              throw new Error("Ambiguity");
              this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
              //Ambiguity
              // epsilon
            }
            //Ambiguity
            2;
            //Ambiguity
            this.$e(1 /*#string:A*/);
            //Ambiguity
            this.ctx.p(6/* Tricky1 8 */, () => this.ruleTricky1());
            //Ambiguity
            20;
            //Ambiguity
            break;
          }
        } else if($ll2 === 2 /*#string:B*/){
          $ll3 = this.$ll(3);
          if($ll3 === 2 /*#string:B*/){
            3;
            this.ctx.p(7/* Tricky1 10 */, () => this.ruleTricky1());
            this.$e(2 /*#string:B*/);
            30;
            break;
          } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
            throw new Error("Ambiguity");
            1;
            $ll1 = this.$ll(1);
            if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
              this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
            } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
              throw new Error("Ambiguity");
              this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
              //Ambiguity
              // epsilon
            }
            //Ambiguity
            2;
            //Ambiguity
            this.$e(1 /*#string:A*/);
            //Ambiguity
            this.ctx.p(6/* Tricky1 8 */, () => this.ruleTricky1());
            //Ambiguity
            20;
            //Ambiguity
            break;
            //Ambiguity
            3;
            //Ambiguity
            this.ctx.p(7/* Tricky1 10 */, () => this.ruleTricky1());
            //Ambiguity
            this.$e(2 /*#string:B*/);
            //Ambiguity
            30;
            //Ambiguity
            break;
          }
        } else { //($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
          throw new Error("Ambiguity");
          1;
          $ll1 = this.$ll(1);
          if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
            this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
          } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
            throw new Error("Ambiguity");
            this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
            //Ambiguity
            // epsilon
          }
          //Ambiguity
          2;
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          this.ctx.p(6/* Tricky1 8 */, () => this.ruleTricky1());
          //Ambiguity
          20;
          //Ambiguity
          break;
        }
      } else if($ll1 === 2 /*#string:B*/){
        $ll2 = this.$ll(2);
        if($ll2 === 2 /*#string:B*/){
          3;
          this.ctx.p(7/* Tricky1 10 */, () => this.ruleTricky1());
          this.$e(2 /*#string:B*/);
          30;
          break;
        } else { //($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
          throw new Error("Ambiguity");
          1;
          $ll1 = this.$ll(1);
          if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
            this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
          } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
            throw new Error("Ambiguity");
            this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
            //Ambiguity
            // epsilon
          }
          //Ambiguity
          3;
          //Ambiguity
          this.ctx.p(7/* Tricky1 10 */, () => this.ruleTricky1());
          //Ambiguity
          this.$e(2 /*#string:B*/);
          //Ambiguity
          30;
          //Ambiguity
          break;
        }
      } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
        1;
        $ll1 = this.$ll(1);
        if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
          this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
        } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 6/* Tricky1 8 */, 5/* Tricky1 3 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([7/* Tricky1 10 */, 5/* Tricky1 3 */, 6/* Tricky1 8 */]))
          throw new Error("Ambiguity");
          this.ctx.p(5/* Tricky1 3 */, () => this.ruleTricky1());
          //Ambiguity
          // epsilon
        }
      }
      10;
    }while(0);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleTricky2() {
    let $ll1, $ll2, $ll3, $startPos=null, y=null, z=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.$ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.$ll(3);
        if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
          throw new Error("Ambiguity");
          z = this.ctx.p(8/* Tricky2 2 */, () => this.ruleTricky2());
          this.$e(2 /*#string:B*/);
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.p(9/* Tricky2 6 */, () => this.ruleTricky2());
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */, 9/* Tricky2 6 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */, 9/* Tricky2 6 */]))
          this.$e(1 /*#string:A*/);
          y = this.ctx.p(9/* Tricky2 6 */, () => this.ruleTricky2());
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.$ll(3);
        if($ll3 === 2 /*#string:B*/){
          z = this.ctx.p(8/* Tricky2 2 */, () => this.ruleTricky2());
          this.$e(2 /*#string:B*/);
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */, 9/* Tricky2 6 */])) || ($ll3 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */, 9/* Tricky2 6 */]))
          throw new Error("Ambiguity");
          z = this.ctx.p(8/* Tricky2 2 */, () => this.ruleTricky2());
          this.$e(2 /*#string:B*/);
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.p(9/* Tricky2 6 */, () => this.ruleTricky2());
        }
      } else { //($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */, 9/* Tricky2 6 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */, 9/* Tricky2 6 */]))
        this.$e(1 /*#string:A*/);
        y = this.ctx.p(9/* Tricky2 6 */, () => this.ruleTricky2());
      }
    } else if($ll1 === 2 /*#string:B*/){
      z = this.ctx.p(8/* Tricky2 2 */, () => this.ruleTricky2());
      this.$e(2 /*#string:B*/);
    } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([8/* Tricky2 2 */, 9/* Tricky2 6 */])) || ($ll1 === -1 /*#eof*/ && this.ctx.f([0/* $$START$$ 2 */, 3/* A 10 */, 9/* Tricky2 6 */]))
    }
    $loc = this.$getLoc($startPos);
    return {y, z, $loc};
  }
  ruleTricky3(arg) {
    let $ll1, $ll2, $ll3, $startPos=null, x=null, y=null, z=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.$ll(2);
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.$ll(3);
        if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
          throw new Error("Ambiguity");
          x = this.ctx.p(10/* Tricky3 2 */, () => this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.p(11/* Tricky3 2 */, () => this.ruleTricky3(30));
          //Ambiguity
          this.$e(2 /*#string:B*/);
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.p(12/* Tricky3 6 */, () => this.ruleTricky3(20));
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */, 10/* Tricky3 2 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */, 12/* Tricky3 6 */]))
          throw new Error("Ambiguity");
          x = this.ctx.p(10/* Tricky3 2 */, () => this.ruleTricky3(10));
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.p(12/* Tricky3 6 */, () => this.ruleTricky3(20));
        }
      } else if($ll2 === 2 /*#string:B*/){
        $ll3 = this.$ll(3);
        if($ll3 === 2 /*#string:B*/){
          z = this.ctx.p(11/* Tricky3 2 */, () => this.ruleTricky3(30));
          this.$e(2 /*#string:B*/);
        } else { //($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */, 10/* Tricky3 2 */])) || ($ll3 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */, 12/* Tricky3 6 */]))
          throw new Error("Ambiguity");
          x = this.ctx.p(10/* Tricky3 2 */, () => this.ruleTricky3(10));
          //Ambiguity
          z = this.ctx.p(11/* Tricky3 2 */, () => this.ruleTricky3(30));
          //Ambiguity
          this.$e(2 /*#string:B*/);
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          y = this.ctx.p(12/* Tricky3 6 */, () => this.ruleTricky3(20));
        }
      } else { //($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */, 10/* Tricky3 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */, 12/* Tricky3 6 */]))
        throw new Error("Ambiguity");
        x = this.ctx.p(10/* Tricky3 2 */, () => this.ruleTricky3(10));
        //Ambiguity
        this.$e(1 /*#string:A*/);
        //Ambiguity
        y = this.ctx.p(12/* Tricky3 6 */, () => this.ruleTricky3(20));
      }
    } else if($ll1 === 2 /*#string:B*/){
      $ll2 = this.$ll(2);
      if($ll2 === 2 /*#string:B*/){
        z = this.ctx.p(11/* Tricky3 2 */, () => this.ruleTricky3(30));
        this.$e(2 /*#string:B*/);
      } else { //($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */, 10/* Tricky3 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */, 12/* Tricky3 6 */]))
        throw new Error("Ambiguity");
        x = this.ctx.p(10/* Tricky3 2 */, () => this.ruleTricky3(10));
        //Ambiguity
        z = this.ctx.p(11/* Tricky3 2 */, () => this.ruleTricky3(30));
        //Ambiguity
        this.$e(2 /*#string:B*/);
      }
    } else { //($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 12/* Tricky3 6 */, 10/* Tricky3 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([11/* Tricky3 2 */, 10/* Tricky3 2 */, 12/* Tricky3 6 */]))
      throw new Error("Ambiguity");
      x = this.ctx.p(10/* Tricky3 2 */, () => this.ruleTricky3(10));
      //Ambiguity
      // epsilon
    }
    $loc = this.$getLoc($startPos);
    return {x, y, z, $loc};
  }
  ruleTricky4() {
    let $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === -1 /*#eof*/){
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/ || $ll2 === 2 /*#string:B*/){
        this.ctx.p(13/* Tricky4 2 */, () => this.ruleTricky4());
        switch(this.$ll(1)){
          case -1 /*#eof*/:
            break;
          case 2 /*#string:B*/:
            this.$e(2 /*#string:B*/);
            break;
          default:
            this.$err();
        }
      } else { //($ll2 === -1 /*#eof*/ && this.ctx.f([13/* Tricky4 2 */])) || ($ll2 === 2 /*#string:B*/ && this.ctx.f([13/* Tricky4 2 */])) || ($ll2 === -1 /*#eof*/ && this.ctx.f([14/* Tricky4 7 */]))
      }
    } else { //$ll1 === 1 /*#string:A*/
      throw new Error("Ambiguity");
      this.ctx.p(13/* Tricky4 2 */, () => this.ruleTricky4());
      switch(this.$ll(1)){
        case -1 /*#eof*/:
          break;
        case 2 /*#string:B*/:
          this.$e(2 /*#string:B*/);
          break;
        default:
          this.$err();
      }
      //Ambiguity
      this.$e(1 /*#string:A*/);
      //Ambiguity
      this.ctx.p(14/* Tricky4 7 */, () => this.ruleTricky4());
    }
    this.$e(-1 /*#eof*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleY() {
    let $startPos=null, y=null, $loc=null;
    $startPos = this.$getPos();
    y = this.$e(13 /*TY*/);
    $loc = this.$getLoc($startPos);
    return y;
  }
  ruleRec1() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(15/* Rec1 2 */, () => this.ruleRec1());
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case NaN:
        this.ctx.p(16/* Rec2 2 */, () => this.ruleRec2());
        break;
      case NaN:
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec3() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 1 /*#string:A*/:
        this.ctx.p(17/* Rec3 2 */, () => this.ruleRec3());
        break;
      case 1 /*#string:A*/:
        this.$e(1 /*#string:A*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRecTricky1() {
    let $ll1, $ll2, $ll3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    do{
      $ll1 = this.$ll(1);
      if($ll1 === 1 /*#string:A*/){
        $ll2 = this.$ll(2);
        if($ll2 === 1 /*#string:A*/){
          $ll3 = this.$ll(3);
          if($ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/){
            throw new Error("Ambiguity");
            1;
            $ll1 = this.$ll(1);
            if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
              this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
            } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
              throw new Error("Ambiguity");
              this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
              //Ambiguity
              // epsilon
            }
            //Ambiguity
            2;
            //Ambiguity
            this.$e(1 /*#string:A*/);
            //Ambiguity
            this.ctx.p(19/* RecTricky1 8 */, () => this.ruleRecTricky2());
            //Ambiguity
            20;
            //Ambiguity
            break;
            //Ambiguity
            3;
            //Ambiguity
            this.ctx.p(20/* RecTricky1 10 */, () => this.ruleRecTricky2());
            //Ambiguity
            this.$e(2 /*#string:B*/);
            //Ambiguity
            30;
            //Ambiguity
            break;
          } else { //$ll3 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
            throw new Error("Ambiguity");
            1;
            $ll1 = this.$ll(1);
            if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
              this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
            } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
              throw new Error("Ambiguity");
              this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
              //Ambiguity
              // epsilon
            }
            //Ambiguity
            2;
            //Ambiguity
            this.$e(1 /*#string:A*/);
            //Ambiguity
            this.ctx.p(19/* RecTricky1 8 */, () => this.ruleRecTricky2());
            //Ambiguity
            20;
            //Ambiguity
            break;
          }
        } else if($ll2 === 2 /*#string:B*/){
          $ll3 = this.$ll(3);
          if($ll3 === 2 /*#string:B*/){
            3;
            this.ctx.p(20/* RecTricky1 10 */, () => this.ruleRecTricky2());
            this.$e(2 /*#string:B*/);
            30;
            break;
          } else { //$ll3 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
            throw new Error("Ambiguity");
            1;
            $ll1 = this.$ll(1);
            if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
              this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
            } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
              throw new Error("Ambiguity");
              this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
              //Ambiguity
              // epsilon
            }
            //Ambiguity
            2;
            //Ambiguity
            this.$e(1 /*#string:A*/);
            //Ambiguity
            this.ctx.p(19/* RecTricky1 8 */, () => this.ruleRecTricky2());
            //Ambiguity
            20;
            //Ambiguity
            break;
            //Ambiguity
            3;
            //Ambiguity
            this.ctx.p(20/* RecTricky1 10 */, () => this.ruleRecTricky2());
            //Ambiguity
            this.$e(2 /*#string:B*/);
            //Ambiguity
            30;
            //Ambiguity
            break;
          }
        } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
          throw new Error("Ambiguity");
          1;
          $ll1 = this.$ll(1);
          if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
            this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
          } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
            throw new Error("Ambiguity");
            this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
            //Ambiguity
            // epsilon
          }
          //Ambiguity
          2;
          //Ambiguity
          this.$e(1 /*#string:A*/);
          //Ambiguity
          this.ctx.p(19/* RecTricky1 8 */, () => this.ruleRecTricky2());
          //Ambiguity
          20;
          //Ambiguity
          break;
        }
      } else if($ll1 === 2 /*#string:B*/){
        $ll2 = this.$ll(2);
        if($ll2 === 2 /*#string:B*/){
          3;
          this.ctx.p(20/* RecTricky1 10 */, () => this.ruleRecTricky2());
          this.$e(2 /*#string:B*/);
          30;
          break;
        } else { //$ll2 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
          throw new Error("Ambiguity");
          1;
          $ll1 = this.$ll(1);
          if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
            this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
          } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
            throw new Error("Ambiguity");
            this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
            //Ambiguity
            // epsilon
          }
          //Ambiguity
          3;
          //Ambiguity
          this.ctx.p(20/* RecTricky1 10 */, () => this.ruleRecTricky2());
          //Ambiguity
          this.$e(2 /*#string:B*/);
          //Ambiguity
          30;
          //Ambiguity
          break;
        }
      } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
        1;
        $ll1 = this.$ll(1);
        if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
          this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
        } else { //$ll1 === 2 /*#string:B*/ && this.ctx.f([20/* RecTricky1 10 */, 21/* RecTricky2 2 */])
          throw new Error("Ambiguity");
          this.ctx.p(18/* RecTricky1 3 */, () => this.ruleRecTricky2());
          //Ambiguity
          // epsilon
        }
      }
      10;
    }while(0);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecTricky2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(21/* RecTricky2 2 */, () => this.ruleRecTricky1());
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecTricky3() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 1 /*#string:A*/:
      case 2 /*#string:B*/:
        this.ctx.p(22/* RecTricky3 2 */, () => this.ruleRecTricky2());
        break;
      case 3 /*#string:C*/:
        this.$e(3 /*#string:C*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecMutual1() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 3 /*#string:C*/:
      case 2 /*#string:B*/:
        this.ctx.p(23/* RecMutual1 2 */, () => this.ruleRecMutual2());
        break;
      case 2 /*#string:B*/:
        this.$e(2 /*#string:B*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecMutual2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 2 /*#string:B*/:
      case 3 /*#string:C*/:
        this.ctx.p(24/* RecMutual2 2 */, () => this.ruleRecMutual1());
        break;
      case 3 /*#string:C*/:
        this.$e(3 /*#string:C*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleUsesEmpty() {
    let $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    { //$ll1 === 1 /*#string:A*/
      $ll2 = this.$ll(2);
      if($ll2 === 2 /*#string:B*/){
        this.ctx.p(25/* UsesEmpty 2 */, () => this.ruleEmpty());
        this.$e(1 /*#string:A*/);
        this.ctx.p(26/* UsesEmpty 4 */, () => this.ruleEmpty());
        this.$e(2 /*#string:B*/);
      } else { //$ll2 === 3 /*#string:C*/
        this.$e(1 /*#string:A*/);
        this.$e(3 /*#string:C*/);
      }
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleEmpty() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleEmptyOrNot() {
    let $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 0 /*#string:O*/){
      this.$e(0 /*#string:O*/);
    } else { //($ll1 === 1 /*#string:A*/ && this.ctx.f([27/* TrickyAfterEmpty 2 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([27/* TrickyAfterEmpty 2 */]))
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleTrickyAfterEmpty() {
    let $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 0 /*#string:O*/){
      $ll2 = this.$ll(2);
      if($ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
        this.ctx.p(27/* TrickyAfterEmpty 2 */, () => this.ruleEmptyOrNot());
        this.ctx.p(28/* TrickyAfterEmpty 6 */, () => this.ruleTricky1());
      } else { //$ll2 === 11 /*#string:P*/
        this.$e(0 /*#string:O*/);
        this.$e(11 /*#string:P*/);
      }
    } else { //$ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/
      this.ctx.p(27/* TrickyAfterEmpty 2 */, () => this.ruleEmptyOrNot());
      this.ctx.p(28/* TrickyAfterEmpty 6 */, () => this.ruleTricky1());
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
}

export function parse(external, string, $arg) {
  const input = new Input({ string });
  const tokenizer = new GrammarTokenizer(input, external);
  const parser = new GrammarParser(tokenizer, external);
  return parser.rule$$START$$($arg);
}
