import { addSeconds, differenceInSeconds } from "date-fns";
import { Message, MessageEmbed } from "discord.js";
import pino from "pino";
import { prefixes, secondsToJoin, flatColors } from "../config";
import { actions, getAllActiveGames } from "..";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const joinHandler = (message: Message) => {
  const joinAction = actions.find((a) => a.commands.includes("join"))!;

  const channelId = message.channel.id;

  const activeGames = getAllActiveGames();

  if (!activeGames[channelId]?.joinable) {
    const embed = new MessageEmbed()
      .setDescription(`The game is not joinable. ${message.author}`)
      .setColor(flatColors.red);

    message.reply(embed).catch((e) => {
      logger.error(e);
    });

    return;
  }

  if (activeGames[channelId]) {
    if (activeGames[channelId]!.userIds.includes(message.author.id)) {
      return;
    }

    activeGames[channelId] = {
      ...activeGames[channelId]!,
      userIds: [...activeGames[channelId]!.userIds, message.author.id],
      playerLives: {
        ...activeGames[channelId]!.playerLives,
        [message.author.id]: activeGames[channelId]!.maxLives,
      },
    };

    const embed = new MessageEmbed()
      .setDescription(`${message.author} joined the game.`)
      .addField(
        "How to join",
        `Send \`${prefixes[0]}${joinAction.commands[0]}\` or \`${prefixes[0]}${
          joinAction.commands[joinAction.commands.length - 1]
        }\` here in this channel to join`,
      )
      .addField(
        "Time left to join",
        `${differenceInSeconds(
          addSeconds(activeGames[channelId]!.gameStartedAt, secondsToJoin),
          new Date(),
        )} seconds`,
      )
      .setColor(flatColors.green);

    message.reply(embed).catch((e) => {
      logger.error(e);
    });
  }
};

export default joinHandler;
