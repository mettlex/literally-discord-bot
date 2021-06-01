import { Message } from "discord.js";
import { writeFileSync } from "fs";
import path from "path";
import { Client } from "unb-api";
import { UNBServerConfig } from "../unb/types";

const filePath = path.resolve(__dirname, "..", "unb", "server-config.json");

export const setCashReward = async (_client: Client, message: Message) => {
  if (!message.guild) {
    return;
  }

  // eslint-disable-next-line max-len
  let config: UNBServerConfig = require(filePath);

  const amount = parseInt(message.content.split(" ").splice(-1)[0]);

  if (isNaN(amount)) {
    const cash = config[message.guild.id]?.wcWinReward?.cash;

    if (typeof cash !== "undefined") {
      message.reply(`Word-Chain Game Win Reward: **${cash}**`);
    }

    return;
  }

  if (!config) {
    config = {};
  }

  config[message.guild.id] = {
    wcWinReward: {
      cash: amount,
    },
  };

  try {
    writeFileSync(filePath, JSON.stringify(config, null, 2), {
      encoding: "utf-8",
    });

    await message.react("✅️");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};
