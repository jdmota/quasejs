// Inspired in https://github.com/Polymer/lit-html/

type Win = Window & {
  HTMLElement: typeof HTMLElement; // eslint-disable-line no-undef
  Node: typeof Node; // eslint-disable-line no-undef
};

(function (factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory;
  } else {
    factory(window as Win); // eslint-disable-line no-undef
  }
})(function (win: Win) {
  const doc = win.document;

  class Template {
    element: HTMLTemplateElement;
    parts: number[];
    strings: string[];

    constructor(parts: number[], strings: string[], html: string) {
      this.element = doc.createElement("template");
      this.element.innerHTML = html;
      this.parts = parts;
      this.strings = strings;
    }
  }

  class TemplateResult {
    template: Template;
    values: unknown[];

    constructor(template: Template, values: unknown[]) {
      this.template = template;
      this.values = values;
    }
  }

  function malformedTemplate(): never {
    throw new Error("Quase View: malformed template");
  }

  // Edge needs all 4 parameters present
  const walker = doc.createTreeWalker(
    doc,
    128, // NodeFilter.SHOW_COMMENT
    null
  );

  const getWalker = (root: Node): TreeWalker => {
    if (walker.currentNode !== doc) {
      throw new Error("Quase View: walker was not reset");
    }
    walker.currentNode = root;
    return walker;
  };

  // TreeWalker should not hold onto any GC'able Nodes
  const resetWalker = () => {
    walker.currentNode = doc;
  };

  class TemplateInstance {
    template: Template;
    parts: Part[];

    constructor(template: Template) {
      this.template = template;
      this.parts = [];
    }

    update(values: unknown[]) {
      let i = 0;
      for (const part of this.parts) {
        part.setValue(values[i++]);
      }
    }

    createNode() {
      const fragment = this.template.element.content.cloneNode(true);
      const parts = this.template.parts;
      const strings = this.template.strings;

      if (parts.length > 0) {
        const walker = getWalker(fragment);

        let strIdx = 0;
        let mark = null;
        let node = null;

        for (let i = 0; i < parts.length; i++) {
          const partInfo = parts[i];
          const newMark = partInfo >>> 2 !== 0;
          const partType = partInfo & 0b11;

          if (newMark) {
            mark = walker.nextNode() || malformedTemplate();
            node = mark.nextSibling;
            if (partType < 3) {
              (mark as ChildNode).remove();
              if (node) {
                walker.currentNode = node;
              }
            }
          }

          let part: Part;

          switch (partType) {
            case 0:
              part = new AttributePart(
                (node || malformedTemplate()) as Element,
                strings[strIdx++]
              );
              break;
            case 1:
              part = new PropertyPart(
                (node || malformedTemplate()) as Element,
                strings[strIdx++]
              );
              break;
            case 2:
              part = new EventPart(
                node || malformedTemplate(),
                strings[strIdx++]
              );
              break;
            case 3:
              part = new NodePart(mark || malformedTemplate());
              break;
            default:
              throw malformedTemplate();
          }

          this.parts.push(part);
        }

        resetWalker();
      }
      return fragment;
    }
  }

  abstract class Part {
    protected element: Node;
    protected _value: any;

    constructor(element: Node) {
      this.element = element;
      this._value = undefined;
    }
    getValue(value: any) {
      if (typeof value === "function" && value.__directive) {
        value = value(this);
      }
      return value == null ? null : value;
    }
    getValueNoFalse(value: any) {
      const v = this.getValue(value);
      return v === false ? null : v;
    }
    abstract setValue(value: any): void;
  }

  class AttributePart extends Part {
    protected name: string;
    protected override element: Element;

    constructor(element: Element, name: string) {
      super(element);
      this.name = name;
      this.element = element;
    }

    setValue(_value: any) {
      const value = this.getValueNoFalse(_value);
      if (this._value !== value) {
        if (value == null) {
          this.element.removeAttribute(this.name);
        } else {
          this.element.setAttribute(this.name, value);
        }
        this._value = value;
      }
    }
  }

  class PropertyPart extends AttributePart {
    override setValue(value: any) {
      (this.element as any)[this.name] = value;
    }
  }

  class EventPart extends Part {
    protected eventName: string;

    constructor(element: Node, eventName: string) {
      super(element);
      this.eventName = eventName;
    }

    setValue(value: any) {
      const listener = this.getValueNoFalse(value);
      const previous = this._value;
      if (listener === previous) {
        return;
      }

      this._value = listener;
      if (previous != null) {
        this.element.removeEventListener(this.eventName, previous);
      }
      if (listener != null) {
        this.element.addEventListener(this.eventName, listener);
      }
    }
  }

  class NodePart extends Part {
    setValue(value: any) {
      value = this.getValue(value);

      if (
        value == null ||
        !(typeof value === "object" || typeof value === "function")
      ) {
        if (value === this._value) {
          return;
        }
        this._setText(value);
      } else if (value instanceof TemplateResult) {
        this._setTemplateResult(value);
      } else if (value instanceof win.Node) {
        this._setNode(value);
      } else if (value[Symbol.iterator]) {
        this._setIterable(value);
      } else if (value.then != null) {
        this._setPromise(value);
      } else {
        this._setText(value);
      }
    }

    private _replace(node: any) {
      if (this.element.parentNode) {
        this.element.parentNode.replaceChild(node, this.element);
      } else {
        throw new Error("Assertion error");
      }
      this.element = node;
    }

    private _setNode(value: any) {
      if (this._value === value) {
        return;
      }
      this._replace(value);
      this._value = value;
    }

    private _setText(value: string) {
      if (this.element.nodeType === 3 /* Node.TEXT_NODE */) {
        this.element.textContent = value;
      } else {
        this._setNode(doc.createTextNode(value == null ? "" : value));
      }
      this._value = value;
    }

    private _setTemplateResult(value: TemplateResult) {
      let instance: TemplateInstance;
      if (this._value && this._value.template === value.template) {
        instance = this._value;
      } else {
        instance = new TemplateInstance(value.template);
        this._setNode(instance.createNode());
        this._value = instance;
      }
      instance.update(value.values);
    }

    private _setPromise(value: Promise<any>) {
      this._value = value;
      value.then(v => {
        if (this._value === value) {
          this.setValue(v);
        }
      });
    }

    private _setIterable(value: Iterable<any>) {
      if (!this._value || !this._value[Symbol.iterator]) {
        this._replace(doc.createComment(""));
        this._value = [];
      }

      if (!this.element.parentNode) {
        throw new Error("Assertion error");
      }

      const itemParts = this._value;
      let partIndex = 0;

      for (const item of value) {
        let itemPart = itemParts[partIndex];

        if (partIndex >= itemParts.length) {
          itemPart = new NodePart(doc.createComment(""));
          itemParts.push(itemPart);
          this.element.parentNode.insertBefore(itemPart.element, this.element);
        }

        itemPart.setValue(item);
        partIndex++;
      }

      for (let i = partIndex; i < itemParts.length; i++) {
        const element = itemParts[i].element;
        element.parentNode.removeChild(element);
      }
      itemParts.length = partIndex;
    }
  }

  const nodeToInstance: WeakMap<Node, TemplateInstance> = new WeakMap();

  function render(result: TemplateResult, container: Node) {
    let instance = nodeToInstance.get(container);

    if (instance != null && instance.template === result.template) {
      instance.update(result.values);
      return;
    }

    instance = new TemplateInstance(result.template);
    nodeToInstance.set(container, instance);

    const fragment = instance.createNode();
    container.appendChild(fragment);

    // Update after custom elements upgrade
    instance.update(result.values);
  }

  const modules = Object.create(null);

  function define(name: string, clazz: CustomElementConstructor) {
    if (modules[name]) {
      throw new Error("QuaseView: module " + name + " already defined");
    }
    modules[name] = true;
    win.customElements.define(name, clazz);
  }

  abstract class QuaseView extends win.HTMLElement {
    static t = Template;
    static r = TemplateResult;
    static render = render;
    static define = define;
    static props: any;

    private _ready: boolean;

    constructor() {
      super();
      this._ready = false;
      this.attachShadow({ mode: "open" });
    }
    static get observedAttributes() {
      // Note: `this` is the class itself
      return Object.keys(this.props || {});
    }
    forceUpdate() {
      QuaseView.render(this.render(), this.shadowRoot as ShadowRoot);
    }
    connectedCallback() {
      this._ready = true;
      this.forceUpdate();
    }
    attributeChangedCallback(_name: string, oldValue: any, newValue: any) {
      if (this._ready && oldValue !== newValue) {
        this.forceUpdate();
      }
    }
    render(): TemplateResult {
      throw new Error("QuaseView: unimplemented render method");
    }
  }

  (win as any).QuaseView = QuaseView;
  return QuaseView;
});

export {};
