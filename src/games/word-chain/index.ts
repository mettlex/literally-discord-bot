import { addSeconds, differenceInSeconds } from "date-fns";
import { Client, Message, MessageEmbed } from "discord.js";
import pino from "pino";
import { setupGame } from "../setup";
import { checkSpell } from "./spell-checker";
import { ActiveWordChainGames } from "./types";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const prefixes = [
  "wc.",
  "wordchain.",
  "word-chain.",
  "wc .",
  "wordchain .",
  "word-chain .",
];

const activeGames: ActiveWordChainGames = {};

const secondsToJoin = 60;
const turnSeconds = [30, 25, 20, 15, 10];

const startHandler = (message: Message) => {
  const channelId = message.channel.id;
  const currentGame = activeGames[channelId];

  if (currentGame) {
    return;
  }

  activeGames[channelId] = {
    gameStartedAt: new Date(),
    joinable: true,
    userIds: [message.author.id],
    longestWord: "",
    currentUser: message.author.id,
    currentUserPassed: false,
    currentTurnWillEndAt: addSeconds(new Date(), turnSeconds[0]),
    currentWordMinLength: 3,
    currentStartingLetter: String.fromCodePoint(
      Math.floor(Math.random() * ("z".charCodeAt(0) - "a".charCodeAt(0) + 1)) +
        "a".charCodeAt(0),
    ),
  };

  const tid = setTimeout(() => {
    if (activeGames[channelId]) {
      activeGames[channelId] = {
        ...activeGames[channelId]!,
        joinable: false,
      };

      const embed = new MessageEmbed()
        .setDescription(
          // eslint-disable-next-line max-len
          `Send a message with a word following the criteria:`,
        )
        .addField(
          "Starting Letter",
          `**${activeGames[channelId]!.currentStartingLetter.toUpperCase()}**`,
        )
        .addField(
          "Minimum Word Length",
          `**${activeGames[channelId]!.currentWordMinLength}** characters`,
        )
        .addField("Time Left", `**${turnSeconds[0]}** seconds`)
        .setColor("#19b5fe");

      message.channel
        .send({ embed, content: `${message.author}` })
        .catch((e) => {
          logger.error(e);
        });
    }
    clearTimeout(tid);
  }, secondsToJoin * 1000);

  const embed = new MessageEmbed()
    .setTitle("Game Started")
    .setDescription(`${message.author} started the game.`)
    .addField(
      "How to join",
      `Send \`${prefixes[0]}${actions[1].commands[0]}\` or \`${prefixes[0]}${
        actions[1].commands[actions[1].commands.length - 1]
      }\` here in this channel to join`,
    )
    .addField("Time Left", `${secondsToJoin} seconds`)
    .setColor("#00b16a");

  message.channel.send(embed);
};

const joinHandler = (message: Message) => {
  const channelId = message.channel.id;

  if (!activeGames[channelId]?.joinable) {
    const embed = new MessageEmbed()
      .setDescription(`The game is not joinable. ${message.author}`)
      .setColor("#f62459");

    message.reply(embed).catch((e) => {
      logger.error(e);
    });

    return;
  }

  if (activeGames[channelId]) {
    activeGames[channelId] = {
      ...activeGames[channelId]!,
      userIds: [...activeGames[channelId]!.userIds, message.author.id],
    };

    const embed = new MessageEmbed()
      .setDescription(`${message.author} joined the game.`)
      .addField(
        "Time left to join",
        `${differenceInSeconds(
          addSeconds(activeGames[channelId]!.gameStartedAt, secondsToJoin),
          new Date(),
        )} seconds`,
      )
      .setColor("#00b16a");

    message.reply(embed).catch((e) => {
      logger.error(e);
    });
  }
};

const testSpell = (
  message: Message,
  commands: string[],
  messageContentWithoutPrefix: string,
) => {
  for (const command of commands) {
    if (messageContentWithoutPrefix.startsWith(command)) {
      const words = messageContentWithoutPrefix
        .toLowerCase()
        .replace(command, "")
        .split(" ");

      const lastWord = words[words.length - 1];

      if (lastWord) {
        const correct = checkSpell(lastWord);

        logger.info({ lastWord, correct });

        if (correct) {
          message.react("✅").catch((e) => {
            logger.error(e);
          });
        } else {
          message.react("❌").catch((e) => {
            logger.error(e);
          });
        }
      }

      break;
    }
  }
};

const actions = [
  {
    commands: ["start", "begin", "s"],
    handler: startHandler,
  },
  {
    commands: ["join", "enter", "j"],
    handler: joinHandler,
  },
  {
    commands: ["check", "c"],
    handler: testSpell,
  },
];

export const setupWordChainGame = (client: Client) => {
  setupGame(client, prefixes, actions);
};
