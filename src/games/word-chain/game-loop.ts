import { oneLine, stripIndents } from "common-tags";
import { differenceInMilliseconds, differenceInSeconds } from "date-fns";
import { Message, MessageEmbed } from "discord.js";
import pino from "pino";
import { getAllActiveGames, getCurrentGame } from ".";
import {
  mediumTurnSeconds,
  easyTurnSeconds,
  hardTurnSeconds,
  getGuildConfig,
} from "./config";
import { flatColors } from "../../config";
import { checkSpell } from "./spell-checker";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

export const changeTurn = async (message: Message, timeLeft?: number) => {
  const channelId = message.channel.id;
  const activeGames = getAllActiveGames();

  let currentGame = getCurrentGame(channelId);

  if (!currentGame) {
    return;
  }

  // prettier-ignore
  const turnSeconds: number[] =
    currentGame.mode === "Casual"
      ? mediumTurnSeconds
      : currentGame.mode === "Noob"
        ? easyTurnSeconds
        : currentGame.mode === "Challenge"
          ? hardTurnSeconds
          : [45];

  const currentGameTurnSeconds =
    turnSeconds[currentGame.roundIndex] || turnSeconds[turnSeconds.length - 1];

  if (currentGame.userIds.length === 1) {
    logger.info(currentGame);

    const winnerUserId = currentGame.userIds[0];

    // const winner = message.client.users.cache.get(winnerUserId);

    const winner = await message.client.users.fetch(winnerUserId, {
      cache: false,
    });

    const embed = new MessageEmbed()
      .setTitle("Congrats! We have a winner!")
      .setDescription(
        "All other players are eliminated so the last player wins!",
      )
      .addField("Winner", `<@${winnerUserId}>`)
      .setColor(flatColors.green);

    if (winner) {
      logger.info(winner);

      embed.setThumbnail(
        winner.avatarURL({ dynamic: true }) || winner.defaultAvatarURL,
      );
    }

    if (currentGame.longestWord) {
      embed.addField(
        "Longest Word",
        `${currentGame.longestWord} <@${currentGame.longestWordUserId}>`,
      );
    }

    message.channel.send({ embeds: [embed] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    activeGames[channelId] = undefined;
    currentGame = undefined;

    return;
  }

  let interval;

  if (!timeLeft) {
    const embed1 = new MessageEmbed()
      .setDescription(
        `Send a message with an English word following the criteria:`,
      )
      .addField(
        "Starting Letter",
        `**${currentGame.currentStartingLetter.toUpperCase()}**`,
        true,
      )
      .addField(
        "Minimum Word Length",
        `**${currentGame.currentWordMinLength}** characters`,
        true,
      );

    if (currentGame.mode === "Banned Letters") {
      embed1.addField(
        currentGame.mode,
        activeGames[channelId]!.bannedLetters.map((l) => l.toUpperCase()).join(
          ", ",
        ),
        true,
      );
    }

    embed1
      .addField("Time Left", `**${currentGameTurnSeconds}** seconds`)
      .setColor(flatColors.blue);

    const currentPlayerLives = currentGame.playerLives[currentGame.currentUser];

    const livesText =
      currentPlayerLives > 1
        ? `${currentPlayerLives} lives`
        : `${currentPlayerLives} life`;

    let criteriaMessage = await message.channel
      .send({
        embeds: [embed1],
        content: `<@${currentGame.currentUser}>, you have ${livesText} left.`,
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    if (!criteriaMessage) {
      return;
    }

    const oldTime = new Date();

    const interval1 = setInterval(async () => {
      if (!message.guild || !criteriaMessage) {
        clearInterval(interval1);
        return;
      }

      const newTime = new Date();

      const turnSecondsLeft =
        currentGameTurnSeconds - differenceInSeconds(newTime, oldTime);

      const currentGame = getCurrentGame(channelId);

      if (turnSecondsLeft <= 3 || !currentGame) {
        clearInterval(interval1);
      }

      const embed = criteriaMessage.embeds[0];

      const i = embed.fields.findIndex((f) => f.name === "Time Left");

      embed.fields[i] = {
        name: "Time Left",
        value: `**${turnSecondsLeft}** seconds`,
        inline: false,
      };

      const guildConfig = getGuildConfig(message.guild.id);

      if (guildConfig?.wcAutoAppendMessage === true) {
        const latestMessage = await message.channel.messages
          .fetch({ limit: 1 })
          .then((messages) => messages.first())
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
            return undefined;
          });

        if (
          latestMessage?.author.id !== criteriaMessage.author.id &&
          latestMessage?.author.id !== activeGames[channelId]!.currentUser
        ) {
          const oldMessage = criteriaMessage;

          criteriaMessage = await message.channel
            .send({ embeds: [embed], content: criteriaMessage.content })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });

          oldMessage.delete();

          return;
        }
      }

      criteriaMessage
        .edit({ embeds: [embed], content: criteriaMessage.content })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    }, 3000);

    interval = interval1;
  }

  const filter = (m: Message) =>
    m.author.id === currentGame!.currentUser && /^\w/gi.test(m.content);

  const time = (timeLeft || currentGameTurnSeconds * 1000) + 1000;

  const waitingStartTime = new Date();

  const messageCollection = await message.channel.awaitMessages({
    filter,
    time,
    max: 1,
  });

  try {
    interval && clearInterval(interval);
  } catch (error) {
    logger.error(error as Error);
  }

  const currentPlayerMessage = messageCollection.first();

  const eliminatePlayer = async () => {
    if (!currentGame || !activeGames[channelId]) {
      return;
    }

    const embed2 = new MessageEmbed()
      .setTitle("Time Out!")
      .setDescription(
        // eslint-disable-next-line max-len
        `<@${currentGame.currentUser}> couldn't send a correct word within ${currentGameTurnSeconds} seconds.`,
      )
      .addField("Eliminated Player", `<@${currentGame.currentUser}>`)
      .setColor(flatColors.red);

    const eliminatedPlayerId = currentGame.currentUser;

    const plusOneIndex =
      currentGame.userIds.indexOf(currentGame.currentUser) + 1;

    const nextPlayerIndex = currentGame.userIds[plusOneIndex]
      ? plusOneIndex
      : 0;

    activeGames[channelId] = {
      ...currentGame,
      currentUser: currentGame.userIds[nextPlayerIndex],
    };

    embed2.addField("Next Player", `<@${activeGames[channelId]!.currentUser}>`);

    // elimination
    activeGames[channelId]!.userIds.splice(
      currentGame.userIds.indexOf(eliminatedPlayerId),
      1,
    );

    currentGame = activeGames[channelId]!;

    logger.info(currentGame);

    message.channel.send({ embeds: [embed2] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    await changeTurn(message);
  };

  const moveToNextPlayer = async () => {
    if (!currentGame || !activeGames[channelId]) {
      return;
    }

    const embed2 = new MessageEmbed()
      .setTitle("Time Out!")
      .setDescription(
        // eslint-disable-next-line max-len
        `<@${currentGame.currentUser}> couldn't send a correct word within ${currentGameTurnSeconds} seconds.`,
      )
      .setColor(flatColors.red);

    activeGames[channelId]!.playerLives[currentGame.currentUser]--;

    const plusOneIndex =
      currentGame.userIds.indexOf(currentGame.currentUser) + 1;

    const nextPlayerIndex = currentGame.userIds[plusOneIndex]
      ? plusOneIndex
      : 0;

    activeGames[channelId] = {
      ...currentGame,
      currentUser: currentGame.userIds[nextPlayerIndex],
    };

    currentGame = activeGames[channelId]!;

    logger.info(currentGame);

    embed2.addField("Next Player", `<@${currentGame.currentUser}>`);

    message.channel.send({ embeds: [embed2] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    await changeTurn(message);
  };

  if (
    !currentPlayerMessage &&
    currentGame.playerLives[currentGame.currentUser] < 2
  ) {
    await eliminatePlayer();
    return;
  } else if (!currentPlayerMessage) {
    await moveToNextPlayer();
    return;
  }

  const word = currentPlayerMessage.content.split(" ")[0].replace(/[^\w]/g, "");

  const condition1 = !currentPlayerMessage.content
    .toLowerCase()
    .startsWith(currentGame.currentStartingLetter.toLowerCase());

  const condition2 = word.length < currentGame.currentWordMinLength;

  const condition3 = !(await checkSpell(word));

  const condition4 = currentGame.usedWords.includes(word.toLowerCase());

  const condition5 =
    currentGame.mode === "Banned Letters" &&
    currentGame.bannedLetters.find((l) =>
      word.toLowerCase().includes(l.toLowerCase()),
    );

  if (condition1 || condition2 || condition3 || condition4 || condition5) {
    let reason = `__Reason__: `;

    if (condition1) {
      // eslint-disable-next-line max-len
      reason += `It doesn't start with \`${currentGame.currentStartingLetter.toUpperCase()}\`.`;
    } else if (condition2) {
      // eslint-disable-next-line max-len
      reason += `It doesn't have minimum of ${currentGame.currentWordMinLength} letters.`;
    } else if (condition3) {
      reason += `The word isn't recognized by Hunspell & Wikitionary.`;
    } else if (condition4) {
      reason += `The word was already used before.`;
    } else if (condition5) {
      reason += oneLine`It includes '**${condition5.toUpperCase()}**' 
      which is a banned letter.`;
    }

    const elapsedTime = differenceInMilliseconds(new Date(), waitingStartTime);
    const newTimeLeft = time - elapsedTime;
    const turnSecondsLeft = Math.floor(newTimeLeft / 1000);

    const embed3 = new MessageEmbed()
      .setDescription(
        stripIndents`**__${currentPlayerMessage.content
          .split(" ")[0]
          .toUpperCase()}__** is incorrect.
        ${reason}
        Send a message with a word following the criteria:`,
      )
      .addField(
        "Starting Letter",
        `**${currentGame.currentStartingLetter.toUpperCase()}**`,
      )
      .addField(
        "Minimum Word Length",
        `**${currentGame.currentWordMinLength}** characters`,
      );

    if (currentGame.mode === "Banned Letters") {
      embed3.addField(
        currentGame.mode,
        activeGames[channelId]!.bannedLetters.map((l) => l.toUpperCase()).join(
          ", ",
        ),
        true,
      );
    }

    embed3
      .addField("Time Left", `**${turnSecondsLeft}** seconds`)
      .setColor(flatColors.red);

    let criteriaMessageWithError = await message.channel
      .send({ embeds: [embed3], content: `<@${currentGame.currentUser}>` })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    if (!criteriaMessageWithError) {
      return;
    }

    const oldTime = new Date();

    const interval = setInterval(async () => {
      if (!message.guild || !criteriaMessageWithError) {
        clearInterval(interval);
        return;
      }

      const newTime = new Date();

      const turnSecondsLeft2 =
        turnSecondsLeft - differenceInSeconds(newTime, oldTime);

      const currentGame = getCurrentGame(channelId);

      if (turnSecondsLeft2 <= 3 || !currentGame) {
        clearInterval(interval);
      }

      const embed = criteriaMessageWithError.embeds[0];

      const i = embed.fields.findIndex((f) => f.name === "Time Left");

      embed.fields[i] = {
        name: "Time Left",
        value: `**${turnSecondsLeft2}** seconds`,
        inline: false,
      };

      const guildConfig = getGuildConfig(message.guild.id);

      if (guildConfig?.wcAutoAppendMessage === true) {
        const latestMessage = await message.channel.messages
          .fetch({ limit: 1 })
          .then((messages) => messages.first())
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
            return undefined;
          });

        if (
          latestMessage?.author.id !== criteriaMessageWithError.author.id &&
          latestMessage?.author.id !== activeGames[channelId]!.currentUser
        ) {
          const oldMessage = criteriaMessageWithError;

          criteriaMessageWithError = await message.channel
            .send({
              embeds: [embed],
              content: criteriaMessageWithError.content,
            })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });

          oldMessage.delete();

          return;
        }
      }

      criteriaMessageWithError
        .edit({ embeds: [embed], content: criteriaMessageWithError.content })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    }, 3000);

    if (newTimeLeft <= 0) {
      if (activeGames[channelId]!.playerLives[currentGame.currentUser] < 2) {
        await eliminatePlayer();
      } else {
        await moveToNextPlayer();
      }

      return;
    }

    await changeTurn(message, newTimeLeft);

    return;
  }

  const usedWords = [...activeGames[channelId]!.usedWords, word.toLowerCase()];

  const longestWord =
    activeGames[channelId]!.longestWord.length < word.length
      ? word
      : activeGames[channelId]!.longestWord;

  let longestWordUserId = activeGames[channelId]!.longestWordUserId;

  if (longestWord === word) {
    longestWordUserId = currentPlayerMessage.author.id;
  }

  const currentStartingLetter = word.slice(-1);

  if (
    currentGame.userIds.indexOf(currentGame.currentUser) ===
    currentGame.userIds.length - 1
  ) {
    if (
      currentGame.mode === "Banned Letters" &&
      activeGames[channelId]!.bannedLetters.length < 13
    ) {
      if (activeGames[channelId]!.shouldAddBannedLetter) {
        const lettersToBan = usedWords
          .join("")
          .toLowerCase()
          .split("")
          .filter(
            (l) =>
              l !== currentStartingLetter &&
              !activeGames[channelId]!.bannedLetters.find((bl) => bl === l),
          );

        const letterFrequencies: { [letter: string]: number } = {};

        for (let i = 0; i < lettersToBan.length; i++) {
          if (letterFrequencies[lettersToBan[i]]) {
            continue;
          }

          letterFrequencies[lettersToBan[i]] = lettersToBan.filter(
            (l) => l === lettersToBan[i],
          ).length;
        }

        const leastUsedLetter = Object.entries(letterFrequencies).find(
          (entry) => entry[1] === Math.min(...Object.values(letterFrequencies)),
        )![0];

        activeGames[channelId] = {
          ...activeGames[channelId]!,
          bannedLetters: [
            leastUsedLetter,
            ...activeGames[channelId]!.bannedLetters,
          ],
        };

        message.channel.send({
          embeds: [
            new MessageEmbed()
              .setColor(flatColors.yellow)
              .setTitle(`New Banned Letter: ${leastUsedLetter.toUpperCase()}`)
              .setDescription(
                oneLine`So far one of the least used letters is
              **${leastUsedLetter.toUpperCase()}**
              so you can't use it anymore.`,
              ),
          ],
        });
      }

      activeGames[channelId]!.shouldAddBannedLetter =
        !activeGames[channelId]!.shouldAddBannedLetter;
    }

    // prettier-ignore
    const maxWordLength =
      currentGame.mode === "Casual"
        ? 10
        : currentGame.mode === "Challenge"
          ? 11
          : currentGame.mode === "Banned Letters"
            ? 7
            : 9;

    const shouldReduce = !activeGames[channelId]!.reduce;

    activeGames[channelId] = {
      ...activeGames[channelId]!,
      currentUser: currentGame.userIds[0],
      longestWord,
      longestWordUserId,
      usedWords,
      currentStartingLetter,
      currentWordMinLength: Math.min(
        maxWordLength,
        shouldReduce
          ? activeGames[channelId]!.currentWordMinLength + 1
          : activeGames[channelId]!.currentWordMinLength,
      ),
      roundIndex: shouldReduce
        ? activeGames[channelId]!.roundIndex + 1
        : activeGames[channelId]!.roundIndex,
      reduce: shouldReduce,
    };
  } else {
    const userIndex = currentGame.userIds.indexOf(currentGame.currentUser);

    activeGames[channelId] = {
      ...activeGames[channelId]!,
      currentUser: currentGame.userIds[userIndex + 1],
      longestWord,
      longestWordUserId,
      usedWords,
      currentStartingLetter,
    };
  }

  await changeTurn(message);
};
