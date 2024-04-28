import { Input } from "./runtime/input";
import { Tokenizer } from "./runtime/tokenizer";
import { Parser } from "./runtime/parser";

const $$EMPTY_OBJ = {};

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
    $$ret = this.ctx.p(0 /* $$START$$ 2 */, () => this.ruleA(arg));
    this.$e(-1 /*#eof*/);
    $loc = this.$getLoc($startPos);
    return $$ret;
  }
  ruleA(arg) {
    let $dd, $ll1, $ll2, $ll3, $startPos=null, B=null, D=[], my_obj=null, C=null, T=null, $loc=null;
    $startPos = this.$getPos();
    s5:do{
      s4:do{
        s3:do{
          $ll1 = this.$ll(1);
          if($ll1 === 0 /*#string:O*/){
            $dd = 1;
          } else if($ll1 === 1 /*#string:A*/){
            $ll2 = this.$ll(2);
            if($ll2 === 0 /*#string:O*/ || $ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
              $dd = 0;
            } else { //$ll2 === 3 /*#string:C*/
              $ll3 = this.$ll(3);
              if($ll3 === -1 /*#eof*/ || $ll3 === 0 /*#string:O*/ || $ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/ || $ll3 === 6 /*#string:F*/ || $ll3 === 7 /*#string:STRING*/){
                $dd = 2;
              } else { //$ll3 === 4 /*#string:D*/
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          } else { //$ll1 === 2 /*#string:B*/
            $dd = 3;
          }
          if($dd === 0){
            B = this.ctx.p(1 /* A 2 */, () => this.ruleB());
            switch(this.$ll(1)){
              case 0 /*#string:O*/:
                // epsilon
                break;
              case 1 /*#string:A*/:
                break s3;
              case 2 /*#string:B*/:
                break s4;
              default:
                this.$err();
            }
          } else if($dd === 1){
            // epsilon
          } else if($dd === 2){
            break;
          } else if($dd === 3){
            break s4;
          } else {
            this.$err();
          }
          this.$e(0 /*#string:O*/);
          switch(this.$ll(1)){
            case 1 /*#string:A*/:
              // epsilon
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
        switch(this.$ll(1)){
          case -1 /*#eof*/:
          case 1 /*#string:A*/:
          case 2 /*#string:B*/:
          case 7 /*#string:STRING*/:
            break s7;
          case 4 /*#string:D*/:
            D.push(this.$e(4 /*#string:D*/));
            this.$e(5 /*#string:E*/);
            continue;
          case 0 /*#string:O*/:
            break l1;
          case 6 /*#string:F*/:
            while(1){
              this.$e(6 /*#string:F*/);
              switch(this.$ll(1)){
                case -1 /*#eof*/:
                case 1 /*#string:A*/:
                case 2 /*#string:B*/:
                case 7 /*#string:STRING*/:
                  break s7;
                case 0 /*#string:O*/:
                  break l1;
                case 6 /*#string:F*/:
                  continue;
                default:
                  this.$err();
              }
            }
            break;
          default:
            this.$err();
        }
      }
      this.$e(0 /*#string:O*/);
    }while(0);
    my_obj = {id: 10};
    C = this.ctx.p(2 /* A 7 */, () => this.ruleC(10, 20));
    T = this.ctx.p(3 /* A 8 */, () => this.ruleTricky2());
    $loc = this.$getLoc($startPos);
    return {o: my_obj, b: B, c: C, d: D, t: T, external: this.external.externalCall(my_obj, C), $loc};
  }
  ruleB() {
    let $dd, $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.$e(1 /*#string:A*/);
    $ll1 = this.$ll(1);
    if($ll1 === 0 /*#string:O*/){
      $ll2 = this.$ll(2);
      if($ll2 === 0 /*#string:O*/){
        $dd = 1;
      } else { //$ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/
        throw new Error("Ambiguity");
        $dd = 0;
        //Ambiguity
        $dd = 1;
      }
    } else if($ll1 === 1 /*#string:A*/){
      $dd = 0;
    } else if($ll1 === 2 /*#string:B*/){
      $ll2 = this.$ll(2);
      if($ll2 === 3 /*#string:C*/){
        $dd = 0;
      } else { //$ll2 === 4 /*#string:D*/
        $dd = 2;
      }
    } else { //$ll1 === 3 /*#string:C*/
      $dd = 3;
    }
    if($dd === 0){
      // epsilon
    } else if($dd === 1){
      while(1){
        this.$e(0 /*#string:O*/);
        $ll1 = this.$ll(1);
        if($ll1 === 0 /*#string:O*/){
          $ll2 = this.$ll(2);
          if($ll2 === 0 /*#string:O*/){
            $dd = 1;
          } else { //$ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
          }
        } else { //$ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/
          $dd = 0;
        }
        if($dd === 0){
          break;
        } else if($dd === 1){
          continue;
        } else {
          this.$err();
        }
      }
    } else if($dd === 2){
      while(1){
        this.$e(2 /*#string:B*/);
        this.$e(4 /*#string:D*/);
        $ll1 = this.$ll(1); $ll2 = this.$ll(2); 
        if(($ll1 === 0 /*#string:O*/ || $ll1 === 1 /*#string:A*/ || ($ll1 === 2 /*#string:B*/ && $ll2 === 3 /*#string:C*/))){
          break;
        } else if(($ll1 === 2 /*#string:B*/ && $ll2 === 4 /*#string:D*/)){
          continue;
        } else {
          this.$err();
        }
      }
    } else if($dd === 3){
      l3:while(1){
        this.$e(3 /*#string:C*/);
        this.$e(4 /*#string:D*/);
        switch(this.$ll(1)){
          case 0 /*#string:O*/:
          case 1 /*#string:A*/:
          case 2 /*#string:B*/:
            break l3;
          case 3 /*#string:C*/:
            continue;
          default:
            this.$err();
        }
      }
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleC(x,y) {
    let $startPos=null, text=null, ret=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case -1 /*#eof*/:
      case 1 /*#string:A*/:
      case 2 /*#string:B*/:
        ret = {x: y, y: x};
        break;
      case 7 /*#string:STRING*/:
        text = this.$e(7 /*#string:STRING*/);
        ret = {x, y};
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {ret, text, $loc};
  }
  ruleparent() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(4 /* parent 2 */, () => this.rulechild());
    while(1){
      switch(this.$ll(1)){
        case NaN:
          $loc = this.$getLoc($startPos);
          return {$loc};
        case 1 /*#string:A*/:
          this.$e(1 /*#string:A*/);
          continue;
        default:
          this.$err();
      }
    }
  }
  rulechild() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    while(1){
      $ll1 = this.$ll(1);
      { //$ll1 === 1 /*#string:A*/
        $ll2 = this.$ll(2);
        { //$ll2 === 1 /*#string:A*/
          $ll3 = this.$ll(3);
          { //$ll3 === 1 /*#string:A*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 4 /* parent 2 */
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
            }
          }
        }
      }
      if($dd === 0){
        $loc = this.$getLoc($startPos);
        return {$loc};
      } else if($dd === 1){
        this.$e(1 /*#string:A*/);
        continue;
      } else {
        this.$err();
      }
    }
  }
  ruleF(arg) {
    let $startPos=null, ret=null, w=null, $loc=null;
    $startPos = this.$getPos();
    ret = {x: arg};
    w = this.$e(12 /*W*/);
    this.ctx.p(5 /* F 4 */, () => this.ruleH(10));
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
      case NaN:
        y = x;
        break;
      case 10 /*#string:a*/:
        y = this.$e(10 /*#string:a*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return y;
  }
  ruleTricky1() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    do{
      $ll1 = this.$ll(1);
      if($ll1 === 1 /*#string:A*/){
        $ll2 = this.$ll(2);
        if($ll2 === 1 /*#string:A*/){
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
          //Ambiguity
          $dd = 2;
        } else { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 3 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 3 */ || $ff2 === 29 /* TrickyAfterEmpty 6 */){
                $dd = 2;
              } else if($ff2 === 7 /* Tricky1 8 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 7 /* Tricky1 8 */ || $ff3 === 29 /* TrickyAfterEmpty 6 */){
                  $dd = 2;
                } else { //$ff3 === 8 /* Tricky1 10 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              } else { //$ff2 === 8 /* Tricky1 10 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              }
            } else if($ff1 === 7 /* Tricky1 8 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 3 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 7 /* Tricky1 8 */ || $ff3 === 29 /* TrickyAfterEmpty 6 */){
                  $dd = 2;
                } else { //$ff3 === 8 /* Tricky1 10 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              } else if($ff2 === 7 /* Tricky1 8 */ || $ff2 === 29 /* TrickyAfterEmpty 6 */){
                $dd = 2;
              } else { //$ff2 === 8 /* Tricky1 10 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              }
            } else if($ff1 === 8 /* Tricky1 10 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 2;
            } else { //$ff1 === 29 /* TrickyAfterEmpty 6 */
              $dd = 2;
            }
          }
        }
      } else { //$ll1 === 2 /*#string:B*/
        $ll2 = this.$ll(2);
        { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 3 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 7 /* Tricky1 8 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 8 /* Tricky1 10 */
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 7 /* Tricky1 8 */ || $ff3 === 8 /* Tricky1 10 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 29 /* TrickyAfterEmpty 6 */
                  $dd = 2;
                }
              }
            } else if($ff1 === 7 /* Tricky1 8 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 3 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 8 /* Tricky1 10 */
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 7 /* Tricky1 8 */ || $ff3 === 8 /* Tricky1 10 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 29 /* TrickyAfterEmpty 6 */
                  $dd = 2;
                }
              }
            } else { //$ff1 === 8 /* Tricky1 10 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 3 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 29 /* TrickyAfterEmpty 6 */){
                  $dd = 2;
                } else { //$ff3 === 7 /* Tricky1 8 */ || $ff3 === 8 /* Tricky1 10 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              } else if($ff2 === 7 /* Tricky1 8 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 8 /* Tricky1 10 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 7 /* Tricky1 8 */ || $ff3 === 29 /* TrickyAfterEmpty 6 */
                  $dd = 2;
                }
              } else if($ff2 === 8 /* Tricky1 10 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 29 /* TrickyAfterEmpty 6 */
                $dd = 2;
              }
            }
          }
        }
      }
      if($dd === 0){
        1;
        $ll1 = this.$ll(1);
        if($ll1 === 1 /*#string:A*/){
          $dd = 0;
        } else { //$ll1 === 2 /*#string:B*/
          $ll2 = this.$ll(2);
          { //$ll2 === 2 /*#string:B*/
            $ll3 = this.$ll(3);
            { //$ll3 === 2 /*#string:B*/
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 3 */ || $ff1 === 7 /* Tricky1 8 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              } else { //$ff1 === 8 /* Tricky1 10 */
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 3 */ || $ff2 === 7 /* Tricky1 8 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                } else { //$ff2 === 8 /* Tricky1 10 */
                  $ff3 = this.ctx.ff(3);
                  if($ff3 === 6 /* Tricky1 3 */ || $ff3 === 7 /* Tricky1 8 */ || $ff3 === 8 /* Tricky1 10 */){
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  } else { //$ff3 === 29 /* TrickyAfterEmpty 6 */
                    $dd = 0;
                  }
                }
              }
            }
          }
        }
        if($dd === 0){
          this.ctx.p(6 /* Tricky1 3 */, () => this.ruleTricky1());
        } else if($dd === 1){
          // epsilon
        } else {
          this.$err();
        }
      } else if($dd === 1){
        2;
        this.$e(1 /*#string:A*/);
        this.ctx.p(7 /* Tricky1 8 */, () => this.ruleTricky1());
        20;
        break;
      } else if($dd === 2){
        3;
        this.ctx.p(8 /* Tricky1 10 */, () => this.ruleTricky1());
        this.$e(2 /*#string:B*/);
        30;
        break;
      } else {
        this.$err();
      }
      10;
    }while(0);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleTricky2() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, y=null, z=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === -1 /*#eof*/){
      $dd = 1;
    } else if($ll1 === 1 /*#string:A*/){
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/){
        $dd = 2;
      } else if($ll2 === 1 /*#string:A*/){
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          $dd = 2;
        } else { //$ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 2;
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 8 */){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 2;
          } else if($ff1 === 9 /* Tricky2 2 */){
            $dd = 2;
          } else { //$ff1 === 10 /* Tricky2 6 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 8 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 2;
            } else { //$ff2 === 9 /* Tricky2 2 */
              $dd = 2;
            }
          }
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 8 */){
            $dd = 0;
          } else if($ff1 === 9 /* Tricky2 2 */){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 2;
          } else { //$ff1 === 10 /* Tricky2 6 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 0 /* $$START$$ 2 */ || $ff2 === 3 /* A 8 */ || $ff2 === 10 /* Tricky2 6 */){
              $dd = 0;
            } else { //$ff2 === 9 /* Tricky2 2 */
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 2;
            }
          }
        }
      }
    } else { //$ll1 === 2 /*#string:B*/
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/){
        throw new Error("Ambiguity");
        $dd = 0;
        //Ambiguity
        $dd = 1;
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 8 */){
            $dd = 0;
          } else if($ff1 === 9 /* Tricky2 2 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 8 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 2 */){
              $dd = 1;
            } else { //$ff2 === 10 /* Tricky2 6 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 8 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 2 */
                $dd = 1;
              }
            }
          } else { //$ff1 === 10 /* Tricky2 6 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 8 */){
              $dd = 0;
            } else { //$ff2 === 9 /* Tricky2 2 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 8 */){
                $dd = 0;
              } else if($ff3 === 9 /* Tricky2 2 */){
                $dd = 1;
              } else { //$ff3 === 10 /* Tricky2 6 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 9 /* Tricky2 2 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 0 /* $$START$$ 2 */ || $ff2 === 3 /* A 8 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 2 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === 0 /* $$START$$ 2 */ || $ff3 === 3 /* A 8 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 2 */ || $ff3 === 10 /* Tricky2 6 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            } else { //$ff2 === 10 /* Tricky2 6 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 0 /* $$START$$ 2 */ || $ff3 === 3 /* A 8 */ || $ff3 === 10 /* Tricky2 6 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 2 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          } else { //$ff1 === 10 /* Tricky2 6 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 9 /* Tricky2 2 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 0 /* $$START$$ 2 */ || $ff3 === 3 /* A 8 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 2 */ || $ff3 === 10 /* Tricky2 6 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        }
      }
    }
    if($dd === 0){
      z = this.ctx.p(9 /* Tricky2 2 */, () => this.ruleTricky2());
      this.$e(2 /*#string:B*/);
    } else if($dd === 1){
      // epsilon
    } else if($dd === 2){
      this.$e(1 /*#string:A*/);
      y = this.ctx.p(10 /* Tricky2 6 */, () => this.ruleTricky2());
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {y, z, $loc};
  }
  ruleTricky3(arg) {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, x=null, y=null, z=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.$ll(2);
      if($ll2 === 1 /*#string:A*/){
        throw new Error("Ambiguity");
        $dd = 0;
        //Ambiguity
        $dd = 1;
        //Ambiguity
        $dd = 3;
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 11 /* Tricky3 2 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 11 /* Tricky3 2 */){
              $dd = 1;
            } else if($ff2 === 12 /* Tricky3 2 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 3;
            } else { //$ff2 === 13 /* Tricky3 6 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 11 /* Tricky3 2 */ || $ff3 === 13 /* Tricky3 6 */){
                $dd = 1;
              } else { //$ff3 === 12 /* Tricky3 2 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 3;
              }
            }
          } else if($ff1 === 12 /* Tricky3 2 */){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
            //Ambiguity
            $dd = 3;
          } else { //$ff1 === 13 /* Tricky3 6 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 11 /* Tricky3 2 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === 11 /* Tricky3 2 */ || $ff3 === 13 /* Tricky3 6 */){
                $dd = 1;
              } else { //$ff3 === 12 /* Tricky3 2 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 3;
              }
            } else if($ff2 === 12 /* Tricky3 2 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 3;
            } else { //$ff2 === 13 /* Tricky3 6 */
              $dd = 1;
            }
          }
        }
      }
    } else { //$ll1 === 2 /*#string:B*/
      $ll2 = this.$ll(2);
      { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 11 /* Tricky3 2 */ || $ff1 === 13 /* Tricky3 6 */){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
            //Ambiguity
            $dd = 2;
          } else { //$ff1 === 12 /* Tricky3 2 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 11 /* Tricky3 2 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === 11 /* Tricky3 2 */){
                $dd = 1;
              } else { //$ff3 === 12 /* Tricky3 2 */ || $ff3 === 13 /* Tricky3 6 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              }
            } else if($ff2 === 12 /* Tricky3 2 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 2;
            } else { //$ff2 === 13 /* Tricky3 6 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 11 /* Tricky3 2 */ || $ff3 === 12 /* Tricky3 2 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              } else { //$ff3 === 13 /* Tricky3 6 */
                $dd = 1;
              }
            }
          }
        }
      }
    }
    if($dd === 0){
      x = this.ctx.p(11 /* Tricky3 2 */, () => this.ruleTricky3(10));
    } else if($dd === 1){
      z = this.ctx.p(12 /* Tricky3 2 */, () => this.ruleTricky3(30));
      this.$e(2 /*#string:B*/);
    } else if($dd === 2){
      // epsilon
    } else if($dd === 3){
      this.$e(1 /*#string:A*/);
      y = this.ctx.p(13 /* Tricky3 6 */, () => this.ruleTricky3(20));
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {x, y, z, $loc};
  }
  ruleTricky4() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === -1 /*#eof*/){
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/){
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 14 /* Tricky4 2 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 14 /* Tricky4 2 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
            } else { //$ff2 === 15 /* Tricky4 7 */
              $dd = 0;
            }
          } else { //$ff1 === 15 /* Tricky4 7 */
            $dd = 1;
          }
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 14 /* Tricky4 2 */){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
          } else { //$ff1 === 15 /* Tricky4 7 */
            $dd = 0;
          }
        }
      }
    } else { //$ll1 === 1 /*#string:A*/
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 2;
    }
    if($dd === 0){
      this.ctx.p(14 /* Tricky4 2 */, () => this.ruleTricky4());
      switch(this.$ll(1)){
        case -1 /*#eof*/:
          // epsilon
          break;
        case 2 /*#string:B*/:
          this.$e(2 /*#string:B*/);
          break;
        default:
          this.$err();
      }
    } else if($dd === 1){
      // epsilon
    } else if($dd === 2){
      this.$e(1 /*#string:A*/);
      this.ctx.p(15 /* Tricky4 7 */, () => this.ruleTricky4());
    } else {
      this.$err();
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
    this.ctx.p(16 /* Rec1 2 */, () => this.ruleRec1());
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case NaN:
        this.ctx.p(17 /* Rec2 2 */, () => this.ruleRec2());
        break;
      case NaN:
        // epsilon
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec3() {
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    { //$ll1 === 1 /*#string:A*/
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    }
    if($dd === 0){
      this.ctx.p(18 /* Rec3 2 */, () => this.ruleRec3());
    } else if($dd === 1){
      this.$e(1 /*#string:A*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRecTricky1() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    do{
      $ll1 = this.$ll(1);
      if($ll1 === 1 /*#string:A*/){
        $ll2 = this.$ll(2);
        if($ll2 === 1 /*#string:A*/){
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
          //Ambiguity
          $dd = 2;
        } else { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 22 /* RecTricky2 2 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 19 /* RecTricky1 3 */ || $ff2 === 20 /* RecTricky1 8 */ || $ff2 === 23 /* RecTricky3 2 */){
                $dd = 2;
              } else { //$ff2 === 21 /* RecTricky1 10 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              }
            }
          }
        }
      } else { //$ll1 === 2 /*#string:B*/
        throw new Error("Ambiguity");
        $dd = 0;
        //Ambiguity
        $dd = 2;
      }
      if($dd === 0){
        1;
        $ll1 = this.$ll(1);
        if($ll1 === 1 /*#string:A*/){
          $dd = 0;
        } else { //$ll1 === 2 /*#string:B*/
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
        }
        if($dd === 0){
          this.ctx.p(19 /* RecTricky1 3 */, () => this.ruleRecTricky2());
        } else if($dd === 1){
          // epsilon
        } else {
          this.$err();
        }
      } else if($dd === 1){
        2;
        this.$e(1 /*#string:A*/);
        this.ctx.p(20 /* RecTricky1 8 */, () => this.ruleRecTricky2());
        20;
        break;
      } else if($dd === 2){
        3;
        this.ctx.p(21 /* RecTricky1 10 */, () => this.ruleRecTricky2());
        this.$e(2 /*#string:B*/);
        30;
        break;
      } else {
        this.$err();
      }
      10;
    }while(0);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecTricky2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(22 /* RecTricky2 2 */, () => this.ruleRecTricky1());
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecTricky3() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 1 /*#string:A*/:
      case 2 /*#string:B*/:
        this.ctx.p(23 /* RecTricky3 2 */, () => this.ruleRecTricky2());
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
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 2 /*#string:B*/){
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    } else { //$ll1 === 3 /*#string:C*/
      $dd = 0;
    }
    if($dd === 0){
      this.ctx.p(24 /* RecMutual1 2 */, () => this.ruleRecMutual2());
    } else if($dd === 1){
      this.$e(2 /*#string:B*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecMutual2() {
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 2 /*#string:B*/){
      $dd = 0;
    } else { //$ll1 === 3 /*#string:C*/
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    }
    if($dd === 0){
      this.ctx.p(25 /* RecMutual2 2 */, () => this.ruleRecMutual1());
    } else if($dd === 1){
      this.$e(3 /*#string:C*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleUsesEmpty() {
    let $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1); $ll2 = this.$ll(2); 
    if(($ll1 === 1 /*#string:A*/ && $ll2 === 2 /*#string:B*/)){
      this.ctx.p(26 /* UsesEmpty 2 */, () => this.ruleEmpty());
      this.$e(1 /*#string:A*/);
      this.ctx.p(27 /* UsesEmpty 4 */, () => this.ruleEmpty());
      this.$e(2 /*#string:B*/);
    } else if(($ll1 === 1 /*#string:A*/ && $ll2 === 3 /*#string:C*/)){
      this.$e(1 /*#string:A*/);
      this.$e(3 /*#string:C*/);
    } else {
      this.$err();
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
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    switch(this.$ll(1)){
      case 1 /*#string:A*/:
      case 2 /*#string:B*/:
        // epsilon
        break;
      case 0 /*#string:O*/:
        this.$e(0 /*#string:O*/);
        break;
      default:
        this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleTrickyAfterEmpty() {
    let $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1); $ll2 = this.$ll(2); 
    if(($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || ($ll1 === 0 /*#string:O*/ && $ll2 === 1 /*#string:A*/) || ($ll1 === 0 /*#string:O*/ && $ll2 === 2 /*#string:B*/))){
      this.ctx.p(28 /* TrickyAfterEmpty 2 */, () => this.ruleEmptyOrNot());
      this.ctx.p(29 /* TrickyAfterEmpty 6 */, () => this.ruleTricky1());
    } else if(($ll1 === 0 /*#string:O*/ && $ll2 === 11 /*#string:P*/)){
      this.$e(0 /*#string:O*/);
      this.$e(11 /*#string:P*/);
    } else {
      this.$err();
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
