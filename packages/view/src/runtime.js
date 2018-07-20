( function( factory ) {
  if ( typeof module !== "undefined" && module.exports ) {
    module.exports = factory;
  } else {
    factory( window ); // eslint-disable-line no-undef
  }
} )( function( win ) {

  const doc = win.document;

  class Template {
    constructor( parts, strings, html ) {
      this.element = doc.createElement( "template" );
      this.element.innerHTML = html;
      this.parts = parts;
      this.strings = strings;
    }
  }

  class TemplateResult {
    constructor( template, values ) {
      this.template = template;
      this.values = values;
    }
  }

  class TemplateInstance {

    constructor( template ) {
      this.template = template;
      this.parts = [];
    }

    update( values ) {
      let i = 0;
      for ( const part of this.parts ) {
        part.setValue( values[ i++ ] );
      }
    }

    createNode() {
      const fragment = this.template.element.content.cloneNode( true );
      const parts = this.template.parts;
      const strings = this.template.strings;

      if ( parts.length > 0 ) {
        // Edge needs all 4 parameters present
        const walker = doc.createTreeWalker(
          fragment,
          129, /* NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT */
          null,
          false
        );

        let index = -1;
        let strIdx = 0;
        for ( let i = 0; i < parts.length; i++ ) {
          const partInfo = parts[ i ];
          const partIdx = partInfo >>> 2;

          while ( index < partIdx ) {
            index++;
            walker.nextNode();
          }

          const node = walker.currentNode;
          let part;

          switch ( partInfo & 0b11 ) {
            case 0:
              part = new AttributePart( this, node, strings[ strIdx++ ] );
              break;
            case 1:
              part = new PropertyPart( this, node, strings[ strIdx++ ] );
              break;
            case 2:
              part = new EventPart( this, node, strings[ strIdx++ ] );
              break;
            default:
              part = new NodePart( this, node );
          }

          this.parts.push( part );
        }
      }
      return fragment;
    }
  }

  class Part {
    constructor( instance, element ) {
      this.instance = instance;
      this.element = element;
      this._value = undefined;
    }
    getValue( value ) {
      if ( typeof value === "function" && value.__directive ) {
        value = value( this );
      }
      return value == null ? null : value;
    }
    getValueNoFalse( value ) {
      const v = this.getValue( value );
      return v === false ? null : v;
    }
  }

  class AttributePart extends Part {

    constructor( instance, element, name ) {
      super( instance, element );
      this.name = name;
    }

    setValue( _value ) {
      const value = this.getValueNoFalse( _value );
      if ( this._value !== value ) {
        if ( value == null ) {
          this.element.removeAttribute( this.name );
        } else {
          this.element.setAttribute( this.name, value );
        }
        this._value = value;
      }
    }
  }

  class PropertyPart extends AttributePart {
    setValue( value ) {
      this.element[ this.name ] = value;
    }
  }

  class EventPart extends Part {

    constructor( instance, element, eventName ) {
      super( instance, element );
      this.eventName = eventName;
    }

    setValue( value ) {
      const listener = this.getValueNoFalse( value );
      const previous = this._value;
      if ( listener === previous ) {
        return;
      }

      this._value = listener;
      if ( previous != null ) {
        this.element.removeEventListener( this.eventName, previous );
      }
      if ( listener != null ) {
        this.element.addEventListener( this.eventName, listener );
      }
    }
  }

  class NodePart extends Part {

    setValue( value ) {
      value = this.getValue( value );

      if ( value == null || !( typeof value === "object" || typeof value === "function" ) ) {
        if ( value === this._value ) {
          return;
        }
        this._setText( value );
      } else if ( value instanceof TemplateResult ) {
        this._setTemplateResult( value );
      } else if ( value instanceof win.Node ) {
        this._setNode( value );
      } else if ( value[ Symbol.iterator ] ) {
        this._setIterable( value );
      } else if ( value.then != null ) {
        this._setPromise( value );
      } else {
        this._setText( value );
      }
    }

    _replace( node ) {
      this.element.parentNode.replaceChild( node, this.element );
      this.element = node;
    }

    _setNode( value ) {
      if ( this._value === value ) {
        return;
      }
      this._replace( value );
      this._value = value;
    }

    _setText( value ) {
      if ( this.element.nodeType === 3 /* Node.TEXT_NODE */ ) {
        this.element.textContent = value;
      } else {
        this._setNode( doc.createTextNode( value == null ? "" : value ) );
      }
      this._value = value;
    }

    _setTemplateResult( value ) {
      let instance;
      if ( this._value && this._value.template === value.template ) {
        instance = this._value;
      } else {
        instance = new TemplateInstance( value.template );
        this._setNode( instance.createNode() );
        this._value = instance;
      }
      instance.update( value.values );
    }

    _setPromise( value ) {
      this._value = value;
      value.then( v => {
        if ( this._value === value ) {
          this.setValue( v );
        }
      } );
    }

    _setIterable( value ) {
      if ( !this._value || !this._value[ Symbol.iterator ] ) {
        this._replace( doc.createComment( "" ) );
        this._value = [];
      }

      const itemParts = this._value;
      let partIndex = 0;

      for ( const item of value ) {
        let itemPart = itemParts[ partIndex ];

        if ( partIndex >= itemParts.length ) {
          itemPart = new NodePart( this.instance, doc.createComment( "" ) );
          itemParts.push( itemPart );
          this.element.parentNode.insertBefore( itemPart.element, this.element );
        }

        itemPart.setValue( item );
        partIndex++;
      }

      for ( let i = partIndex; i < itemParts.length; i++ ) {
        const element = itemParts[ i ].element;
        element.parentNode.removeChild( element );
      }
      itemParts.length = partIndex;
    }

  }

  function render( result, container ) {
    let instance = container.__templateInstance;

    if ( instance != null && instance.template === result.template ) {
      instance.update( result.values );
      return;
    }

    instance = new TemplateInstance( result.template );
    container.__templateInstance = instance;

    const fragment = instance.createNode();
    instance.update( result.values );

    container.appendChild( fragment );
  }

  class QuaseView extends win.HTMLElement {
    constructor() {
      super();
      this._ready = false;
      this.attachShadow( { mode: "open" } );
    }
    static get observedAttributes() {
      // Note: `this` is the class itself
      return Object.keys( this.props || {} );
    }
    forceUpdate() {
      QuaseView.render( this.render(), this.shadowRoot );
    }
    connectedCallback() {
      this._ready = true;
      this.forceUpdate();
    }
    attributeChangedCallback( name, oldValue, newValue ) {
      if ( this._ready && oldValue !== newValue ) {
        this.forceUpdate();
      }
    }
  }

  QuaseView.t = Template;
  QuaseView.r = TemplateResult;
  QuaseView.render = render;

  const modules = Object.create( null );

  QuaseView.define = function( name, clazz ) {
    if ( modules[ name ] ) {
      throw new Error( "QuaseView: module " + name + " already defined" );
    }
    modules[ name ] = true;
    win.customElements.define( name, clazz );
  };

  win.QuaseView = QuaseView;
  return QuaseView;
} );
