import { stripIndents } from "common-tags";
import {
  ColorResolvable,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} from "discord.js";
import { actions, getAllActiveGames } from "..";
import { shuffleArray } from "../../../utils/array";
import { prefixes, secondsToJoin } from "../config";
import { flatColors } from "../../../config";
import { changeTurn } from "../game-loop";
import { WordChainGameMode } from "../types";

export const args: {
  [key: string]: WordChainGameMode | undefined;
} = {
  noob: "Noob",
  casual: "Casual",
  challenge: "Challenge",
  ["banned letters"]: "Banned Letters",
  bl: "Banned Letters",
};

const startHandler = (message: Message) => {
  const joinAction = actions.find((a) => a.commands.includes("join"))!;

  const activeGames = getAllActiveGames();

  const channelId = message.channel.id;
  const currentGame = activeGames[channelId];

  if (currentGame) {
    return;
  }

  const lastWord = message.content.split(" ").slice(-1)[0];

  const mode =
    args[lastWord.toLowerCase()] ||
    (message.content.toLowerCase().endsWith("banned letters") &&
      "Banned Letters");

  if (!mode) {
    const channel = message.channel;

    const buttons = Array.from(new Set(Object.values(args)))
      .map(
        (b) =>
          b &&
          new MessageButton()
            .setStyle("PRIMARY")
            .setCustomId(
              `wc_start_${
                Object.entries(args).find(([_key, value]) => value === b)![0]
              }_${message.id}`,
            )
            .setLabel(b),
      )
      .filter((b) => b) as MessageButton[];

    const row = new MessageActionRow().addComponents(buttons);

    channel
      .send({
        content: "**Select a game mode**",
        components: [row],
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    return;
  }

  // prettier-ignore
  const maxLives =
    mode === "Casual"
      ? 2:
      mode === "Noob" || mode === "Banned Letters"
        ? 3
        : 1;

  activeGames[channelId] = {
    gameStartedAt: new Date(),
    joinable: true,
    userIds: [message.author.id],
    longestWord: "",
    longestWordUserId: "",
    currentUser: message.author.id,
    currentWordMinLength: mode === "Casual" ? 4 : mode === "Challenge" ? 5 : 3,
    currentStartingLetter: String.fromCodePoint(
      Math.floor(Math.random() * ("z".charCodeAt(0) - "a".charCodeAt(0) + 1)) +
        "a".charCodeAt(0),
    ),
    roundIndex: 0,
    usedWords: [],
    reduce: false,
    mode,
    maxLives,
    playerLives: {
      [message.author.id]: maxLives,
    },
    bannedLetters: [],
    shouldAddBannedLetter: false,
  };

  if (mode === "Banned Letters") {
    const codeForA = "a".charCodeAt(0);

    const letters = new Array(26)
      .fill(null)
      .map((_, i) => String.fromCharCode(codeForA + i));

    const lettersToBan = letters.filter(
      (l) => l !== activeGames[channelId]!.currentStartingLetter,
    );

    const bannedLetterIndex = Math.floor(Math.random() * lettersToBan.length);

    activeGames[channelId] = {
      ...activeGames[channelId]!,
      bannedLetters: [lettersToBan[bannedLetterIndex]],
    };
  }

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
          .setColor(flatColors.red as ColorResolvable);

        message.channel.send({ content: "​", embeds: [embed1] }).catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
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
        .setColor(flatColors.green as ColorResolvable);

      message.channel.send({ content: "​", embeds: [embed1] }).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
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
    .addField("Mode", activeGames[channelId]!.mode, true);

  if (mode === "Banned Letters") {
    embed.addField(
      mode,
      activeGames[channelId]!.bannedLetters.map(
        (l) => `${l.toUpperCase()} / ${l.toLowerCase()}`,
      ).join(", "),
      true,
    );
  }

  embed
    .addField("Max Lives", `${activeGames[channelId]!.maxLives}`, true)
    .addField(
      "How to join",
      `Send \`${prefixes[0]}${joinAction.commands[0]}\` or \`${prefixes[0]}${
        joinAction.commands[joinAction.commands.length - 1]
      }\` here in this channel or tap on the button below to join.`,
    )
    .addField("Time Left", `${secondsToJoin} seconds`)
    .setColor(flatColors.yellow as ColorResolvable);

  const channel = message.channel;

  const row = new MessageActionRow();

  row.addComponents(
    new MessageButton()
      .setStyle("PRIMARY")
      .setLabel("Yes! Join Game!")
      .setCustomId("join_word_chain"),
  );

  channel
    .send({
      content: "​",
      embeds: [embed],
      components: [row],
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
};

export default startHandler;
