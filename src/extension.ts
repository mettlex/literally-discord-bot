import {
  APIMessage,
  APIMessageContentResolvable,
  MessageAdditions,
  MessageOptions,
  Structures,
  WebhookMessageOptions,
} from "discord.js";
import { ComponentButton } from "slash-create";

export interface ActionRowComponent {
  components: ComponentButton[];
}

interface ActionRowComponentWithType extends ActionRowComponent {
  type: 1;
}

interface ParamsForSendWithComponents {
  content: APIMessageContentResolvable;

  components: ActionRowComponent[];

  options?: MessageOptions | MessageAdditions | WebhookMessageOptions;
}

const addComponentsToAPIMessage = (components: ActionRowComponent[]) =>
  class ExtendedAPIMessage extends APIMessage {
    resolveData() {
      if (this.data) {
        return this;
      }

      super.resolveData();

      const actionRows: ActionRowComponentWithType[] = components.map((c) => ({
        type: 1,
        ...c,
      }));

      Object.assign(this.data, {
        components: actionRows,
      });

      return this;
    }
  };

export class ExtendedTextChannel extends Structures.get("TextChannel") {
  sendWithComponents({
    content,
    options,
    components,
  }: ParamsForSendWithComponents) {
    return this.send(
      addComponentsToAPIMessage(components)
        .create(this, content, options || {})
        .resolveData(),
    );
  }
}

Structures.extend("TextChannel", () => ExtendedTextChannel);

export class ExtendedDMChannel extends Structures.get("DMChannel") {
  sendWithComponents({
    content,
    options,
    components,
  }: ParamsForSendWithComponents) {
    return this.send(
      addComponentsToAPIMessage(components)
        .create(this, content, options || {})
        .resolveData(),
    );
  }
}

Structures.extend("DMChannel", () => ExtendedDMChannel);
