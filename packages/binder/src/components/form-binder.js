import { initialize } from "../lib/binder-registry.js";
import {
  filterValidationResults,
  matchingValidators,
  add
} from "../lib/validator-registry.js";
import * as validators from "../lib/validators/index.js";
import {
  getValue,
  normalize,
  objectFlat,
  setValue
} from "../lib/json-pointer.js";
import { ShadowDomMutationObserver } from "../lib/observer.js";

/** @typedef {import('../lib/control-binding.js').ControlBinding} ControlBinding */
/** @typedef {import("../lib/binder-registry.js").ControlElement} ControlElement */
/** @typedef {import("../lib/validator-registry.js").ValidationControlResult} ValidationControlResult */
/** @typedef {import("../lib/validator-registry.js").ValidationElement} ValidationElement */
/** @typedef {import("../lib/validator-registry.js").ValidationResults} ValidationResults */
/** @typedef {import("../lib/validator-registry.js").FormValidationResult} FormValidationResult */

// Add built-in validators
// eslint-disable-next-line guard-for-in,no-restricted-syntax
for (const validator in validators) {
  add(validators[validator]);
}

/**
 * @param {Element} element to get the name for
 * @returns {string} the name assigned to the element
 */
export function getName(element) {
  // @ts-ignore
  const binderName =
    // @ts-ignore
    element.bind ||
    element.getAttribute("bind") ||
    // @ts-ignore
    element.name ||
    element.getAttribute("name");
  if (!binderName) {
    console.error("No binder name found for element", element);
  }
  return binderName;
}

/**
 * @param {Element} parentElement to find child Element of
 * @returns {Array<Element>} found child Elements
 */
function getChildElements(parentElement) {
  const elements = Array.from(parentElement.querySelectorAll("*"));
  return [
    ...elements,
    ...elements
      .filter(element => !!element.shadowRoot)
      .flatMap(element => getChildElements(element))
  ];
}

/**  */
export class FormBinder extends HTMLElement {
  /** @returns {object} that is being bound to the form controls */
  get data() {
    return this._data;
  }

  /** @param {object} data to bind to the form controls. A copy of the data is taken. */
  set data(data) {
    this._data = JSON.parse(JSON.stringify(data));
    this._originalData = JSON.parse(JSON.stringify(data));
    this.updateControlValues();
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
          if (controlCandidate instanceof Element) {
            this.addControl(controlCandidate);
            getChildElements(controlCandidate).forEach(c => this.addControl(c));
          }
        });
        mutation.removedNodes.forEach(controlCandidate => {
          if (controlCandidate instanceof Element) {
            if (this.registeredControlBinders.has(controlCandidate)) {
              this.registeredControlBinders.delete(controlCandidate);
            }
            getChildElements(controlCandidate).forEach(c => {
              if (this.registeredControlBinders.has(c)) {
                this.registeredControlBinders.delete(c);
              }
            });
          }
        });
      });
    };

    this.mutationObserver = new ShadowDomMutationObserver(callback);

    this.mutationObserver.observe(this, config);

    getChildElements(this).forEach(element => this.addControl(element));
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
    /** @type {Map<Element, ControlBinding>} */
    this.registeredControlBinders = new Map();

    /** @type {Set<Element>} controls the user has interacted with */
    this._visitedControls = new Set();

    /** @type {Map<Element, any>} controls whose values have been changed by the user */
    this._dirtyControls = new Map();

    /** @type {object} */
    this._originalData = null;

    /** @type {object} */
    this.data = null;

    this._reportValidityRequested = false;
  }

  /** @typedef {Array<Array<*> & { 0: string, 1: unknown, length: 2 }>} JSONPointerValueTuple */
  /** @param {Object.<string, unknown>|Map<string, unknown>|JSONPointerValueTuple} partialData that will be used to update the current form data. Can be a partial object of a Map or JSON pointers and new values. */
  patch(partialData) {
    let jsonPointers;
    if (partialData instanceof Array) {
      jsonPointers = new Map(partialData);
    } else if (partialData instanceof Map) {
      jsonPointers = /** @type {Map<String, unknown>} */ (partialData);
    } else {
      jsonPointers = objectFlat(partialData);
    }

    const registeredControlBinders = Array.from(
      this.registeredControlBinders.entries()
    ).map(entry => ({
      name: normalize(getName(entry[0])),
      control: entry[0],
      binding: entry[1]
    }));

    // For each value, update the data and update the control
    jsonPointers.forEach((value, key) => {
      setValue(this.data, key, value);
      registeredControlBinders
        .filter(binderEntry => binderEntry.name === normalize(key))
        .forEach(binderEntry => this.updateControlValue(binderEntry.control));
    });
  }

  /** Clears the data to the initial data value set */
  reset() {
    if (this._originalData) {
      this.data = this._originalData;
    }
  }

  /** @returns {Array<Element>} controls that have been bound to the form */
  getControls() {
    return Array.from(this.registeredControlBinders.keys());
  }

  /** @param {Element} controlCandidate to bind to the form data */
  addControl(controlCandidate) {
    if (controlCandidate instanceof HTMLElement) {
      const binder = initialize(
        controlCandidate,
        this.handleControlValueChange.bind(this),
        this.controlVisited.bind(this)
      );
      if (binder) {
        this.registeredControlBinders.set(controlCandidate, binder);
        if (this.data) {
          this.updateControlValue(controlCandidate);
        }
      }
    }
  }

  /** @param {Element} control to update the value of. If control has been visited then validation is invoked. */
  updateControlValue(control) {
    const binder = this.registeredControlBinders.get(control);
    if (binder) {
      const value = getValue(this.data, getName(control));
      binder.binder.writeValue(control, value);
      if (
        this._reportValidityRequested === false &&
        this._visitedControls.has(control)
      ) {
        this._reportValidityRequested = true;
        // Run validity check as task to give custom controls chance to initialize (e.g. MWC)
        setTimeout(() => this.reportValidity());
      }
    }
  }

  /** Updates the values of all control values */
  updateControlValues() {
    this.registeredControlBinders.forEach((binder, control) => {
      this.updateControlValue(control);
    });
  }

  /**
   * @param {ControlElement} control
   * @param {any} newValue
   */
  handleControlValueChange(control, newValue) {
    const name = getName(control);
    if (newValue !== getValue(this.data, name)) {
      this._dirtyControls.set(control, newValue);
      setValue(this.data, name, newValue);
      const validationResults = this.controlVisited(control);
      const data = JSON.parse(JSON.stringify(this.data));
      this.checkValidity([control]).then(async isValid => {
        if (isValid) {
          this.dispatchEvent(
            new CustomEvent("form-binder:change", {
              detail: {
                data,
                validationResults: await validationResults
              }
            })
          );
        }
      });
    }
  }

  /**
   * @param {ControlElement} controlElement that was visited
   * @returns {Promise<FormValidationResult>} form validity result
   */
  controlVisited(controlElement) {
    this._visitedControls.add(controlElement);
    return this.reportValidity();
  }

  /**
   * @param {ValidationElement} control
   * @param {any} [value] to validate against the control. If not supplied then the value is taken from the backing data.
   * @returns {Promise<ValidationControlResult>} if valid
   */
  async validateControlValue(control, value) {
    const controlName = getName(control);
    const t = matchingValidators(control).map(validator => {
      const result = validator.validate(
        control,
        value === undefined ? getValue(this.data, controlName) : value,
        this.data
      );
      return result instanceof Promise ? result : Promise.resolve(result);
    });

    /** @type {ValidationResults} */
    const controlValidationResults = (await Promise.allSettled(t)).map(
      promiseSettled => {
        if (promiseSettled.status === "fulfilled") {
          return promiseSettled.value;
        }
        console.error(
          "Validation validator failed",
          control,
          value,
          promiseSettled.reason
        );
        return null;
      }
    );

    // Add 'field' property if missing
    controlValidationResults
      .filter(validatorResult => validatorResult !== null)
      .forEach(validatorResult => {
        if (!validatorResult.field) {
          validatorResult.field = controlName;
        }
      });

    return {
      control,
      controlValidationResults,
      visited: this._visitedControls.has(control)
    };
  }

  /**
   * @param {Array<ControlElement>} [controls] to validate. if not supplied then all controls are validated.
   * @returns {Promise<FormValidationResult>} result of the forms current validity
   */
  async validate(controls) {
    const result = await Promise.all(
      (controls || Array.from(this.registeredControlBinders.keys()))
        .map(async c => this.validateControlValue(c))
        .filter(async e => (await e).controlValidationResults.length > 0)
    );

    const errors = filterValidationResults(
      result,
      validationResult => validationResult.valid === false
    );

    return {
      result,
      errors,
      isValid: errors.length === 0
    };
  }

  /**
   * @param {Array<ControlElement>} [controls] to validate. if not supplied then all controls are validated.
   * @returns {Promise<boolean>} if the control/controls in the form are all valid
   */
  async checkValidity(controls) {
    return (await this.validate(controls)).isValid;
  }

  /**
   * @param {Array<ControlElement>} [controls] to validate. if not supplied then all controls are validated.
   * @returns {Promise<FormValidationResult>} if the control/controls in the form are all valid
   */
  async reportValidity(controls) {
    const validationResults = await this.validate(controls);
    this.reportErrors(validationResults);
    this._reportValidityRequested = false;
    return validationResults;
  }

  /** @param {FormValidationResult} validationResults that to be displayed */
  reportErrors(validationResults) {
    this.dispatchEvent(
      new CustomEvent("form-binder:report-validity", {
        bubbles: true,
        cancelable: false,
        composed: true,
        detail: validationResults
      })
    );
  }
}

window.customElements.define("form-binder", FormBinder);
