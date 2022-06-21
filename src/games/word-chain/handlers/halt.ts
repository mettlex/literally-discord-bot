import { ColorResolvable, Message, MessageEmbed } from "discord.js";
import { getAllActiveGames, getCurrentGame } from "..";
import { flatColors } from "../../../config";

const haltHanlder = (message: Message) => {
  if (!message.member?.permissions.has("MANAGE_GUILD")) {
    const embed = new MessageEmbed();

    embed
      .setDescription("Only server managers can halt a running game.")
      .setColor(flatColors.red as ColorResolvable);

    message.channel.send({ embeds: [embed], content: `${message.author}` });

    return;
  }

  const channelId = message.channel.id;

  const currentGame = getCurrentGame(channelId);

  if (!currentGame) {
    const embed = new MessageEmbed();

    embed
      .setDescription("There is no running game.")
      .setColor(flatColors.red as ColorResolvable);

    message.channel.send({ embeds: [embed], content: `${message.author}` });

    return;
  }

  const activeGames = getAllActiveGames();

  activeGames[channelId] = undefined;

  const embed = new MessageEmbed();

  embed
    .setTitle("Word-Chain Game Stopped!")
    .setDescription(`The running game has been stopped by ${message.author}.`)
    .setColor(flatColors.green as ColorResolvable);

  message.channel.send({ content: "​", embeds: [embed] }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
  });
};

export default haltHanlder;
