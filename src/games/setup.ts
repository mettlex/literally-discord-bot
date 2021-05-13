import { Client } from "discord.js";
import pino from "pino";
import { Action } from "./types";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

export const setupGame = (
  client: Client,
  prefixes: string[],
  actions: Action[],
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
        message.content.toLowerCase().startsWith(prefix),
      )
    ) {
      return;
    }

    let startsWithPrefix = false;
    let messageContentWithoutPrefix = "";

    for (const prefix of prefixes) {
      if (message.content.toLowerCase().startsWith(prefix)) {
        startsWithPrefix = true;

        messageContentWithoutPrefix = message.content
          .replace(prefix, "")
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
      const match = new RegExp(`^(${action.commands.join("|")})`).test(
        messageContentWithoutPrefix,
      );

      if (match) {
        action.handler(message, action.commands, messageContentWithoutPrefix);
        break;
      }
    }
  });
};
