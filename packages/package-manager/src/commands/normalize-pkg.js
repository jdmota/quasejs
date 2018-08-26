// @flow
import { read as readPkg, write as writePkg } from "../pkg";

export default async function( folder: string ) {
  const pkg = await readPkg( folder );
  return writePkg( folder, pkg );
}
