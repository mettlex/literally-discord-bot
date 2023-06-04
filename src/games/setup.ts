import { ChannelType, Client, Message } from "discord.js";
import pino from "pino";
import { Action } from "./types";

const logger = pino();

export const setupGame = (
  client: Client,
  prefixes: string[],
  actions: Action[],
  messageHandlers?: ((message: Message) => void)[],
) => {
  client.on("messageCreate", (message) => {
    if (message.author.bot) {
      return;
    }

    if (message.channel.type !== ChannelType.GuildText) {
      return;
    }

    if (message.content.includes(client.user!.id)) {
      const pattern = new RegExp(`<@${client.user!.id}>`, "g");
      message.content = message.content.replace(pattern, "").trim();
      message.mentions.users = message.mentions.users.filter(
        (user) => user.id !== client.user!.id,
      );
    }

    if (message.content.trim().length === 0) {
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
      client.on("messageCreate", handler);
    }
  }
};
