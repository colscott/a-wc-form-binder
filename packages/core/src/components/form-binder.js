import { initialize } from "../lib/control-binder.js";
import { matchingValidators } from "../lib/control-validator.js";
import { getValue, setValue } from "../lib/json-pointer.js";

/**
 * @param {Element} element to get the name for
 * @returns {string} the name assigned to the element
 */
function getName(element) {
  // @ts-ignore
  return element.name || element.getAttribute("name");
}

/**  */
export class FormBinder extends HTMLElement {
  /** @returns {object} that is being bound to the form controls */
  get data() {
    return this._data;
  }

  /** @param {object} data to bind to the form controls */
  set data(data) {
    this._data = JSON.parse(JSON.stringify(data));
    this.registeredControlBinders.forEach((binder, control) => {
      this.setControlValue(control);
    });
  }

  /** @inheritdoc */
  connectedCallback() {
    this.setAttribute("role", "form");
    const config = { attributes: false, childList: true, subtree: true };

    /**
     * @type {MutationCallback}
     * @param {MutationRecord[]} mutationsList .
     */
    const callback = mutationsList => {
      mutationsList.forEach(mutation => {
        mutation.addedNodes.forEach(controlCandidate => {
          controlCandidate instanceof Element &&
            this.addControl(controlCandidate);
        });
        mutation.removedNodes.forEach(controlCandidate => {
          if (controlCandidate instanceof Element) {
            if (this.registeredControlBinders.has(controlCandidate)) {
              this.registeredControlBinders.delete(controlCandidate);
            }
            if (this.registeredValidators.has(controlCandidate)) {
              this.registeredValidators.delete(controlCandidate);
            }
          }
        });
      });
    };

    this.mutationObserver = new MutationObserver(callback);

    this.mutationObserver.observe(this, config);

    this.querySelectorAll("*").forEach(element => this.addControl(element));
  }

  /** @inheritdoc */
  disconnectedCallback() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  /** Initialize */
  constructor() {
    super();
    /** @type {Map<Element, import('../lib/control-binder.js').ControlBinding>} */
    this.registeredControlBinders = new Map();
    this.registeredValidators = new Map();
  }

  /** @param {Element} controlCandidate */
  addControl(controlCandidate) {
    if (controlCandidate instanceof HTMLElement) {
      const binder = initialize(
        controlCandidate,
        this.controlValueChanged.bind(this)
      );
      if (binder) {
        this.registeredControlBinders.set(controlCandidate, binder);
        if (this.data) {
          this.setControlValue(controlCandidate);
        }
      }
    }
  }

  /**
   * @param {Element} control
   */
  setControlValue(control) {
    const binder = this.registeredControlBinders.get(control);
    if (binder) {
      const value = getValue(this.data, getName(control));
      binder.binder.writeValue(control, value);
      // Run validity check as task to give custom controls chance to initialize (e.g. MWC)
      setTimeout(() => this.checkValidityForControl(control, value));
    }
  }

  /**
   * @param {Element} control
   * @param {any} newValue
   */
  controlValueChanged(control, newValue) {
    if (this.checkValidityForControl(control, newValue) === true) {
      const name = getName(control);
      setValue(this.data, name, newValue);
      this.dispatchEvent(
        new CustomEvent("form-binder:change", {
          detail: {
            data: this.data
          }
        })
      );
    }
  }

  /**
   * @param {Element} control
   * @param {any} value
   * @returns {boolean} if valid
   */
  checkValidityForControl(control, value) {
    const nativeIsValid = control.checkValidity
      ? control.checkValidity()
      : true;
    return (
      nativeIsValid &&
      matchingValidators(control).every(v => v.checkValidity(control, value))
    );
  }

  /**
   * @param {Element} control
   * @param {any} value
   * @returns {boolean} if valid
   */
  reportValidityForControl(control, value) {
    const customIsValid = matchingValidators(control).every(v => v.reportValidity(control, value));
    const nativeIsValid = control.reportValidity
      ? control.reportValidity()
      : true;
    return nativeIsValid && customIsValid;
  }

  /** @returns {boolean} checks if all controls are valid */
  checkValidity() {
    return Array.from(this.registeredControlBinders.keys()).every(control => {
      const value = getValue(this.data, getName(control));
      return this.checkValidityForControl(control, value);
    });
  }

  /** @returns {boolean} checks if all controls are valid and informs the user */
  reportValidity() {
    return Array.from(this.registeredControlBinders.keys()).every(control => {
      const value = getValue(this.data, getName(control));
      return this.reportValidityForControl(control, value);
    });
  }
}

window.customElements.define("form-binder", FormBinder);