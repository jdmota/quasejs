import npmrc from "./npmrc";

type CheckFn = ( filename: string, text: string ) => Promise<string[]> | string[];

const nameToCheck: { [key: string]: CheckFn | undefined } = {
  ".npmrc": npmrc
};

export default nameToCheck;
