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
  token$lexer_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*-1*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("$lexer",1,$env);
      this.gll.a("$lexer",2,$env);
      return;
    } else if($ll1 === 60 /*'<'*/ || $ll1 === 65 /*'A'*/ || $ll1 === 66 /*'B'*/ || $ll1 === 67 /*'C'*/ || $ll1 === 68 /*'D'*/ || $ll1 === 69 /*'E'*/ || $ll1 === 70 /*'F'*/ || $ll1 === 79 /*'O'*/ || $ll1 === 80 /*'P'*/ || $ll1 === 83 /*'S'*/ || $ll1 === 87 /*'W'*/ || $ll1 === 97 /*'a'*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("$lexer",3,$env);
      this.gll.a("$lexer",1,$env);
      return;
    } else {
      this.$err();
    }
  }
  token$lexer_1($env) {
    $env.$14_num = 10;
    $env.id = 14;
    $env.token = $env.$14_num;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$lexer_2($env) {
    this.$e(-1 /*-1*/);
    $env.id = -1;
    $env.token = null;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$lexer_3($env) {
    let $ll1;
    $env.$startMarker = this.$startText();
    do{
      if($ll1 === 60 /*'<'*/){
        this.$e(60 /*'<'*/);
        this.$e(60 /*'<'*/);
        if($ll1 === -1 /*-1*/ || $ll1 === 65 /*'A'*/ || $ll1 === 66 /*'B'*/ || $ll1 === 67 /*'C'*/ || $ll1 === 68 /*'D'*/ || $ll1 === 69 /*'E'*/ || $ll1 === 70 /*'F'*/ || $ll1 === 79 /*'O'*/ || $ll1 === 80 /*'P'*/ || $ll1 === 83 /*'S'*/ || $ll1 === 87 /*'W'*/ || $ll1 === 97 /*'a'*/){
          // epsilon
        } else if($ll1 === 60 /*'<'*/){
          // Ambiguity
          this.gll.u(this.$i(),$env);
          this.gll.a("$lexer",6,$env);
          this.gll.a("$lexer",7,$env);
          return;
        } else {
          this.$err();
        }
      } else if($ll1 === 65 /*'A'*/){
        this.$e(65 /*'A'*/);
        $env.$1_t = this.$endText($env.$startMarker);
        $env.id = 1;
        $env.token = $env.$1_t;
        break;
      } else if($ll1 === 66 /*'B'*/){
        this.$e(66 /*'B'*/);
        $env.$2_t = this.$endText($env.$startMarker);
        $env.id = 2;
        $env.token = $env.$2_t;
        break;
      } else if($ll1 === 67 /*'C'*/){
        this.$e(67 /*'C'*/);
        $env.$3_t = this.$endText($env.$startMarker);
        $env.id = 3;
        $env.token = $env.$3_t;
        break;
      } else if($ll1 === 68 /*'D'*/){
        this.$e(68 /*'D'*/);
        $env.$4_t = this.$endText($env.$startMarker);
        $env.id = 4;
        $env.token = $env.$4_t;
        break;
      } else if($ll1 === 69 /*'E'*/){
        this.$e(69 /*'E'*/);
        $env.$5_t = this.$endText($env.$startMarker);
        $env.id = 5;
        $env.token = $env.$5_t;
        break;
      } else if($ll1 === 70 /*'F'*/){
        this.$e(70 /*'F'*/);
        $env.$6_t = this.$endText($env.$startMarker);
        $env.id = 6;
        $env.token = $env.$6_t;
        break;
      } else if($ll1 === 79 /*'O'*/){
        this.$e(79 /*'O'*/);
        $env.$0_t = this.$endText($env.$startMarker);
        $env.id = 0;
        $env.token = $env.$0_t;
        break;
      } else if($ll1 === 80 /*'P'*/){
        this.$e(80 /*'P'*/);
        $env.$11_t = this.$endText($env.$startMarker);
        $env.id = 11;
        $env.token = $env.$11_t;
        break;
      } else if($ll1 === 83 /*'S'*/){
        this.$e(83 /*'S'*/);
        this.$e(84 /*'T'*/);
        this.$e(82 /*'R'*/);
        this.$e(73 /*'I'*/);
        this.$e(78 /*'N'*/);
        this.$e(71 /*'G'*/);
        $env.$7_t = this.$endText($env.$startMarker);
        $env.id = 7;
        $env.token = $env.$7_t;
        break;
      } else if($ll1 === 87 /*'W'*/){
        this.$e(87 /*'W'*/);
        if($ll1 === -1 /*-1*/ || $ll1 === 60 /*'<'*/ || $ll1 === 65 /*'A'*/ || $ll1 === 66 /*'B'*/ || $ll1 === 67 /*'C'*/ || $ll1 === 68 /*'D'*/ || $ll1 === 69 /*'E'*/ || $ll1 === 70 /*'F'*/ || $ll1 === 79 /*'O'*/ || $ll1 === 80 /*'P'*/ || $ll1 === 83 /*'S'*/ || $ll1 === 87 /*'W'*/ || $ll1 === 97 /*'a'*/){
          // Ambiguity
          this.gll.u(this.$i(),$env);
          this.gll.a("$lexer",4,$env);
          this.gll.a("$lexer",5,$env);
          return;
        } else {
          this.$err();
        }
      } else if($ll1 === 97 /*'a'*/){
        this.$e(97 /*'a'*/);
        $env.$10_t = this.$endText($env.$startMarker);
        $env.id = 10;
        $env.token = $env.$10_t;
        break;
      } else {
        this.$err();
      }
      $env.$9_t = this.$endText($env.$startMarker);
      $env.id = 9;
      $env.token = $env.$9_t;
    }while(0);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$lexer_4($env) {
    $env.$12_t = this.$endText($env.$startMarker);
    $env.id = 12;
    $env.token = $env.$12_t;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$lexer_5($env) {
    $env.$13_text = this.$endText($env.$startMarker);
    $env.id = 13;
    $env.token = $env.$13_text;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$lexer_6($env) {
    this.$e(60 /*'<'*/);
    $env.$8_t = this.$endText($env.$startMarker);
    $env.id = 8;
    $env.token = $env.$8_t;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$lexer_7($env) {
    $env.$9_t = this.$endText($env.$startMarker);
    $env.id = 9;
    $env.token = $env.$9_t;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({id:$env.id,token:$env.token,$loc:$env.$loc}));
  }
  token$_1_0() {
    this.$e(-1 /*-1*/);
    return null;
  }
  token$0_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(79 /*'O'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$1_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(65 /*'A'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$2_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(66 /*'B'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$3_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(67 /*'C'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$4_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(68 /*'D'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$5_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(69 /*'E'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$6_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(70 /*'F'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$7_0() {
    let t=null,$startMarker=null;
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
  token$8_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(60 /*'<'*/);
    this.$e(60 /*'<'*/);
    this.$e(60 /*'<'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$9_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(60 /*'<'*/);
    this.$e(60 /*'<'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$10_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(97 /*'a'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$11_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(80 /*'P'*/);
    t = this.$endText($startMarker);
    return t;
  }
  token$12_0() {
    let t=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(87 /*'W'*/);
    t = this.$endText($startMarker);
    return t;
  }
  tokenW_0() {
    let text=null,$startMarker=null;
    $startMarker = this.$startText();
    this.$e(87 /*'W'*/);
    text = this.$endText($startMarker);
    return text;
  }
  tokenTY_0() {
    let num=null;
    num = 10;
    return num;
  }
  $createEnv(name,args){
    if(name==="$lexer") return {$startPos:null,id:null,token:null,$0_t:null,$startMarker:null,$1_t:null,$2_t:null,$3_t:null,$4_t:null,$5_t:null,$6_t:null,$7_t:null,$8_t:null,$9_t:null,$10_t:null,$11_t:null,$12_t:null,$13_text:null,$14_num:null,$loc:null};
    throw new Error("Never");
  }
}

class GrammarParser extends Parser {
  rule$$START$$_0($env) {
    $env.$startPos = this.$getPos();
    $env.$$ret = (this.gll.u(this.$i(),$env), this.gll.c("$$START$$",1,"A",[$env.arg]));
    return;
  }
  rule$$START$$_1($env) {
    $env.$$ret = $env["#tmp"];
    this.$e(-1 /*#eof*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p($env.$$ret));
  }
  ruleA_0($env) {
    let $ll1,$ll3,$ll2;
    $env.$startPos = this.$getPos();
    s5:do{
      s2:do{
        do{
          if($ll1 === 0 /*#string:O*/){
            this.$e(0 /*#string:O*/);
            if($ll1 === 1 /*#string:A*/){
              break s2;
            } else if($ll1 === 2 /*#string:B*/){
              break;
            } else {
              this.$err();
            }
          } else if($ll1 === 1 /*#string:A*/){
            if($ll2 === 0 /*#string:O*/ || $ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
              // epsilon
            } else if($ll2 === 3 /*#string:C*/){
              if($ll3 === -1 /*#eof*/ || $ll3 === 0 /*#string:O*/ || $ll3 === 1 /*#string:A*/ || $ll3 === 2 /*#string:B*/ || $ll3 === 6 /*#string:F*/ || $ll3 === 7 /*#string:STRING*/){
                break s2;
              } else if($ll3 === 4 /*#string:D*/){
                // Ambiguity
                this.gll.u(this.$i(),$env);
                this.gll.a("A",2,$env);
                this.gll.c("A",1,"B",[]);
                return;
              } else {
                this.$err();
              }
            } else {
              this.$err();
            }
          } else if($ll1 === 2 /*#string:B*/){
            break;
          } else {
            this.$err();
          }
          $env.B = (this.gll.u(this.$i(),$env), this.gll.c("A",1,"B",[]));
          return;
        }while(0);
        this.$e(2 /*#string:B*/);
        break s5;
      }while(0);
      this.$e(1 /*#string:A*/);
    }while(0);
    this.$e(3 /*#string:C*/);
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",4,$env);
      return;
    } else if($ll1 === 4 /*#string:D*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",5,$env);
      return;
    } else if($ll1 === 6 /*#string:F*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",6,$env);
      return;
    } else {
      this.$err();
    }
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_1($env) {
    let $ll1;
    $env.B = $env["#tmp"];
    s4:do{
      do{
        if($ll1 === 0 /*#string:O*/){
          this.$e(0 /*#string:O*/);
          if($ll1 === 1 /*#string:A*/){
            // epsilon
          } else if($ll1 === 2 /*#string:B*/){
            break;
          } else {
            this.$err();
          }
        } else if($ll1 === 1 /*#string:A*/){
          // epsilon
        } else if($ll1 === 2 /*#string:B*/){
          break;
        } else {
          this.$err();
        }
        this.$e(1 /*#string:A*/);
        break s4;
      }while(0);
      this.$e(2 /*#string:B*/);
    }while(0);
    this.$e(3 /*#string:C*/);
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",4,$env);
      return;
    } else if($ll1 === 4 /*#string:D*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",5,$env);
      return;
    } else if($ll1 === 6 /*#string:F*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",6,$env);
      return;
    } else {
      this.$err();
    }
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_2($env) {
    let $ll1;
    this.$e(1 /*#string:A*/);
    this.$e(3 /*#string:C*/);
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",4,$env);
      return;
    } else if($ll1 === 4 /*#string:D*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",5,$env);
      return;
    } else if($ll1 === 6 /*#string:F*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",6,$env);
      return;
    } else {
      this.$err();
    }
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_3($env) {
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_4($env) {
    this.$e(0 /*#string:O*/);
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_5($env) {
    let $ll1;
    $env.D.push(this.$e(4 /*#string:D*/));
    this.$e(5 /*#string:E*/);
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",4,$env);
      return;
    } else if($ll1 === 4 /*#string:D*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",5,$env);
      return;
    } else if($ll1 === 6 /*#string:F*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",6,$env);
      return;
    } else {
      this.$err();
    }
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_6($env) {
    let $ll1;
    this.$e(6 /*#string:F*/);
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/ || $ll1 === 7 /*#string:STRING*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",4,$env);
      return;
    } else if($ll1 === 6 /*#string:F*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("A",3,$env);
      this.gll.a("A",6,$env);
      return;
    } else {
      this.$err();
    }
    $env.my_obj = {id:10};
    $env.C = (this.gll.u(this.$i(),$env), this.gll.c("A",7,"C",[10,20]));
    return;
  }
  ruleA_7($env) {
    $env.C = $env["#tmp"];
    $env.T = (this.gll.u(this.$i(),$env), this.gll.c("A",8,"Tricky2",[]));
    return;
  }
  ruleA_8($env) {
    $env.T = $env["#tmp"];
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({o:$env.my_obj,b:$env.B,c:$env.C,d:$env.D,t:$env.T,external:this.external.externalCall($env.my_obj,$env.C),$loc:$env.$loc}));
  }
  ruleB_0($env) {
    let $ll2,$ll1;
    $env.$startPos = this.$getPos();
    this.$e(1 /*#string:A*/);
    if($ll1 === 0 /*#string:O*/){
      if($ll2 === 0 /*#string:O*/){
        while(1){
          this.$e(0 /*#string:O*/);
          if($ll1 === 0 /*#string:O*/){
            if($ll2 === 0 /*#string:O*/){
              continue;
            } else if($ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
              // Ambiguity
              this.gll.u(this.$i(),$env);
              this.gll.a("B",1,$env);
              this.gll.a("B",2,$env);
              return;
            } else {
              this.$err();
            }
          } else if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
            break;
          } else {
            this.$err();
          }
        }
      } else if($ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
        // Ambiguity
        this.gll.u(this.$i(),$env);
        this.gll.a("B",1,$env);
        this.gll.a("B",2,$env);
        return;
      } else {
        this.$err();
      }
    } else if($ll1 === 1 /*#string:A*/){
      // epsilon
    } else if($ll1 === 2 /*#string:B*/){
      if($ll2 === 3 /*#string:C*/){
        // epsilon
      } else if($ll2 === 4 /*#string:D*/){
        while(1){
          this.$e(2 /*#string:B*/);
          this.$e(4 /*#string:D*/);
          if($ll1 === 0 /*#string:O*/ || $ll1 === 1 /*#string:A*/){
            break;
          } else if($ll1 === 2 /*#string:B*/){
            if($ll2 === 3 /*#string:C*/){
              break;
            } else if($ll2 === 4 /*#string:D*/){
              continue;
            } else {
              this.$err();
            }
          } else {
            this.$err();
          }
        }
      } else {
        this.$err();
      }
    } else if($ll1 === 3 /*#string:C*/){
      while(1){
        this.$e(3 /*#string:C*/);
        this.$e(4 /*#string:D*/);
        if($ll1 === 0 /*#string:O*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
          break;
        } else if($ll1 === 3 /*#string:C*/){
          continue;
        } else {
          this.$err();
        }
      }
    } else {
      this.$err();
    }
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleB_1($env) {
    let $ll2,$ll1;
    while(1){
      this.$e(0 /*#string:O*/);
      if($ll1 === 0 /*#string:O*/){
        if($ll2 === 0 /*#string:O*/){
          continue;
        } else if($ll2 === 1 /*#string:A*/ || $ll2 === 2 /*#string:B*/){
          // Ambiguity
          this.gll.u(this.$i(),$env);
          this.gll.a("B",1,$env);
          this.gll.a("B",2,$env);
          return;
        } else {
          this.$err();
        }
      } else if($ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
        break;
      } else {
        this.$err();
      }
    }
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleB_2($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleC_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      // epsilon
    } else if($ll1 === 7 /*#string:STRING*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("C",1,$env);
      this.gll.a("C",2,$env);
      return;
    } else {
      this.$err();
    }
    $env.ret = {x:$env.y,y:$env.x};
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({ret:$env.ret,text:$env.text,$loc:$env.$loc}));
  }
  ruleC_1($env) {
    $env.ret = {x:$env.y,y:$env.x};
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({ret:$env.ret,text:$env.text,$loc:$env.$loc}));
  }
  ruleC_2($env) {
    $env.text = this.$e(7 /*#string:STRING*/);
    $env.ret = {x:$env.x,y:$env.y};
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({ret:$env.ret,text:$env.text,$loc:$env.$loc}));
  }
  ruleparent_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("parent",1,"child",[]));
    return;
  }
  ruleparent_1($env) {
    let $ll1;
    while(1){
      if($ll1 === -1 /*#eof*/){
        $env.$loc = this.$getLoc($env.$startPos);
        return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
      } else if($ll1 === 1 /*#string:A*/){
        this.$e(1 /*#string:A*/);
        continue;
      } else {
        this.$err();
      }
    }
  }
  rulechild_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/){
      $env.$loc = this.$getLoc($env.$startPos);
      return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
    } else if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("child",1,$env);
      this.gll.a("child",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  rulechild_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  rulechild_2($env) {
    let $ll1;
    this.$e(1 /*#string:A*/);
    if($ll1 === -1 /*#eof*/){
      $env.$loc = this.$getLoc($env.$startPos);
      return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
    } else if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("child",1,$env);
      this.gll.a("child",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleF_0(arg) {
    let $startPos=null,ret=null,w=null,$loc=null;
    $startPos = this.$getPos();
    ret = {x:arg};
    w = this.$e(13 /*W*/);
    this.ctx.p(5 /* F 5 */, () => this.ruleH_0(10));
    $loc = this.$getLoc($startPos);
    return w;
  }
  ruleG_0() {
    let $ll1,$startPos=null,$loc=null;
    $startPos = this.$getPos();
    if($ll1 === 8 /*#string:<<<*/){
      this.$e(8 /*#string:<<<*/);
    } else if($ll1 === 9 /*#string:<<*/){
      this.$e(9 /*#string:<<*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleH_0(x) {
    let $ll1,$startPos=null,y=null,$loc=null;
    $startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/){
      y = x;
    } else if($ll1 === 10 /*#string:a*/){
      y = this.$e(10 /*#string:a*/);
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return y;
  }
  ruleTricky1_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("Tricky1",1,$env);
      this.gll.a("Tricky1",2,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("Tricky1",1,$env);
      this.gll.a("Tricky1",2,$env);
      this.gll.a("Tricky1",3,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleTricky1_1($env) {
    let $ll1;
    1;
    if($ll1 === -1 /*#eof*/ || $ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky1",4,"Tricky1",[]);
      this.gll.a("Tricky1",5,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      (this.gll.u(this.$i(),$env), this.gll.c("Tricky1",4,"Tricky1",[]));
      return;
    } else {
      this.$err();
    }
  }
  ruleTricky1_2($env) {
    3;
    (this.gll.u(this.$i(),$env), this.gll.c("Tricky1",6,"Tricky1",[]));
    return;
  }
  ruleTricky1_3($env) {
    2;
    this.$e(1 /*#string:A*/);
    (this.gll.u(this.$i(),$env), this.gll.c("Tricky1",7,"Tricky1",[]));
    return;
  }
  ruleTricky1_4($env) {
    10;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTricky1_5($env) {
    10;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTricky1_6($env) {
    this.$e(2 /*#string:B*/);
    30;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTricky1_7($env) {
    20;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTricky2_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky2",1,"Tricky2",[]);
      this.gll.a("Tricky2",2,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky2",1,"Tricky2",[]);
      this.gll.a("Tricky2",3,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleTricky2_1($env) {
    $env.z = $env["#tmp"];
    this.$e(2 /*#string:B*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky2_2($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky2_3($env) {
    this.$e(1 /*#string:A*/);
    $env.y = (this.gll.u(this.$i(),$env), this.gll.c("Tricky2",4,"Tricky2",[]));
    return;
  }
  ruleTricky2_4($env) {
    $env.y = $env["#tmp"];
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky3_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky3",1,"Tricky3",[10]);
      this.gll.c("Tricky3",2,"Tricky3",[30]);
      this.gll.a("Tricky3",3,$env);
      return;
    } else if($ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky3",1,"Tricky3",[10]);
      this.gll.c("Tricky3",2,"Tricky3",[30]);
      this.gll.a("Tricky3",4,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleTricky3_1($env) {
    $env.x = $env["#tmp"];
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({x:$env.x,y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky3_2($env) {
    $env.z = $env["#tmp"];
    this.$e(2 /*#string:B*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({x:$env.x,y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky3_3($env) {
    this.$e(1 /*#string:A*/);
    $env.y = (this.gll.u(this.$i(),$env), this.gll.c("Tricky3",5,"Tricky3",[20]));
    return;
  }
  ruleTricky3_4($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({x:$env.x,y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky3_5($env) {
    $env.y = $env["#tmp"];
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({x:$env.x,y:$env.y,z:$env.z,$loc:$env.$loc}));
  }
  ruleTricky4_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky4",1,"Tricky4",[]);
      this.gll.a("Tricky4",2,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Tricky4",1,"Tricky4",[]);
      this.gll.a("Tricky4",3,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleTricky4_1($env) {
    let $ll1;
    if($ll1 === -1 /*#eof*/){
      // epsilon
    } else if($ll1 === 2 /*#string:B*/){
      this.$e(2 /*#string:B*/);
    } else {
      this.$err();
    }
    this.$e(-1 /*#eof*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTricky4_2($env) {
    this.$e(-1 /*#eof*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTricky4_3($env) {
    this.$e(1 /*#string:A*/);
    (this.gll.u(this.$i(),$env), this.gll.c("Tricky4",4,"Tricky4",[]));
    return;
  }
  ruleTricky4_4($env) {
    this.$e(-1 /*#eof*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleY_0() {
    let $startPos=null,y=null,$loc=null;
    $startPos = this.$getPos();
    y = this.$e(14 /*TY*/);
    $loc = this.$getLoc($startPos);
    return y;
  }
  ruleRec1_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("Rec1",1,"Rec1",[]));
    return;
  }
  ruleRec1_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p(10));
  }
  ruleRec2_0($env) {
    $env.$startPos = this.$getPos();
    {
      this.$err();
    }
  }
  ruleRec3_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Rec3",1,"Rec3",[]);
      this.gll.a("Rec3",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleRec3_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p(10));
  }
  ruleRec3_2($env) {
    this.$e(1 /*#string:A*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p(10));
  }
  ruleRec4_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("Rec4",1,"Rec4",[]);
      this.gll.a("Rec4",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleRec4_1($env) {
    this.$e(1 /*#string:A*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p(10));
  }
  ruleRec4_2($env) {
    this.$e(2 /*#string:B*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p(10));
  }
  ruleRecTricky1_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("RecTricky1",1,$env);
      this.gll.a("RecTricky1",2,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("RecTricky1",1,$env);
      this.gll.a("RecTricky1",2,$env);
      this.gll.a("RecTricky1",3,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleRecTricky1_1($env) {
    let $ll1;
    1;
    if($ll1 === -1 /*#eof*/ || $ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("RecTricky1",4,"RecTricky2",[]);
      this.gll.a("RecTricky1",5,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      (this.gll.u(this.$i(),$env), this.gll.c("RecTricky1",4,"RecTricky2",[]));
      return;
    } else {
      this.$err();
    }
  }
  ruleRecTricky1_2($env) {
    3;
    (this.gll.u(this.$i(),$env), this.gll.c("RecTricky1",6,"RecTricky2",[]));
    return;
  }
  ruleRecTricky1_3($env) {
    2;
    this.$e(1 /*#string:A*/);
    (this.gll.u(this.$i(),$env), this.gll.c("RecTricky1",7,"RecTricky2",[]));
    return;
  }
  ruleRecTricky1_4($env) {
    10;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecTricky1_5($env) {
    10;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecTricky1_6($env) {
    this.$e(2 /*#string:B*/);
    30;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecTricky1_7($env) {
    20;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecTricky2_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("RecTricky2",1,"RecTricky1",[]));
    return;
  }
  ruleRecTricky2_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecTricky3_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      // epsilon
    } else if($ll1 === 3 /*#string:C*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("RecTricky3",1,"RecTricky2",[]);
      this.gll.a("RecTricky3",2,$env);
      return;
    } else {
      this.$err();
    }
    (this.gll.u(this.$i(),$env), this.gll.c("RecTricky3",1,"RecTricky2",[]));
    return;
  }
  ruleRecTricky3_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecTricky3_2($env) {
    this.$e(3 /*#string:C*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecMutual1_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 2 /*#string:B*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("RecMutual1",1,"RecMutual2",[]);
      this.gll.a("RecMutual1",2,$env);
      return;
    } else if($ll1 === 3 /*#string:C*/){
      (this.gll.u(this.$i(),$env), this.gll.c("RecMutual1",1,"RecMutual2",[]));
      return;
    } else {
      this.$err();
    }
  }
  ruleRecMutual1_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecMutual1_2($env) {
    this.$e(2 /*#string:B*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecMutual2_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 2 /*#string:B*/){
      (this.gll.u(this.$i(),$env), this.gll.c("RecMutual2",1,"RecMutual1",[]));
      return;
    } else if($ll1 === 3 /*#string:C*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("RecMutual2",1,"RecMutual1",[]);
      this.gll.a("RecMutual2",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleRecMutual2_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleRecMutual2_2($env) {
    this.$e(3 /*#string:C*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleUsesEmpty_0() {
    let $ll2,$ll1,$startPos=null,$loc=null;
    $startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      if($ll2 === 2 /*#string:B*/){
        this.ctx.p(26 /* UsesEmpty 3 */, () => this.ruleEmpty_0());
        this.$e(1 /*#string:A*/);
        this.ctx.p(27 /* UsesEmpty 5 */, () => this.ruleEmpty_0());
        this.$e(2 /*#string:B*/);
      } else if($ll2 === 3 /*#string:C*/){
        this.$e(1 /*#string:A*/);
        this.$e(3 /*#string:C*/);
      } else {
        this.$err();
      }
    } else {
      this.$err();
    }
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleEmpty_0() {
    let $startPos=null,$loc=null;
    $startPos = this.$getPos();
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleEmptyOrNot_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("EmptyOrNot",1,$env);
      this.gll.a("EmptyOrNot",2,$env);
      return;
    } else {
      this.$err();
    }
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleEmptyOrNot_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleEmptyOrNot_2($env) {
    this.$e(0 /*#string:O*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTrickyAfterEmpty_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === -1 /*#eof*/ || $ll1 === 1 /*#string:A*/ || $ll1 === 2 /*#string:B*/){
      // epsilon
    } else if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.c("TrickyAfterEmpty",1,"EmptyOrNot",[]);
      this.gll.a("TrickyAfterEmpty",2,$env);
      return;
    } else {
      this.$err();
    }
    (this.gll.u(this.$i(),$env), this.gll.c("TrickyAfterEmpty",1,"EmptyOrNot",[]));
    return;
  }
  ruleTrickyAfterEmpty_1($env) {
    (this.gll.u(this.$i(),$env), this.gll.c("TrickyAfterEmpty",3,"Tricky1",[]));
    return;
  }
  ruleTrickyAfterEmpty_2($env) {
    this.$e(0 /*#string:O*/);
    this.$e(11 /*#string:P*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleTrickyAfterEmpty_3($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLL1_0() {
    let $ll1,$startPos=null,$loc=null;
    $startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      this.ctx.p(30 /* GLL1 3 */, () => this.ruleGLLAux1_0());
    } else if($ll1 === 2 /*#string:B*/){
      this.ctx.p(30 /* GLL1 3 */, () => this.ruleGLLAux2_0());
    } else {
      this.$err();
    }
    this.$e(0 /*#string:O*/);
    this.$e(12 /*#string:W*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLLAux1_0() {
    let $startPos=null,$loc=null;
    $startPos = this.$getPos();
    this.$e(1 /*#string:A*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLLAux2_0() {
    let $startPos=null,$loc=null;
    $startPos = this.$getPos();
    this.$e(2 /*#string:B*/);
    this.$e(3 /*#string:C*/);
    $loc = this.$getLoc($startPos);
    return {$loc};
  }
  ruleGLL1Follow_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("GLL1Follow",1,$env);
      this.gll.a("GLL1Follow",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleGLL1Follow_1($env) {
    1;
    this.ctx.p(31 /* GLL1Follow 4 */, () => this.ruleGLLAux1_0());
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLL1Follow_2($env) {
    2;
    this.ctx.p(31 /* GLL1Follow 4 */, () => this.ruleGLLAux1_0());
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLL1FollowContext_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("GLL1FollowContext",1,"GLL1Follow",[]));
    return;
  }
  ruleGLL1FollowContext_1($env) {
    let $ll1;
    this.ctx.p(33 /* GLL1FollowContext 4 */, () => this.ruleGLLAux1_0());
    if($ll1 === 0 /*#string:O*/){
      // epsilon
    } else if($ll1 === 1 /*#string:A*/){
      this.ctx.p(34 /* GLL1FollowContext 7 */, () => this.ruleGLLAux1_0());
    } else {
      this.$err();
    }
    this.$e(0 /*#string:O*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLL1Follow2_0($env) {
    let $ll2,$ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 0 /*#string:O*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("GLL1Follow2",1,$env);
      this.gll.a("GLL1Follow2",2,$env);
      return;
    } else if($ll1 === 1 /*#string:A*/){
      if($ll2 === 0 /*#string:O*/){
        // Ambiguity
        this.gll.u(this.$i(),$env);
        this.gll.a("GLL1Follow2",1,$env);
        this.gll.a("GLL1Follow2",2,$env);
        return;
      } else if($ll2 === 1 /*#string:A*/){
        1;
        (this.gll.u(this.$i(),$env), this.gll.c("GLL1Follow2",3,"GLLAuxOptional1",[]));
        return;
      } else {
        this.$err();
      }
    } else {
      this.$err();
    }
  }
  ruleGLL1Follow2_1($env) {
    1;
    (this.gll.u(this.$i(),$env), this.gll.c("GLL1Follow2",3,"GLLAuxOptional1",[]));
    return;
  }
  ruleGLL1Follow2_2($env) {
    2;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLL1Follow2_3($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLL1FollowContext2_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("GLL1FollowContext2",1,"GLL1Follow2",[]));
    return;
  }
  ruleGLL1FollowContext2_1($env) {
    (this.gll.u(this.$i(),$env), this.gll.c("GLL1FollowContext2",2,"GLLAuxOptional1",[]));
    return;
  }
  ruleGLL1FollowContext2_2($env) {
    this.$e(0 /*#string:O*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLLAuxOptional1_0($env) {
    let $ll2,$ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 0 /*#string:O*/){
      // epsilon
    } else if($ll1 === 1 /*#string:A*/){
      if($ll2 === 0 /*#string:O*/){
        // Ambiguity
        this.gll.u(this.$i(),$env);
        this.gll.a("GLLAuxOptional1",1,$env);
        this.gll.a("GLLAuxOptional1",2,$env);
        return;
      } else if($ll2 === 1 /*#string:A*/){
        this.$e(1 /*#string:A*/);
      } else {
        this.$err();
      }
    } else {
      this.$err();
    }
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLLAuxOptional1_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleGLLAuxOptional1_2($env) {
    this.$e(1 /*#string:A*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  rulefollow3_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("follow3",1,"follow2",[]));
    return;
  }
  rulefollow3_1($env) {
    this.$e(1 /*#string:A*/);
    this.$e(1 /*#string:A*/);
    this.$e(1 /*#string:A*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  rulefollow2_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("follow2",1,"follow1",[]));
    return;
  }
  rulefollow2_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  rulefollow1_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("follow1",1,"follow0",[]));
    return;
  }
  rulefollow1_1($env) {
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  rulefollow0_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("follow0",1,$env);
      this.gll.a("follow0",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  rulefollow0_1($env) {
    $env.a = 0;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({a:$env.a,$loc:$env.$loc}));
  }
  rulefollow0_2($env) {
    $env.a = 1;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({a:$env.a,$loc:$env.$loc}));
  }
  ruleend_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("end",1,"endAux",[]));
    return;
  }
  ruleend_1($env) {
    this.$e(1 /*#string:A*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  rulenotEnd_0($env) {
    $env.$startPos = this.$getPos();
    (this.gll.u(this.$i(),$env), this.gll.c("notEnd",1,"endAux",[]));
    return;
  }
  rulenotEnd_1($env) {
    this.$e(1 /*#string:A*/);
    this.$e(2 /*#string:B*/);
    this.$e(3 /*#string:C*/);
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleendAux_0($env) {
    let $ll1;
    $env.$startPos = this.$getPos();
    if($ll1 === 1 /*#string:A*/){
      // Ambiguity
      this.gll.u(this.$i(),$env);
      this.gll.a("endAux",1,$env);
      this.gll.a("endAux",2,$env);
      return;
    } else {
      this.$err();
    }
  }
  ruleendAux_1($env) {
    1;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  ruleendAux_2($env) {
    2;
    $env.$loc = this.$getLoc($env.$startPos);
    return (this.gll.u(this.$i(),$env), this.gll.p({$loc:$env.$loc}));
  }
  $createEnv(name,args){
    if(name==="$$START$$") return {$startPos:null,$$ret:null,$loc:null,arg:args[0]};
    if(name==="A") return {$startPos:null,B:null,D:[],my_obj:null,C:null,T:null,$loc:null,arg:args[0]};
    if(name==="B") return {$startPos:null,$loc:null};
    if(name==="C") return {$startPos:null,text:null,ret:null,$loc:null,x:args[0],y:args[1]};
    if(name==="parent") return {$startPos:null,$loc:null};
    if(name==="child") return {$startPos:null,$loc:null};
    if(name==="Tricky1") return {$startPos:null,$loc:null};
    if(name==="Tricky2") return {$startPos:null,y:null,z:null,$loc:null};
    if(name==="Tricky3") return {$startPos:null,x:null,y:null,z:null,$loc:null,arg:args[0]};
    if(name==="Tricky4") return {$startPos:null,$loc:null};
    if(name==="Rec1") return {$startPos:null,$loc:null};
    if(name==="Rec2") return {$startPos:null,$loc:null};
    if(name==="Rec3") return {$startPos:null,$loc:null};
    if(name==="Rec4") return {$startPos:null,$loc:null};
    if(name==="RecTricky1") return {$startPos:null,$loc:null};
    if(name==="RecTricky2") return {$startPos:null,$loc:null};
    if(name==="RecTricky3") return {$startPos:null,$loc:null};
    if(name==="RecMutual1") return {$startPos:null,$loc:null};
    if(name==="RecMutual2") return {$startPos:null,$loc:null};
    if(name==="EmptyOrNot") return {$startPos:null,$loc:null};
    if(name==="TrickyAfterEmpty") return {$startPos:null,$loc:null};
    if(name==="GLL1Follow") return {$startPos:null,$loc:null};
    if(name==="GLL1FollowContext") return {$startPos:null,$loc:null};
    if(name==="GLL1Follow2") return {$startPos:null,$loc:null};
    if(name==="GLL1FollowContext2") return {$startPos:null,$loc:null};
    if(name==="GLLAuxOptional1") return {$startPos:null,$loc:null};
    if(name==="follow3") return {$startPos:null,$loc:null};
    if(name==="follow2") return {$startPos:null,$loc:null};
    if(name==="follow1") return {$startPos:null,$loc:null};
    if(name==="follow0") return {$startPos:null,a:null,$loc:null};
    if(name==="end") return {$startPos:null,$loc:null};
    if(name==="notEnd") return {$startPos:null,$loc:null};
    if(name==="endAux") return {$startPos:null,$loc:null};
    throw new Error("Never");
  }
}

export function parse(external, string, $arg) {
  const input = new Input({ string });
  const tokenizer = new GrammarTokenizer(input, external);
  const parser = new GrammarParser(tokenizer, external);
  const tokGll = new GLL("token",tokenizer,"$lexer",[]); tokenizer.$setGLL(tokGll);
  const parserGll = new GLL("rule",parser,"$$START$$",[$arg]); parser.$setGLL(parserGll);
  return parserGll.run();
}
