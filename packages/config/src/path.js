// @flow
import { formatOption } from "./formating";

export default class Path {

  +arr: string[];
  where: ?string;

  constructor() {
    this.arr = [];
    this.where = null;
  }

  push( key: string | number ) {
    this.arr.push( key + "" );
  }

  pop() {
    this.arr.pop();
  }

  size() {
    return this.arr.length;
  }

  chainToString() {
    return this.arr.join( "." );
  }

  format() {
    return formatOption( `${this.arr.join( "." )}${this.where ? ` [in ${this.where}]` : ""}` );
  }

}
