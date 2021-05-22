import { render } from "lit-html";
import { FormBinder } from "a-wc-form-binder";
import { getComponentTemplate } from "../lib/template-registry.js";
import "../templates/controls.js";
import "../templates/layouts.js";
/** @typedef {import("../lib/models.js").LayoutContext<import("../lib/models.js").Component>} LayoutContext */

/**  */
export class FormLayout extends FormBinder {
  /** @returns {import("../lib/models.js").Component} */
  get layout() {
    return this._layout;
  }

  /** @param {import("../lib/models.js").Component} component to use for form layout */
  set layout(component) {
    this._layout = component;
    setTimeout(() => this.render());
  }

  /** @inheritdoc */
  constructor() {
    super();

    this.layout = null;
    this.hasSlottedContent = false;
  }

  /** @inheritdoc */
  connectedCallback() {
    this.hasSlottedContent = !!this.children.length;
    this.setAttribute("role", "form");
    super.connectedCallback();
  }

  /** Renders the UI based on uiSchema only if user did not populate HTML themselves */
  render() {
    if (this.layout && this.hasSlottedContent === false && this.data !== null) {
      render(
        getComponentTemplate(this.context.component.template)(this.context),
        this
      );
    }
  }

  /** @returns {LayoutContext} */
  get context() {
    return {
      component: this.layout
    };
  }
}

window.customElements.define("form-layout", FormLayout);