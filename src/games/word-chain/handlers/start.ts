import { differenceInMilliseconds } from "date-fns";
import { Message, MessageEmbed } from "discord.js";
import pino from "pino";
import { actions, getAllActiveGames, getCurrentGame } from "..";
import { shuffleArray } from "../../../utils/array";
import { prefixes, secondsToJoin, turnSeconds, flatColors } from "../config";
import { checkSpell } from "../spell-checker";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const changeTurn = async (message: Message, timeLeft?: number) => {
  const channelId = message.channel.id;
  const activeGames = getAllActiveGames();

  let currentGame = getCurrentGame(channelId);

  if (!currentGame) {
    return;
  }

  if (currentGame.userIds.length === 1) {
    activeGames[channelId] = undefined;

    const winnerUserId = currentGame.userIds[0];

    const winner = message.client.users.cache.get(winnerUserId);

    const embed = new MessageEmbed()
      .setTitle("Congrats! We have a winner!")
      .setDescription(
        "All other players are eliminated so the last player wins!",
      )
      .addField("Winner", `<@${winnerUserId}>`)
      .setColor(flatColors.green);

    if (winner) {
      embed.setThumbnail(
        winner.avatarURL({ dynamic: true }) || winner.defaultAvatarURL,
      );
    }

    if (currentGame.longestWord) {
      embed.addField("Longest Word", currentGame.longestWord);
    }

    message.channel.send({ embed }).catch((e) => {
      logger.error(e);
    });

    return;
  }

  if (!timeLeft) {
    const embed1 = new MessageEmbed()
      .setDescription(`Send a message with a word following the criteria:`)
      .addField(
        "Starting Letter",
        `**${currentGame.currentStartingLetter.toUpperCase()}**`,
      )
      .addField(
        "Minimum Word Length",
        `**${currentGame.currentWordMinLength}** characters`,
      )
      .addField("Time Left", `**${turnSeconds[0]}** seconds`)
      .setColor(flatColors.blue);

    message.channel
      .send({ embed: embed1, content: `<@${currentGame.currentUser}>` })
      .catch((e) => {
        logger.error(e);
      });
  }

  const filter = (m: Message) =>
    m.author.id === currentGame!.currentUser && /^\w/gi.test(m.content);

  const time = timeLeft || turnSeconds[currentGame.roundIndex] * 1000;

  const waitingStartTime = new Date();

  const messageCollection = await message.channel.awaitMessages(filter, {
    time,
    max: 1,
  });

  const currentPlayerMessage = messageCollection.first();

  if (!currentPlayerMessage) {
    const embed2 = new MessageEmbed()
      .setTitle("Time Out!")
      .setDescription(
        // eslint-disable-next-line max-len
        `<@${currentGame.currentUser}> couldn't send a word within ${turnSeconds[0]} seconds.`,
      )
      .addField("Eliminated Player", `<@${currentGame.currentUser}>`)
      .setColor(flatColors.red);

    activeGames[channelId]!.userIds.splice(0, 1);

    activeGames[channelId] = {
      ...currentGame,
      currentUser: currentGame.userIds[0],
    };

    currentGame = activeGames[channelId]!;

    logger.info(currentGame);

    embed2.addField("Next Player", `<@${currentGame.currentUser}>`);

    message.channel.send(embed2).catch((e) => {
      logger.error(e);
    });

    await changeTurn(message);

    return;
  }

  if (
    !currentPlayerMessage.content
      .toLowerCase()
      .startsWith(currentGame.currentStartingLetter.toLowerCase()) ||
    currentPlayerMessage.content.length < currentGame.currentWordMinLength ||
    !checkSpell(currentPlayerMessage.content.split(" ")[0])
  ) {
    const elapsedTime = differenceInMilliseconds(new Date(), waitingStartTime);
    const newTimeLeft = time - elapsedTime;

    const embed3 = new MessageEmbed()
      .setDescription(
        `**__${currentPlayerMessage.content
          .split(" ")[0]
          .toUpperCase()}__** is incorrect.
        \nSend a message with a word following the criteria:`,
      )
      .addField(
        "Starting Letter",
        `**${currentGame.currentStartingLetter.toUpperCase()}**`,
      )
      .addField(
        "Minimum Word Length",
        `**${currentGame.currentWordMinLength}** characters`,
      )
      .addField("Time Left", `**${Math.floor(newTimeLeft / 1000)}** seconds`)
      .setColor(flatColors.red);

    message.channel
      .send({ embed: embed3, content: `<@${currentGame.currentUser}>` })
      .catch((e) => {
        logger.error(e);
      });

    if (newTimeLeft <= 0) {
      const embed2 = new MessageEmbed()
        .setTitle("Time Out!")
        .setDescription(
          // eslint-disable-next-line max-len
          `<@${currentGame.currentUser}> couldn't send a word within ${turnSeconds[0]} seconds.`,
        )
        .addField("Eliminated Player", `<@${currentGame.currentUser}>`)
        .setColor(flatColors.red);

      activeGames[channelId]!.userIds.splice(0, 1);

      activeGames[channelId] = {
        ...currentGame,
        currentUser: currentGame.userIds[0],
      };

      currentGame = activeGames[channelId]!;

      logger.info(currentGame);

      embed2.addField("Next Player", `<@${currentGame.currentUser}>`);

      message.channel.send(embed2).catch((e) => {
        logger.error(e);
      });

      await changeTurn(message);

      return;
    }

    await changeTurn(message, newTimeLeft);
  }
};

const startHandler = (message: Message) => {
  const activeGames = getAllActiveGames();

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
    currentWordMinLength: 3,
    currentStartingLetter: String.fromCodePoint(
      Math.floor(Math.random() * ("z".charCodeAt(0) - "a".charCodeAt(0) + 1)) +
        "a".charCodeAt(0),
    ),
    roundIndex: 0,
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
    .setTitle("Starting Word-Chain Game!")
    .setDescription(`${message.author} has requested you to join the game.`)
    .addField(
      "How to join",
      `Send \`${prefixes[0]}${actions[1].commands[0]}\` or \`${prefixes[0]}${
        actions[1].commands[actions[1].commands.length - 1]
      }\` here in this channel to join`,
    )
    .addField("Time Left", `${secondsToJoin} seconds`)
    .setColor(flatColors.green);

  message.channel.send(embed).catch((e) => {
    logger.error(e);
  });
};

export default startHandler;
