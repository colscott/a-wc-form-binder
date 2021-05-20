import { LitElement, html, css } from "lit-element";
import { data } from "a-wc-form-binder/demo/mock.js";
import {
  controlBinder as binder,
  controlBinders as binders,
  formCss
} from "a-wc-form-binder";
import "a-wc-form-layout";
import { schema, layout } from "./mock.js";
import "../src/components/json-schema-form.js";
import "../src/components/json-schema-control.js";

binder.add(...Object.values(binders));

customElements.define(
  "test-json-ui-schema",
  class extends LitElement {
    /** @inheritdoc */
    static get styles() {
      return [
        css`
          :host {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          :invalid {
            border: 1px solid red;
          }
        `,
        ...formCss.allCss
      ];
    }

    /** @inheritdoc */
    static get properties() {
      return {
        data: { type: Object }
      };
    }

    /** @inheritdoc */
    constructor() {
      super();
      this.data = data;
    }

    /** @inheritdoc */
    render() {
      return html`
        <section class="examples">
          <h2>json-schema-control</h2>
          <br />
          <form-binder
            @form-binder:change=${e => {
              this.data = e.detail.data;
              this.requestUpdate();
            }}
            .data=${this.data}
          >
            <json-schema-control
              .schema=${schema}
              ref="#"
            ></json-schema-control> </form-binder
          ><br />

          <h2>json-schema-form</h2>
          <br />
          <form-layout
            @form-binder:change=${e => {
              this.data = e.detail.data;
              this.requestUpdate();
            }}
            .data=${this.data}
            .layout=${layout}
          ></form-layout
          ><br />

          <h2>json-schema-control</h2>
          <br />
          <form-binder
            @form-binder:change=${e => {
              this.data = e.detail.data;
              this.requestUpdate();
            }}
            .data=${this.data}
          >
            <json-schema-control
              .schema=${schema}
              ref="/name"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/vegetarian"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/postalCode"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/personalData"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/personalData/age"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/comments"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/comments/1/date"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/telephoneNumbers"
            ></json-schema-control>
            <json-schema-control
              .schema=${schema}
              ref="/telephoneNumbers/1"
            ></json-schema-control>
          </form-binder>
        </section>
        <section class="data">
          <pre>${JSON.stringify(this.data, null, 2)}</pre>
        </section>
      `;
    }
  }
);
