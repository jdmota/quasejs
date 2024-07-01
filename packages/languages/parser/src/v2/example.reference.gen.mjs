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
      "12": "#string:W",
      "13": "W",
      "14": "TY",
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
        "c": []
      },
      "13": {
        "s": false,
        "c": [
          "channel1"
        ]
      },
      "14": {
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
    let $dd, $ll1, $startMarker, $startPos=null, id=null, token=null, $0_t=null, $1_t=null, $2_t=null, $3_t=null, $4_t=null, $5_t=null, $6_t=null, $7_t=null, $8_t=null, $9_t=null, $10_t=null, $11_t=null, $12_t=null, $13_text=null, $14_num=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === -1 /*-1*/){
      throw new Error("Ambiguity");
      $dd = 1;
      //Ambiguity
      $dd = 2;
    } else { //$ll1 === 60 /*'<'*/ || $ll1 === 65 /*'A'*/ || $ll1 === 66 /*'B'*/ || $ll1 === 67 /*'C'*/ || $ll1 === 68 /*'D'*/ || $ll1 === 69 /*'E'*/ || $ll1 === 70 /*'F'*/ || $ll1 === 79 /*'O'*/ || $ll1 === 80 /*'P'*/ || $ll1 === 83 /*'S'*/ || $ll1 === 87 /*'W'*/ || $ll1 === 97 /*'a'*/
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    }
    if($dd === 0){
      $startMarker = this.$startText();
      switch(this.$ll(1)){
        case 60 /*'<'*/:
          this.$e(60 /*'<'*/);
          this.$e(60 /*'<'*/);
          $ll1 = this.$ll(1);
          if($ll1 === -1 /*-1*/ || $ll1 === 65 /*'A'*/ || $ll1 === 66 /*'B'*/ || $ll1 === 67 /*'C'*/ || $ll1 === 68 /*'D'*/ || $ll1 === 69 /*'E'*/ || $ll1 === 70 /*'F'*/ || $ll1 === 79 /*'O'*/ || $ll1 === 80 /*'P'*/ || $ll1 === 83 /*'S'*/ || $ll1 === 87 /*'W'*/ || $ll1 === 97 /*'a'*/){
            $dd = 0;
          } else { //$ll1 === 60 /*'<'*/
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
          }
          if($dd === 0){
            $9_t = this.$endText($startMarker);
            id = 9;
            token = $9_t;
          } else if($dd === 1){
            this.$e(60 /*'<'*/);
            $8_t = this.$endText($startMarker);
            id = 8;
            token = $8_t;
          } else {
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
          $ll1 = this.$ll(1);
          { //$ll1 === -1 /*-1*/ || $ll1 === 60 /*'<'*/ || $ll1 === 65 /*'A'*/ || $ll1 === 66 /*'B'*/ || $ll1 === 67 /*'C'*/ || $ll1 === 68 /*'D'*/ || $ll1 === 69 /*'E'*/ || $ll1 === 70 /*'F'*/ || $ll1 === 79 /*'O'*/ || $ll1 === 80 /*'P'*/ || $ll1 === 83 /*'S'*/ || $ll1 === 87 /*'W'*/ || $ll1 === 97 /*'a'*/
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
          }
          if($dd === 0){
            $12_t = this.$endText($startMarker);
            id = 12;
            token = $12_t;
          } else if($dd === 1){
            $13_text = this.$endText($startMarker);
            id = 13;
            token = $13_text;
          } else {
            this.$err();
          }
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
    } else if($dd === 1){
      $14_num = 10;
      id = 14;
      token = $14_num;
    } else if($dd === 2){
      this.$e(-1 /*-1*/);
      id = -1;
      token = null;
    } else {
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
  token$12() {
    let $startMarker, t=null;
    $startMarker = this.$startText();
    this.$e(87 /*'W'*/);
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
    $$ret = this.ctx.p(0 /* $$START$$ 3 */, () => this.ruleA(arg));
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
              if(true){
                throw new Error("Left recursion");
                $dd = 2;
              }
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
            B = this.ctx.p(1 /* A 13 */, () => this.ruleB());
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
        $ll1 = this.$ll(1);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
        }
        if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
          $dd = 0;
        } else if($ll1 === 0 /*#string:O*/){
          $dd = 2;
        } else if($ll1 === 4 /*#string:D*/){
          $dd = 1;
        } else { //$ll1 === 6 /*#string:F*/
          $dd = 3;
        }
        if($dd === 0){
          break s7;
        } else if($dd === 1){
          D.push(this.$e(4 /*#string:D*/));
          this.$e(5 /*#string:E*/);
          continue;
        } else if($dd === 2){
          break;
        } else if($dd === 3){
          while(1){
            this.$e(6 /*#string:F*/);
            $ll1 = this.$ll(1);
            if(true){
              throw new Error("Left recursion");
              $dd = 0;
            }
            if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
              $dd = 0;
            } else if($ll1 === 0 /*#string:O*/){
              $dd = 1;
            } else { //$ll1 === 6 /*#string:F*/
              $dd = 2;
            }
            if($dd === 0){
              break s7;
            } else if($dd === 1){
              break l1;
            } else if($dd === 2){
              continue;
            } else {
              this.$err();
            }
          }
        } else {
          this.$err();
        }
      }
      this.$e(0 /*#string:O*/);
    }while(0);
    my_obj = {id: 10};
    C = this.ctx.p(2 /* A 8 */, () => this.ruleC(10, 20));
    T = this.ctx.p(3 /* A 9 */, () => this.ruleTricky2());
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
    let $dd, $ll1, $startPos=null, text=null, ret=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      $dd = 0;
    } else { //$ll1 === 7 /*#string:STRING*/
      $dd = 1;
    }
    if($dd === 0){
      ret = {x: y, y: x};
    } else if($dd === 1){
      text = this.$e(7 /*#string:STRING*/);
      ret = {x, y};
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {ret, text, $loc};
  }
  ruleparent() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(4 /* parent 3 */, () => this.rulechild());
    while(1){
      switch(this.$ll(1)){
        case -1 /*#eof*/:
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
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    while(1){
      $ll1 = this.$ll(1);
      if($ll1 === -1 /*#eof*/){
        $dd = 0;
      } else { //$ll1 === 1 /*#string:A*/
        $ll2 = this.$ll(2);
        if($ll2 === -1 /*#eof*/){
          $ll3 = this.$ll(3);
          { //$ll3 === -1 /*#eof*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 4 /* parent 3 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              }
            }
          }
        } else { //$ll2 === 1 /*#string:A*/
          $ll3 = this.$ll(3);
          { //$ll3 === -1 /*#eof*/ || $ll3 === 1 /*#string:A*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 4 /* parent 3 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
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
    w = this.$e(13 /*W*/);
    this.ctx.p(5 /* F 5 */, () => this.ruleH(10));
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
      case -1 /*#eof*/:
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
      if(true){
        throw new Error("Left recursion");
        $dd = 0;
        //Ambiguity
        $dd = 2;
      }
      if($ll1 === -1 /*#eof*/){
        $ll2 = this.$ll(2);
        { //$ll2 === -1 /*#eof*/
          $ll3 = this.$ll(3);
          { //$ll3 === -1 /*#eof*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 0;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  $dd = 0;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  $dd = 0;
                }
              }
            }
          }
        }
      } else if($ll1 === 1 /*#string:A*/){
        $ll2 = this.$ll(2);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
          //Ambiguity
          $dd = 1;
          //Ambiguity
          $dd = 2;
        }
        if($ll2 === -1 /*#eof*/){
          $ll3 = this.$ll(3);
          { //$ll3 === -1 /*#eof*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              }
            }
          }
        } else if($ll2 === 1 /*#string:A*/){
          $ll3 = this.$ll(3);
          if(true){
            throw new Error("Left recursion");
            $dd = 0;
            //Ambiguity
            $dd = 1;
            //Ambiguity
            $dd = 2;
          }
          if($ll3 === -1 /*#eof*/){
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              }
            }
          } else { //$ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */ || $ff1 === 8 /* Tricky1 11 */ || $ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1 || $ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */ || $ff2 === 8 /* Tricky1 11 */ || $ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
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
        } else { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          if($ll3 === -1 /*#eof*/){
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 8 /* Tricky1 11 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              } else if($ff2 === 8 /* Tricky1 11 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              }
            } else if($ff1 === 8 /* Tricky1 11 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              }
            }
          } else { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === -1 || $ff2 === 29 /* TrickyAfterEmpty 4 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 2;
                }
              } else if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1 || $ff3 === 29 /* TrickyAfterEmpty 4 */){
                  $dd = 2;
                } else { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              } else { //$ff2 === 8 /* Tricky1 11 */
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 2;
                }
              }
            } else if($ff1 === 8 /* Tricky1 11 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === -1 || $ff2 === 8 /* Tricky1 11 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 2;
                }
              } else if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1 || $ff3 === 29 /* TrickyAfterEmpty 4 */){
                  $dd = 2;
                } else { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 2;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1 || $ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */ || $ff2 === 8 /* Tricky1 11 */ || $ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 2;
                }
              }
            }
          }
        }
      } else { //$ll1 === 2 /*#string:B*/
        $ll2 = this.$ll(2);
        if($ll2 === -1 /*#eof*/){
          $ll3 = this.$ll(3);
          { //$ll3 === -1 /*#eof*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 8 /* Tricky1 11 */
                  $dd = 0;
                }
              } else if($ff2 === 8 /* Tricky1 11 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 0;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              }
            } else if($ff1 === 8 /* Tricky1 11 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 0;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  $dd = 0;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              }
            }
          }
        } else { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          if($ll3 === -1 /*#eof*/){
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 2;
                }
              } else if($ff2 === 8 /* Tricky1 11 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 8 /* Tricky1 11 */
                  $dd = 0;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  $dd = 2;
                }
              }
            } else if($ff1 === 8 /* Tricky1 11 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 8 /* Tricky1 11 */
                  $dd = 0;
                }
              } else if($ff2 === 8 /* Tricky1 11 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                  $dd = 0;
                }
              } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              }
            } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
              $ff2 = this.ctx.ff(2);
              { //$ff2 === -1
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  $dd = 2;
                }
              }
            }
          } else { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
              $ff2 = this.ctx.ff(2);
              if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              } else { //$ff2 === 8 /* Tricky1 11 */
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1){
                  $dd = 2;
                } else { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              }
            } else { //$ff1 === 8 /* Tricky1 11 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === -1){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === -1
                  $dd = 2;
                }
              } else if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                $ff3 = this.ctx.ff(3);
                { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              } else { //$ff2 === 8 /* Tricky1 11 */
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                } else { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                  $dd = 0;
                }
              }
            }
          }
        }
      }
      if($dd === 0){
        1;
        $ll1 = this.$ll(1);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
        }
        if($ll1 === -1 /*#eof*/){
          $ll2 = this.$ll(2);
          { //$ll2 === -1 /*#eof*/
            $ll3 = this.$ll(3);
            { //$ll3 === -1 /*#eof*/
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                }
              } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
                $ff2 = this.ctx.ff(2);
                { //$ff2 === -1
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                }
              }
            }
          }
        } else if($ll1 === 1 /*#string:A*/){
          $ll2 = this.$ll(2);
          if(true){
            throw new Error("Left recursion");
            $dd = 0;
          }
          if($ll2 === -1 /*#eof*/){
            $ll3 = this.$ll(3);
            { //$ll3 === -1 /*#eof*/
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
                $ff2 = this.ctx.ff(2);
                { //$ff2 === -1
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              }
            }
          } else if($ll2 === 1 /*#string:A*/){
            $ll3 = this.$ll(3);
            if(true){
              throw new Error("Left recursion");
              $dd = 0;
            }
            if($ll3 === -1 /*#eof*/){
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
                $ff2 = this.ctx.ff(2);
                { //$ff2 === -1
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              }
            } else { //$ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/
              $ff1 = this.ctx.ff(1);
              { //$ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */ || $ff1 === 8 /* Tricky1 11 */ || $ff1 === 29 /* TrickyAfterEmpty 4 */
                $ff2 = this.ctx.ff(2);
                { //$ff2 === -1 || $ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */ || $ff2 === 8 /* Tricky1 11 */ || $ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                }
              }
            }
          } else { //$ll2 === 2 /*#string:B*/
            $ll3 = this.$ll(3);
            if($ll3 === -1 /*#eof*/){
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else if($ff2 === 8 /* Tricky1 11 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              } else if($ff1 === 8 /* Tricky1 11 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
                $ff2 = this.ctx.ff(2);
                { //$ff2 === -1
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              }
            } else { //$ll3 === 2 /*#string:B*/
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                    $dd = 0;
                  }
                } else { //$ff2 === 8 /* Tricky1 11 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1 || $ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                    $dd = 0;
                  }
                }
              } else { //$ff1 === 8 /* Tricky1 11 */
                $ff2 = this.ctx.ff(2);
                if($ff2 === -1 || $ff2 === 8 /* Tricky1 11 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                } else { //$ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                    $dd = 0;
                  }
                }
              }
            }
          }
        } else { //$ll1 === 2 /*#string:B*/
          $ll2 = this.$ll(2);
          if($ll2 === -1 /*#eof*/){
            $ll3 = this.$ll(3);
            { //$ll3 === -1 /*#eof*/
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */){
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  } else { //$ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else if($ff2 === 8 /* Tricky1 11 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              } else if($ff1 === 8 /* Tricky1 11 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                }
              } else { //$ff1 === 29 /* TrickyAfterEmpty 4 */
                $ff2 = this.ctx.ff(2);
                { //$ff2 === -1
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              }
            }
          } else { //$ll2 === 2 /*#string:B*/
            $ll3 = this.$ll(3);
            if($ll3 === -1 /*#eof*/){
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                } else { //$ff2 === 8 /* Tricky1 11 */
                  $ff3 = this.ctx.ff(3);
                  if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */){
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  } else { //$ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                }
              } else { //$ff1 === 8 /* Tricky1 11 */
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  if($ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */){
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  } else { //$ff3 === 29 /* TrickyAfterEmpty 4 */
                    $dd = 0;
                  }
                } else if($ff2 === 8 /* Tricky1 11 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 29 /* TrickyAfterEmpty 4 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                } else { //$ff2 === 29 /* TrickyAfterEmpty 4 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === -1
                    $dd = 0;
                  }
                }
              }
            } else { //$ll3 === 2 /*#string:B*/
              $ff1 = this.ctx.ff(1);
              if($ff1 === 6 /* Tricky1 4 */ || $ff1 === 7 /* Tricky1 9 */){
                $ff2 = this.ctx.ff(2);
                { //$ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */ || $ff2 === 8 /* Tricky1 11 */
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                }
              } else { //$ff1 === 8 /* Tricky1 11 */
                $ff2 = this.ctx.ff(2);
                if($ff2 === 6 /* Tricky1 4 */ || $ff2 === 7 /* Tricky1 9 */){
                  $ff3 = this.ctx.ff(3);
                  { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
                    throw new Error("Ambiguity");
                    $dd = 0;
                    //Ambiguity
                    $dd = 1;
                  }
                } else { //$ff2 === 8 /* Tricky1 11 */
                  $ff3 = this.ctx.ff(3);
                  if($ff3 === -1){
                    $dd = 0;
                  } else { //$ff3 === 6 /* Tricky1 4 */ || $ff3 === 7 /* Tricky1 9 */ || $ff3 === 8 /* Tricky1 11 */
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
          this.ctx.p(6 /* Tricky1 4 */, () => this.ruleTricky1());
        } else if($dd === 1){
          // epsilon
        } else {
          this.$err();
        }
      } else if($dd === 1){
        2;
        this.$e(1 /*#string:A*/);
        this.ctx.p(7 /* Tricky1 9 */, () => this.ruleTricky1());
        20;
        break;
      } else if($dd === 2){
        3;
        this.ctx.p(8 /* Tricky1 11 */, () => this.ruleTricky1());
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
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === -1 /*#eof*/){
      $dd = 1;
    } else if($ll1 === 1 /*#string:A*/){
      $ll2 = this.$ll(2);
      if(true){
        throw new Error("Left recursion");
        $dd = 0;
        //Ambiguity
        $dd = 2;
      }
      if($ll2 === -1 /*#eof*/){
        $dd = 2;
      } else if($ll2 === 1 /*#string:A*/){
        $ll3 = this.$ll(3);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
          //Ambiguity
          $dd = 2;
        }
        if($ll3 === -1 /*#eof*/){
          $dd = 2;
        } else if($ll3 === 1 /*#string:A*/){
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 3 /* A 9 */ || $ff1 === 9 /* Tricky2 3 */ || $ff1 === 10 /* Tricky2 4 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 0 /* $$START$$ 3 */ || $ff2 === 3 /* A 9 */ || $ff2 === 9 /* Tricky2 3 */ || $ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1 || $ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */ || $ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          }
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 9 */ || $ff1 === 10 /* Tricky2 4 */){
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 0 /* $$START$$ 3 */ || $ff2 === 3 /* A 9 */ || $ff2 === 9 /* Tricky2 3 */ || $ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1 || $ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */ || $ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          } else { //$ff1 === 9 /* Tricky2 3 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 2;
            } else { //$ff2 === 0 /* $$START$$ 3 */ || $ff2 === 3 /* A 9 */ || $ff2 === 9 /* Tricky2 3 */ || $ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1 || $ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */ || $ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          }
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 9 */){
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 0 /* $$START$$ 3 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          } else if($ff1 === 9 /* Tricky2 3 */){
            $dd = 2;
          } else { //$ff1 === 10 /* Tricky2 4 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 9 */){
              $ff3 = this.ctx.ff(3);
              { //$ff3 === 0 /* $$START$$ 3 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            } else if($ff2 === 9 /* Tricky2 3 */){
              $dd = 2;
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 9 */ || $ff3 === 10 /* Tricky2 4 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff3 === 9 /* Tricky2 3 */
                $dd = 2;
              }
            }
          }
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 9 */){
            $dd = 0;
          } else if($ff1 === 9 /* Tricky2 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            } else if($ff2 === 0 /* $$START$$ 3 */ || $ff2 === 3 /* A 9 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 3 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */ || $ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                $dd = 0;
              }
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1 || $ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          } else { //$ff1 === 10 /* Tricky2 4 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 0 /* $$START$$ 3 */ || $ff2 === 3 /* A 9 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 3 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1 || $ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */
                $dd = 0;
              }
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1 || $ff3 === 0 /* $$START$$ 3 */ || $ff3 === 3 /* A 9 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          }
        }
      }
    } else { //$ll1 === 2 /*#string:B*/
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/){
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 9 */){
            $dd = 0;
          } else if($ff1 === 9 /* Tricky2 3 */){
            $dd = 1;
          } else { //$ff1 === 10 /* Tricky2 4 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 9 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 3 */){
              $dd = 1;
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 9 */){
                $dd = 0;
              } else if($ff3 === 9 /* Tricky2 3 */){
                $dd = 1;
              } else { //$ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          $ff1 = this.ctx.ff(1);
          if($ff1 === 3 /* A 9 */){
            $dd = 0;
          } else if($ff1 === 9 /* Tricky2 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 9 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 3 */){
              $dd = 1;
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 9 */){
                $dd = 0;
              } else if($ff3 === 9 /* Tricky2 3 */){
                $dd = 1;
              } else { //$ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          } else { //$ff1 === 10 /* Tricky2 4 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 3 /* A 9 */){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 3 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 9 */){
                $dd = 0;
              } else if($ff3 === 9 /* Tricky2 3 */){
                $dd = 1;
              } else { //$ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === 3 /* A 9 */){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 9 /* Tricky2 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 0;
            } else if($ff2 === 9 /* Tricky2 3 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                $dd = 1;
              }
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          } else { //$ff1 === 10 /* Tricky2 4 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === 9 /* Tricky2 3 */){
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                $dd = 0;
              } else { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            } else { //$ff2 === 10 /* Tricky2 4 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === 9 /* Tricky2 3 */ || $ff3 === 10 /* Tricky2 4 */
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
      z = this.ctx.p(9 /* Tricky2 3 */, () => this.ruleTricky2());
      this.$e(2 /*#string:B*/);
    } else if($dd === 1){
      // epsilon
    } else if($dd === 2){
      this.$e(1 /*#string:A*/);
      y = this.ctx.p(10 /* Tricky2 4 */, () => this.ruleTricky2());
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
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    }
    if($ll1 === 1 /*#string:A*/){
      $ll2 = this.$ll(2);
      if(true){
        throw new Error("Left recursion");
        $dd = 0;
        //Ambiguity
        $dd = 1;
        //Ambiguity
        $dd = 3;
      }
      if($ll2 === 1 /*#string:A*/){
        $ll3 = this.$ll(3);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
          //Ambiguity
          $dd = 1;
          //Ambiguity
          $dd = 3;
        }
        if($ll3 === 1 /*#string:A*/){
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
          //Ambiguity
          $dd = 3;
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 11 /* Tricky3 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 11 /* Tricky3 3 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 3;
            } else { //$ff2 === 12 /* Tricky3 5 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 3;
              } else { //$ff3 === 11 /* Tricky3 3 */ || $ff3 === 12 /* Tricky3 5 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 3;
              }
            }
          } else { //$ff1 === 12 /* Tricky3 5 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 3;
            } else { //$ff2 === 11 /* Tricky3 3 */ || $ff2 === 12 /* Tricky3 5 */
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 3;
            }
          }
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 11 /* Tricky3 3 */){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
            //Ambiguity
            $dd = 3;
          } else { //$ff1 === 12 /* Tricky3 5 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1 || $ff2 === 11 /* Tricky3 3 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 3;
            } else { //$ff2 === 12 /* Tricky3 5 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 3;
              } else { //$ff3 === 11 /* Tricky3 3 */ || $ff3 === 12 /* Tricky3 5 */
                $dd = 1;
              }
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
          if($ff1 === 11 /* Tricky3 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === 11 /* Tricky3 3 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 2;
            } else { //$ff2 === 12 /* Tricky3 5 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                $dd = 1;
              } else { //$ff3 === 11 /* Tricky3 3 */ || $ff3 === 12 /* Tricky3 5 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              }
            }
          } else { //$ff1 === 12 /* Tricky3 5 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 1;
            } else if($ff2 === 11 /* Tricky3 3 */){
              throw new Error("Ambiguity");
              $dd = 0;
              //Ambiguity
              $dd = 1;
              //Ambiguity
              $dd = 2;
            } else { //$ff2 === 12 /* Tricky3 5 */
              $ff3 = this.ctx.ff(3);
              if($ff3 === -1){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              } else { //$ff3 === 11 /* Tricky3 3 */ || $ff3 === 12 /* Tricky3 5 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              }
            }
          }
        }
      }
    }
    if($dd === 0){
      x = this.ctx.p(11 /* Tricky3 3 */, () => this.ruleTricky3(10));
    } else if($dd === 1){
      z = this.ctx.p(12 /* Tricky3 5 */, () => this.ruleTricky3(30));
      this.$e(2 /*#string:B*/);
    } else if($dd === 2){
      // epsilon
    } else if($dd === 3){
      this.$e(1 /*#string:A*/);
      y = this.ctx.p(11 /* Tricky3 3 */, () => this.ruleTricky3(20));
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
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === -1 /*#eof*/){
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/){
        $ll3 = this.$ll(3);
        if($ll3 === -1 /*#eof*/){
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 13 /* Tricky4 3 */ || $ff1 === 14 /* Tricky4 6 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 0;
            } else { //$ff2 === 13 /* Tricky4 3 */ || $ff2 === 14 /* Tricky4 6 */
              $dd = 1;
            }
          }
        } else { //$ll3 === 2 /*#string:B*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 13 /* Tricky4 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 0;
            } else { //$ff2 === 13 /* Tricky4 3 */
              $dd = 1;
            }
          } else { //$ff1 === 14 /* Tricky4 6 */
            $dd = 1;
          }
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 13 /* Tricky4 3 */){
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 1;
            } else { //$ff2 === 13 /* Tricky4 3 */ || $ff2 === 14 /* Tricky4 6 */
              $dd = 0;
            }
          } else { //$ff1 === 14 /* Tricky4 6 */
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
      this.ctx.p(13 /* Tricky4 3 */, () => this.ruleTricky4());
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
      this.ctx.p(14 /* Tricky4 6 */, () => this.ruleTricky4());
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
    y = this.$e(14 /*TY*/);
    $loc = this.$getLoc($startPos);
    return y;
  }
  ruleRec1() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(15 /* Rec1 3 */, () => this.ruleRec1());
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec2() {
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($dd === 0){
      this.ctx.p(16 /* Rec2 3 */, () => this.ruleRec2());
    } else if($dd === 1){
      // epsilon
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec3() {
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    { //$ll1 === 1 /*#string:A*/
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    }
    if($dd === 0){
      this.ctx.p(17 /* Rec3 3 */, () => this.ruleRec3());
    } else if($dd === 1){
      this.$e(1 /*#string:A*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRec4() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    { //$ll1 === 2 /*#string:B*/
      $ll2 = this.$ll(2);
      { //$ll2 === 1 /*#string:A*/
        $ll3 = this.$ll(3);
        { //$ll3 === 1 /*#string:A*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 18 /* Rec4 3 */
            $ff2 = this.ctx.ff(2);
            if($ff2 === -1){
              $dd = 0;
            } else { //$ff2 === 18 /* Rec4 3 */
              $dd = 1;
            }
          }
        }
      }
    }
    if($dd === 0){
      this.ctx.p(18 /* Rec4 3 */, () => this.ruleRec4());
      this.$e(1 /*#string:A*/);
    } else if($dd === 1){
      this.$e(2 /*#string:B*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return 10;
  }
  ruleRecTricky1() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    do{
      $ll1 = this.$ll(1);
      if(true){
        throw new Error("Left recursion");
        $dd = 0;
        //Ambiguity
        $dd = 2;
      }
      if($ll1 === -1 /*#eof*/){
        $dd = 0;
      } else if($ll1 === 1 /*#string:A*/){
        $ll2 = this.$ll(2);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
          //Ambiguity
          $dd = 1;
          //Ambiguity
          $dd = 2;
        }
        if($ll2 === -1 /*#eof*/){
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
        } else if($ll2 === 1 /*#string:A*/){
          $ll3 = this.$ll(3);
          if(true){
            throw new Error("Left recursion");
            $dd = 0;
            //Ambiguity
            $dd = 1;
            //Ambiguity
            $dd = 2;
          }
          if($ll3 === -1 /*#eof*/){
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
          } else { //$ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
            //Ambiguity
            $dd = 2;
          }
        } else { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          if($ll3 === -1 /*#eof*/){
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 22 /* RecTricky2 3 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 19 /* RecTricky1 4 */ || $ff2 === 20 /* RecTricky1 9 */ || $ff2 === 23 /* RecTricky3 3 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 21 /* RecTricky1 11 */
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          } else { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 22 /* RecTricky2 3 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 19 /* RecTricky1 4 */ || $ff2 === 20 /* RecTricky1 9 */){
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1){
                  $dd = 2;
                } else { //$ff3 === 22 /* RecTricky2 3 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                  //Ambiguity
                  $dd = 2;
                }
              } else if($ff2 === 21 /* RecTricky1 11 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 23 /* RecTricky3 3 */
                $dd = 2;
              }
            }
          }
        }
      } else { //$ll1 === 2 /*#string:B*/
        $ll2 = this.$ll(2);
        if($ll2 === -1 /*#eof*/){
          $ll3 = this.$ll(3);
          { //$ll3 === -1 /*#eof*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 22 /* RecTricky2 3 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 19 /* RecTricky1 4 */ || $ff2 === 20 /* RecTricky1 9 */ || $ff2 === 23 /* RecTricky3 3 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 21 /* RecTricky1 11 */
                $dd = 0;
              }
            }
          }
        } else { //$ll2 === 2 /*#string:B*/
          $ll3 = this.$ll(3);
          if($ll3 === -1 /*#eof*/){
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 22 /* RecTricky2 3 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 19 /* RecTricky1 4 */ || $ff2 === 20 /* RecTricky1 9 */ || $ff2 === 21 /* RecTricky1 11 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 23 /* RecTricky3 3 */
                $dd = 2;
              }
            }
          } else { //$ll3 === 2 /*#string:B*/
            $ff1 = this.ctx.ff(1);
            { //$ff1 === 22 /* RecTricky2 3 */
              $ff2 = this.ctx.ff(2);
              if($ff2 === 19 /* RecTricky1 4 */ || $ff2 === 20 /* RecTricky1 9 */){
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 2;
              } else { //$ff2 === 21 /* RecTricky1 11 */
                $ff3 = this.ctx.ff(3);
                if($ff3 === -1){
                  $dd = 2;
                } else { //$ff3 === 22 /* RecTricky2 3 */
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 2;
                }
              }
            }
          }
        }
      }
      if($dd === 0){
        1;
        $ll1 = this.$ll(1);
        if(true){
          throw new Error("Left recursion");
          $dd = 0;
        }
        if($ll1 === -1 /*#eof*/){
          throw new Error("Ambiguity");
          $dd = 0;
          //Ambiguity
          $dd = 1;
        } else if($ll1 === 1 /*#string:A*/){
          $dd = 0;
        } else { //$ll1 === 2 /*#string:B*/
          $ll2 = this.$ll(2);
          if($ll2 === -1 /*#eof*/){
            $ll3 = this.$ll(3);
            { //$ll3 === -1 /*#eof*/
              $ff1 = this.ctx.ff(1);
              { //$ff1 === 22 /* RecTricky2 3 */
                $ff2 = this.ctx.ff(2);
                if($ff2 === 19 /* RecTricky1 4 */ || $ff2 === 20 /* RecTricky1 9 */ || $ff2 === 21 /* RecTricky1 11 */){
                  throw new Error("Ambiguity");
                  $dd = 0;
                  //Ambiguity
                  $dd = 1;
                } else { //$ff2 === 23 /* RecTricky3 3 */
                  $dd = 0;
                }
              }
            }
          } else { //$ll2 === 2 /*#string:B*/
            throw new Error("Ambiguity");
            $dd = 0;
            //Ambiguity
            $dd = 1;
          }
        }
        if($dd === 0){
          this.ctx.p(19 /* RecTricky1 4 */, () => this.ruleRecTricky2());
        } else if($dd === 1){
          // epsilon
        } else {
          this.$err();
        }
      } else if($dd === 1){
        2;
        this.$e(1 /*#string:A*/);
        this.ctx.p(20 /* RecTricky1 9 */, () => this.ruleRecTricky2());
        20;
        break;
      } else if($dd === 2){
        3;
        this.ctx.p(21 /* RecTricky1 11 */, () => this.ruleRecTricky2());
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
    this.ctx.p(22 /* RecTricky2 3 */, () => this.ruleRecTricky1());
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecTricky3() {
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      $dd = 0;
    } else { //$ll1 === 3 /*#string:C*/
      $dd = 1;
    }
    if($dd === 0){
      this.ctx.p(23 /* RecTricky3 3 */, () => this.ruleRecTricky2());
    } else if($dd === 1){
      this.$e(3 /*#string:C*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleRecMutual1() {
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === 2 /*#string:B*/){
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    } else { //$ll1 === 3 /*#string:C*/
      $dd = 0;
    }
    if($dd === 0){
      this.ctx.p(24 /* RecMutual1 3 */, () => this.ruleRecMutual2());
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
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === 2 /*#string:B*/){
      $dd = 0;
    } else { //$ll1 === 3 /*#string:C*/
      throw new Error("Ambiguity");
      $dd = 0;
      //Ambiguity
      $dd = 1;
    }
    if($dd === 0){
      this.ctx.p(25 /* RecMutual2 3 */, () => this.ruleRecMutual1());
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
      this.ctx.p(26 /* UsesEmpty 3 */, () => this.ruleEmpty());
      this.$e(1 /*#string:A*/);
      this.ctx.p(27 /* UsesEmpty 5 */, () => this.ruleEmpty());
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
    let $dd, $ll1, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      $dd = 0;
    } else { //$ll1 === 0 /*#string:O*/
      $dd = 1;
    }
    if($dd === 0){
      // epsilon
    } else if($dd === 1){
      this.$e(0 /*#string:O*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleTrickyAfterEmpty() {
    let $dd, $ll1, $ll2, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if(true){
      throw new Error("Left recursion");
      $dd = 0;
    }
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      $dd = 0;
    } else { //$ll1 === 0 /*#string:O*/
      $ll2 = this.$ll(2);
      if(true){
        throw new Error("Left recursion");
        $dd = 0;
      }
      if($ll2 === -1 /*#eof*/ || $ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
        $dd = 0;
      } else { //$ll2 === 11 /*#string:P*/
        $dd = 1;
      }
    }
    if($dd === 0){
      this.ctx.p(28 /* TrickyAfterEmpty 6 */, () => this.ruleEmptyOrNot());
      this.ctx.p(29 /* TrickyAfterEmpty 4 */, () => this.ruleTricky1());
    } else if($dd === 1){
      this.$e(0 /*#string:O*/);
      this.$e(11 /*#string:P*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLL1() {
    let $ff1, $ff2, $ff3, $ll1, $ll2, $ll3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
     $ff1 = this.$ff(1); $ff2 = this.$ff(2); $ff3 = this.$ff(3);
    if(($ll1 === 1 /*#string:A*/ && $ll2 === 0 /*#string:O*/ && $ll3 === 12 /*#string:W*/ && $ff1 === -1 && $ff2 === -1 && $ff3 === -1)){
      this.ctx.p(30 /* GLL1 3 */, () => this.ruleGLLAux1());
    } else if(($ll1 === 2 /*#string:B*/ && $ll2 === 3 /*#string:C*/ && $ll3 === 0 /*#string:O*/ && $ff1 === -1 && $ff2 === -1 && $ff3 === -1)){
      this.ctx.p(30 /* GLL1 3 */, () => this.ruleGLLAux2());
    } else {
      this.$err();
    }
    this.$e(0 /*#string:O*/);
    this.$e(12 /*#string:W*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLLAux1() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.$e(1 /*#string:A*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLLAux2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.$e(2 /*#string:B*/);
    this.$e(3 /*#string:C*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLL1Follow() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    { //$ll1 === 1 /*#string:A*/
      $ll2 = this.$ll(2);
      { //$ll2 === 1 /*#string:A*/
        $ll3 = this.$ll(3);
        { //$ll3 === 0 /*#string:O*/ || $ll3 === 1 /*#string:A*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 32 /* GLL1FollowContext 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
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
      1;
    } else if($dd === 1){
      2;
    } else {
      this.$err();
    }
    this.ctx.p(31 /* GLL1Follow 4 */, () => this.ruleGLLAux1());
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLL1FollowContext() {
    let $ff1, $ff2, $ff3, $ll1, $ll2, $ll3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(32 /* GLL1FollowContext 3 */, () => this.ruleGLL1Follow());
    this.ctx.p(33 /* GLL1FollowContext 4 */, () => this.ruleGLLAux1());
     $ff1 = this.$ff(1); $ff2 = this.$ff(2); $ff3 = this.$ff(3);
    if(($ll1 === 1 /*#string:A*/ && $ll2 === 0 /*#string:O*/ && $ll3 === -1 /*#eof*/ && $ff1 === -1 && $ff2 === -1 && $ff3 === -1)){
      this.ctx.p(34 /* GLL1FollowContext 7 */, () => this.ruleGLLAux1());
    } else if(($ll1 === 0 /*#string:O*/ && $ll2 === -1 /*#eof*/ && $ll3 === -1 /*#eof*/ && $ff1 === -1 && $ff2 === -1 && $ff3 === -1)){
      // epsilon
    } else {
      this.$err();
    }
    this.$e(0 /*#string:O*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLL1Follow2() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 0 /*#string:O*/){
      $ll2 = this.$ll(2);
      { //$ll2 === -1 /*#eof*/
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 36 /* GLL1FollowContext2 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        }
      }
    } else { //$ll1 === 1 /*#string:A*/
      $ll2 = this.$ll(2);
      if($ll2 === 0 /*#string:O*/){
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 36 /* GLL1FollowContext2 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        }
      } else { //$ll2 === 1 /*#string:A*/
        $ll3 = this.$ll(3);
        { //$ll3 === 0 /*#string:O*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 36 /* GLL1FollowContext2 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                $dd = 0;
              }
            }
          }
        }
      }
    }
    if($dd === 0){
      1;
      this.ctx.p(35 /* GLL1Follow2 4 */, () => this.ruleGLLAuxOptional1());
    } else if($dd === 1){
      2;
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLL1FollowContext2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(36 /* GLL1FollowContext2 3 */, () => this.ruleGLL1Follow2());
    this.ctx.p(37 /* GLL1FollowContext2 4 */, () => this.ruleGLLAuxOptional1());
    this.$e(0 /*#string:O*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLLAuxOptional1() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    if($ll1 === 0 /*#string:O*/){
      $ll2 = this.$ll(2);
      { //$ll2 === -1 /*#eof*/
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 35 /* GLL1Follow2 4 */){
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 36 /* GLL1FollowContext2 3 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                $dd = 0;
              }
            }
          } else { //$ff1 === 37 /* GLL1FollowContext2 4 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                $dd = 0;
              }
            }
          }
        }
      }
    } else { //$ll1 === 1 /*#string:A*/
      $ll2 = this.$ll(2);
      if($ll2 === 0 /*#string:O*/){
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          if($ff1 === 35 /* GLL1Follow2 4 */){
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 36 /* GLL1FollowContext2 3 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          } else { //$ff1 === 37 /* GLL1FollowContext2 4 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                $dd = 1;
              }
            }
          }
        }
      } else { //$ll2 === 1 /*#string:A*/
        $ll3 = this.$ll(3);
        { //$ll3 === 0 /*#string:O*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 35 /* GLL1Follow2 4 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 36 /* GLL1FollowContext2 3 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                $dd = 1;
              }
            }
          }
        }
      }
    }
    if($dd === 0){
      // epsilon
    } else if($dd === 1){
      this.$e(1 /*#string:A*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  rulefollow3() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(38 /* follow3 3 */, () => this.rulefollow2());
    this.$e(1 /*#string:A*/);
    this.$e(1 /*#string:A*/);
    this.$e(1 /*#string:A*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  rulefollow2() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(39 /* follow2 3 */, () => this.rulefollow1());
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  rulefollow1() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(40 /* follow1 3 */, () => this.rulefollow0());
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  rulefollow0() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, a=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    { //$ll1 === 1 /*#string:A*/
      $ll2 = this.$ll(2);
      { //$ll2 === 1 /*#string:A*/
        $ll3 = this.$ll(3);
        { //$ll3 === 1 /*#string:A*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 40 /* follow1 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === 39 /* follow2 3 */
              $ff3 = this.ctx.ff(3);
              { //$ff3 === 38 /* follow3 3 */
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
      a = 0;
    } else if($dd === 1){
      a = 1;
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {a, $loc};
  }
  ruleend() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(41 /* end 3 */, () => this.ruleendAux());
    this.$e(1 /*#string:A*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  rulenotEnd() {
    let $startPos=null, $loc=null;
    $startPos = this.$getPos();
    this.ctx.p(42 /* notEnd 3 */, () => this.ruleendAux());
    this.$e(1 /*#string:A*/);
    this.$e(2 /*#string:B*/);
    this.$e(3 /*#string:C*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleendAux() {
    let $dd, $ll1, $ll2, $ll3, $ff1, $ff2, $ff3, $startPos=null, $loc=null;
    $startPos = this.$getPos();
    $ll1 = this.$ll(1);
    { //$ll1 === 1 /*#string:A*/
      $ll2 = this.$ll(2);
      if($ll2 === -1 /*#eof*/){
        $ll3 = this.$ll(3);
        { //$ll3 === -1 /*#eof*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 41 /* end 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
                throw new Error("Ambiguity");
                $dd = 0;
                //Ambiguity
                $dd = 1;
              }
            }
          }
        }
      } else { //$ll2 === 2 /*#string:B*/
        $ll3 = this.$ll(3);
        { //$ll3 === 3 /*#string:C*/
          $ff1 = this.ctx.ff(1);
          { //$ff1 === 42 /* notEnd 3 */
            $ff2 = this.ctx.ff(2);
            { //$ff2 === -1
              $ff3 = this.ctx.ff(3);
              { //$ff3 === -1
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
      1;
    } else if($dd === 1){
      2;
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
