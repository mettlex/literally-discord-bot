import { oneLine } from "common-tags";
import { Message, MessageEmbed } from "discord.js";
import { Client } from "unb-api";
import { flatColors } from "../../games/word-chain/config";
import { getUser } from "../unb";

export const balance = async (client: Client, message: Message) => {
  if (!message.guild) {
    return;
  }

  const user = await getUser(client, message.guild.id, message.author.id);

  if (!user) {
    return;
  }

  const guild = await client.getGuild(message.guild.id);

  message.reply(
    new MessageEmbed().setColor(flatColors.blue).setTitle("User Balance")
      .setDescription(oneLine`
      ${message.author}'s cash balance:
      **${guild.currencySymbol}${user.cash.toLocaleString()}**
  `),
  );
};
