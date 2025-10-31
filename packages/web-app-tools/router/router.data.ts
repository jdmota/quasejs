import type { Optional } from "../../util/miscellaneous";
import { SSR } from "../support";
import { type SimpleLocationNoHash } from "./pathname";

export const DATA_KEY = "quase_router_data";

export type InitialDataForHydration<Data> = Readonly<{
  props: SimpleLocationNoHash;
  data: Data;
}>;

export function createInitialDataForHydration<Data>(
  initial: InitialDataForHydration<Data>
) {
  const json = JSON.stringify(initial);
  return `<script id="${DATA_KEY}" type="application/json">${json}</script>`;
}

function getInitialDataForHydration<Data>(): Optional<
  InitialDataForHydration<Data>
> {
  const element = document.getElementById(DATA_KEY);
  if (element) {
    const text = element.textContent;
    element.remove();
    if (text) {
      const initial = JSON.parse(text) as InitialDataForHydration<Data>;
      return initial;
    }
  }
  return undefined;
}

export class RouterData<Data> {
  private initial: InitialDataForHydration<Data> | undefined;

  constructor() {
    this.initial = undefined;
  }

  setSSRData(initial: InitialDataForHydration<Data>) {
    this.initial = initial;
  }

  getInitialData(): Optional<InitialDataForHydration<Data>> {
    if (SSR) {
      return this.initial;
    }
    return getInitialDataForHydration<Data>();
  }
}
