import { Client } from "discord.js";
import { Client as UNBClient } from "unb-api";
import { SlashCreator } from "slash-create";
import { prefixes } from "../config";
import { balance } from "./handlers/balance";
import { checkPermission } from "./unb";
import { setCashReward } from "./handlers/wc-reward";

const actions = [
  {
    commands: ["bal", "balance"],
    handler: balance,
  },
  {
    commands: ["wcr", "wcreward", "wc-reward", "word-chain-reward"],
    handler: setCashReward,
  },
];

export const setupEconomy = (client: Client, creator: SlashCreator) => {
  const unbclient = new UNBClient(process.env.UNBELIEVABOAT_API_TOKEN || "");

  client.on("message", async (message) => {
    if (
      message.author.bot ||
      !prefixes.find((p) => message.content.toLowerCase().startsWith(p)) ||
      !message.guild
    ) {
      return;
    }

    const permission = await checkPermission(unbclient, message.guild.id);

    if (!permission) {
      return;
    }

    let messageWithoutPrefix = "";

    for (const p of prefixes) {
      if (message.content.startsWith(p)) {
        messageWithoutPrefix = message.content.replace(p, "");
      }
    }

    const words = messageWithoutPrefix.split(" ").filter((x) => x);

    for (const action of actions) {
      const commands = action.commands;

      for (const command of commands) {
        if (words[0]?.toLowerCase() === command) {
          action.handler(unbclient, message);
          return;
        }
      }
    }
  });
};
