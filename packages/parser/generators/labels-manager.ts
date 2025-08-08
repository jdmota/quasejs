import { MapKeyToValue } from "../../util/data-structures/map-key-to-value";
import { nonNull } from "../../util/miscellaneous";
import type { DState } from "../automaton/state";
import {
  type AnyTransition,
  CallTransition,
  FieldTransition,
} from "../automaton/transitions";
import type { GLLInfo } from "../grammar/gll-info";
import type { AugmentedDeclaration } from "../grammar/grammar";
import { DStateEdge } from "./dfa-to-cfg";

export type RuleLabel = number;

export class LabelsManager {
  private readonly map = new MapKeyToValue<DStateEdge, RuleLabel>();
  private readonly queue: [DStateEdge, RuleLabel][] = [];
  private uuid = 0;

  constructor(private readonly gllInfo: GLLInfo) {}

  needsGLL(rule: AugmentedDeclaration) {
    return this.gllInfo.needsGLL(rule);
  }

  needsGLLCall<I extends AnyTransition | null, T>(
    t: I,
    then: (t: CallTransition) => T,
    elsee: (t: I) => T
  ) {
    return t instanceof CallTransition &&
      this.gllInfo.needsGLLByName(t.ruleName)
      ? then(t)
      : elsee(t);
  }

  private process(t: AnyTransition | null) {
    return this.needsGLLCall(
      t,
      t => (t.field ? new FieldTransition(t.field) : null),
      t => t
    );
  }

  get(t: AnyTransition | null, dest: DState) {
    return nonNull(this.map.get(new DStateEdge(this.process(t), dest)));
  }

  add(t: AnyTransition | null, dest: DState) {
    const edge = new DStateEdge(this.process(t), dest);
    const nextId = this.uuid;
    const id = this.map.computeIfAbsent(edge, () => this.uuid++);
    if (nextId < this.uuid) {
      this.queue.push([edge, id]);
    }
    return id;
  }

  *loopQueue(): Generator<readonly [DStateEdge, RuleLabel]> {
    let next;
    while ((next = this.queue.shift())) {
      yield next;
    }
  }
}
