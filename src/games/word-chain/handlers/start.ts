import { stripIndents } from "common-tags";
import { Message, MessageEmbed } from "discord.js";
import pino from "pino";
import { actions, getAllActiveGames } from "..";
import { shuffleArray } from "../../../utils/array";
import { prefixes, secondsToJoin, flatColors } from "../config";
import { changeTurn } from "../game-loop";
import { WordChainGameLevel } from "../types";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const startHandler = (message: Message) => {
  const activeGames = getAllActiveGames();

  const channelId = message.channel.id;
  const currentGame = activeGames[channelId];

  if (currentGame) {
    return;
  }

  const lastWord = message.content.split(" ").slice(-1)[0];

  let level: WordChainGameLevel;

  if (lastWord.toLowerCase() === "noob") {
    level = "Noob";
  } else if (lastWord.toLowerCase() === "challenge") {
    level = "Challenge";
  } else {
    level = "Casual";
  }

  const maxLives = level === "Noob" ? 3 : level === "Casual" ? 2 : 1;

  activeGames[channelId] = {
    gameStartedAt: new Date(),
    joinable: true,
    userIds: [message.author.id],
    longestWord: "",
    longestWordUserId: "",
    currentUser: message.author.id,
    currentWordMinLength: 3,
    currentStartingLetter: String.fromCodePoint(
      Math.floor(Math.random() * ("z".charCodeAt(0) - "a".charCodeAt(0) + 1)) +
        "a".charCodeAt(0),
    ),
    roundIndex: 0,
    usedWords: [],
    reduce: false,
    level,
    maxLives,
    playerLives: {
      [message.author.id]: maxLives,
    },
  };

  const tid = setTimeout(async () => {
    if (activeGames[channelId]) {
      shuffleArray(activeGames[channelId]!.userIds);

      activeGames[channelId] = {
        ...activeGames[channelId]!,
        currentUser: activeGames[channelId]!.userIds[0],
        joinable: false,
      };

      const currentGame = activeGames[channelId]!;

      if (currentGame.userIds.length < 2) {
        const embed1 = new MessageEmbed()
          .setTitle("Word-Chain Game Ended!")
          .setDescription(
            "No one else joined the game within the time limit. :(",
          )
          .setColor(flatColors.red);

        message.channel.send({ embed: embed1 }).catch((e) => {
          logger.error(e);
        });

        activeGames[channelId] = undefined;

        clearTimeout(tid);

        return;
      }

      const embed1 = new MessageEmbed()
        .setTitle("Word-Chain Game Started!")
        .setDescription(
          "The players will take turn according to the turn-order below.",
        )
        .addField(
          "Turn Order",
          `${currentGame.userIds.map((uid) => `<@${uid}>`).join(", ")}`,
        )
        .setColor(flatColors.green);

      message.channel.send({ embed: embed1 }).catch((e) => {
        logger.error(e);
      });

      await changeTurn(message);
    }

    clearTimeout(tid);
  }, secondsToJoin * 1000);

  const embed = new MessageEmbed()
    .setTitle("Join Word-Chain Game!")
    .setDescription(
      stripIndents`${message.author} is starting a word-chain game.
      You may join to start playing together.`,
    )
    .addField("Mode", activeGames[channelId]!.level, true)
    .addField("Max Lives", `${activeGames[channelId]!.maxLives}`, true)
    .addField(
      "How to join",
      `Send \`${prefixes[0]}${actions[2].commands[0]}\` or \`${prefixes[0]}${
        actions[2].commands[actions[2].commands.length - 1]
      }\` here in this channel to join`,
    )
    .addField("Time Left", `${secondsToJoin} seconds`)
    .setColor(flatColors.yellow);

  message.channel.send(embed).catch((e) => {
    logger.error(e);
  });
};

export default startHandler;
