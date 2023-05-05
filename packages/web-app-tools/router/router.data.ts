import { SSR } from "../support";
import {
  sameSimpleLocationNoHash,
  type SimpleLocationNoHash,
} from "./pathname";

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

function getInitialDataForHydration<Data>(
  props: SimpleLocationNoHash
): InitialDataForHydration<Data> | undefined {
  const element = document.getElementById(DATA_KEY);
  if (element) {
    const text = element.textContent;
    element.remove();
    if (text) {
      const initial = JSON.parse(text) as InitialDataForHydration<Data>;
      if (sameSimpleLocationNoHash(initial.props, props)) {
        return initial;
      }
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

  getInitialData(props: SimpleLocationNoHash): Data | undefined {
    if (SSR) {
      if (this.initial && sameSimpleLocationNoHash(this.initial.props, props)) {
        return this.initial.data;
      }
      return undefined;
    }
    return getInitialDataForHydration<Data>(props)?.data;
  }
}
