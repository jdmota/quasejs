// Adapted from https://gist.github.com/radum/d67ffdd595a6c6daf7d125619fa4b9c4

function next( node, stayWithin ) {
  if ( node === stayWithin ) {
    return null;
  }
  if ( node.next != null ) {
    return node.next;
  }

  while ( node.parent != null ) {
    node = node.parent;
    if ( node === stayWithin ) {
      return null;
    }
    if ( node.next != null ) {
      return node.next;
    }
  }
  return null;
}

function filter( node ) {
  return node.type === "comment" || !!node.attribs;
}

export default class TreeWalker {

  constructor( root ) {
    this.root = root;
    this.currentNode = root;
  }

  nextNode() {
    let node = this.currentNode;
    let show = true;
    while ( true ) {
      if ( show && node.firstChild != null ) {
        node = node.firstChild;
        show = filter( node );
        if ( show ) {
          this.currentNode = node;
          return node;
        }
      }
      const following = next( node, this.root );
      if ( following == null ) {
        return null;
      }
      node = following;
      show = filter( node );
      if ( show ) {
        this.currentNode = node;
        return node;
      }
    }
  }

}
