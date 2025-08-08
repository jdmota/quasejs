import createChildren from "./createChildren";

export default function createObject( numChildren ) {
  return {
    children: createChildren( numChildren )
  };
}
