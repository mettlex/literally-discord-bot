import { Message } from "discord.js";
import { setGuildConfig } from "../config";

export const autoAppendMessage = (message: Message) => {
  if (!message.guild || !message.member?.permissions.has("MANAGE_GUILD")) {
    return;
  }

  let success = false;

  if (message.content.toLowerCase().endsWith("on")) {
    success = setGuildConfig(message.guild.id, {
      wcAutoAppendMessage: true,
    });
  } else if (message.content.toLowerCase().endsWith("off")) {
    success = setGuildConfig(message.guild.id, {
      wcAutoAppendMessage: false,
    });
  }

  if (success) {
    message.react("✅").catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
  } else {
    message.react("❌").catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
  }
};
