const defaultTreeAdapter = require("parse5/lib/tree-adapters/default");

function attrsToObj(attrs: any) {
  const attrsObj: any = {};
  for (const { name, value } of attrs) {
    attrsObj[name] = value;
  }
  return attrsObj;
}

export function TreeAdapter() {
  // @ts-ignore
  this.__deps = [];
}

Object.assign(TreeAdapter.prototype, defaultTreeAdapter);

TreeAdapter.prototype.getAttr = function(element: any, attrName: string) {
  const a = element.attrs.find(({ name }: any) => name === attrName) || {};
  return a.value;
};

TreeAdapter.prototype.setAttr = function(
  element: any,
  attrName: string,
  value: string
) {
  const a = element.attrs.find(({ name }: any) => name === attrName);
  if (a) {
    a.value = value;
  } else {
    element.attrs.push({
      name: attrName,
      value,
    });
  }
};

TreeAdapter.prototype.removeAttr = function(element: any, attrName: string) {
  const index = element.attrs.findIndex(({ name }: any) => name === attrName);
  if (index > -1) {
    element.attrs.splice(index, 1);
  }
};

export function TreeAdapterProxy() {
  // @ts-ignore
  this.__deps = [];
}

Object.assign(TreeAdapterProxy.prototype, TreeAdapter.prototype);

TreeAdapterProxy.prototype.createElement = function(
  tagName: string,
  namespaceURI: any,
  attrs: any
) {
  const node = defaultTreeAdapter.createElement(tagName, namespaceURI, attrs);

  if (tagName === "script") {
    const attrsObj = attrsToObj(attrs);

    if (attrsObj.type === "module") {
      if ("src" in attrsObj) {
        this.__deps.push({
          node,
          async: "async" in attrsObj && attrsObj.async !== "false",
          request: attrsObj.src,
          importType: "js",
        });
        node.__importType = "js";
      } else {
        this.__deps.push({
          node,
          async: "async" in attrsObj && attrsObj.async !== "false",
          request: `${this.__deps.length}`,
          inner: true,
          importType: "js",
        });
        node.__importType = "js";
      }
    }
  } else if (tagName === "link") {
    const attrsObj = attrsToObj(attrs);

    if (
      "href" in attrsObj &&
      attrsObj.rel.split(/\s+/).includes("stylesheet")
    ) {
      this.__deps.push({
        node,
        async: false,
        request: attrsObj.href,
        importType: "css",
      });
      node.__importType = "css";
    }
  }

  return node;
};
