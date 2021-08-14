/* eslint-disable no-unused-expressions */
/* global describe, before, after, afterEach, it */
import "@material/mwc-textfield";
import "@material/mwc-slider";
import "@material/mwc-switch";
import {
  controlBinder as binder,
  controlValidator as validator,
  controlValidators as validators
} from "a-wc-form-binder";
import { expect } from "@esm-bundle/chai/esm/chai.js";
import { data as mockData } from "a-wc-form-binder/demo/mock.js";
import { controlBinders as binders } from "a-wc-form-binders-mwc";

/** @returns {import('../../../src/components/form-binder.js').FormBinder} */
async function createFormBinder() {
  const data = JSON.parse(JSON.stringify(mockData));
  const formBinder = document.createElement("form-binder");
  formBinder.data = data;
  document.body.appendChild(formBinder);
  formBinder.innerHTML = `
  <mwc-textfield id="name" required pattern="Fred.*" type="text" name="#/name"></mwc-textfield>
  <mwc-textfield id="age" min="18" max="65" type="number" name="#/personalData/age"></mwc-textfield>
  <mwc-textfield id="tel" name="#/telephoneNumbers/1"></mwc-textfield>
  <mwc-textfield id="message" name="#/comments/1/message"></mwc-textfield>
  <mwc-switch id="student" name="#/student"></mwc-switch>
  <mwc-checkbox id="vegetarian2" name="#/student"></mwc-checkbox>
  `;
  const changes = { data };
  formBinder.addEventListener("form-binder:change", e => {
    changes.data = e.detail.data;
  });
  await formBinder.updateComplete;
  return { formBinder, changes };
}

/** @param {string} controlId . */
function getControl(controlId) {
  return document.getElementById(controlId);
}

/**
 * @param {string} controlId
 * @param {string} value
 */
function inputValue(controlId, value) {
  const controlElement = getControl(controlId).shadowRoot.querySelector(
    "input"
  );
  if (typeof value === "boolean") {
    controlElement.checked = value;
  } else {
    controlElement.value = value;
  }
  controlElement.dispatchEvent(new Event("input"));
  getControl(controlId).dispatchEvent(new Event("change"));
}

describe("form-binder binding tests", () => {
  before(() => {
    binder.add(...Object.values(binders));
  });
  after(() => {
    binder.remove(...Object.values(binders));
  });
  afterEach(() => {
    document
      .querySelectorAll("form-binder")
      .forEach(e => e.parentElement.removeChild(e));
  });
  it("Should populate controls", async () => {
    await createFormBinder();
    expect(document.getElementById("name").value).to.equal("Johnny Five");
    expect(document.getElementById("age").value).to.equal("34");
    expect(document.getElementById("tel").value).to.equal("123-8901234");
    expect(document.getElementById("message").value).to.equal("Thdsdfsdfsdf");
    expect(document.getElementById("student").checked).to.be.true;
    expect(document.getElementById("vegetarian2").checked).to.be.true;
  });
  it("Should not change value when invalid", async () => {
    const { formBinder, changes } = await createFormBinder();
    validator.add(validators.patternValidator, true);
    validator.add(validators.maxValidator, true);
    inputValue("name", "Bert");
    inputValue("age", "300");
    await formBinder.updateComplete;
    expect(changes.data.name).to.equal("Johnny Five");
    expect(changes.data.personalData.age).to.equal(34);
    validator.remove(validators.patternValidator);
    validator.remove(validators.maxValidator);
    inputValue("name", "Fred");
    inputValue("age", "20");
    expect(changes.data.name).to.equal("Fred");
    getControl("student")
      .shadowRoot.querySelector("input")
      .click();
    await getControl("name").updateComplete;
    await formBinder.updateComplete;
    expect(changes.data.name).to.equal("Fred");
    expect(changes.data.personalData.age).to.equal(20);
    expect(changes.data.student).to.be.false;
  });
  it("Should reflect changes to data", async () => {
    const { formBinder, changes } = await createFormBinder();
    const dataCopy = JSON.parse(JSON.stringify(changes.data));
    dataCopy.name = "fred123";
    dataCopy.personalData.age = 62;
    dataCopy.student = false;
    formBinder.data = dataCopy;
    await formBinder.updateComplete;
    expect(document.getElementById("name").value).to.equal("fred123");
    expect(document.getElementById("age").value).to.equal("62");
    expect(document.getElementById("student").checked).to.be.false;
  });
});
