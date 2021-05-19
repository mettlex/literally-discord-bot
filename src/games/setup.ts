import { Client, Message } from "discord.js";
import pino from "pino";
import { Action } from "./types";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

export const setupGame = (
  client: Client,
  prefixes: string[],
  actions: Action[],
  messageHandlers?: ((message: Message) => void)[],
) => {
  client.on("message", (message) => {
    if (message.author.bot) {
      return;
    }

    if (message.channel.type !== "text") {
      return;
    }

    if (
      !prefixes.find((prefix) =>
        message.content.toLowerCase().startsWith(prefix.toLowerCase()),
      )
    ) {
      return;
    }

    let startsWithPrefix = false;
    let messageContentWithoutPrefix = "";

    for (const prefix of prefixes) {
      if (message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
        startsWithPrefix = true;

        const regexp = new RegExp(`^${prefix}`, "gi");

        messageContentWithoutPrefix = message.content
          .replace(regexp, "")
          .trim();

        break;
      }
    }

    if (!startsWithPrefix) {
      return;
    }

    logger.info(
      `${message.author.tag} (${message.author.id}): ${message.content}`,
    );

    for (const action of actions) {
      const match = new RegExp(`^(${action.commands.join("|")})`, "gi").test(
        messageContentWithoutPrefix,
      );

      if (match) {
        action.handler(message, action.commands, messageContentWithoutPrefix);
        break;
      }
    }
  });

  if (messageHandlers instanceof Array) {
    for (const handler of messageHandlers) {
      client.on("message", handler);
    }
  }
};
