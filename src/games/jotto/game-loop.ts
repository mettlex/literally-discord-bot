/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import { Message, EmbedBuilder, TextChannel } from "discord.js";
import pino from "pino";
import { CommandContext } from "slash-create";
import { getCurrentJottoGame, setCurrentJottoGame } from ".";
import { getDiscordJSClient } from "../../app";
import { flatColors } from "../../config";
import { shuffleArray } from "../../utils/array";
import { timeToJoinInSeconds, turnSeconds } from "./config";
import { JottoData } from "./types";

const logger = pino();

export const getTurnInverval = (channelId: string) =>
  getCurrentJottoGame(channelId)?.turnInterval;

export const setTurnInverval = (
  channelId: string,
  interval: NodeJS.Timeout | undefined,
) => {
  const game = getCurrentJottoGame(channelId);

  if (!game) {
    return;
  }

  game.turnInterval = interval;

  setCurrentJottoGame(channelId, game);
};

export const changeJottoTurn = async (
  message: Message,
  currentIndex?: number,
  timeLeft?: number,
) => {
  if (!message.guild) {
    return;
  }

  const channelId = message.channel.id;

  const game = getCurrentJottoGame(channelId);

  if (!game) {
    return;
  }

  const currentPlayerIndex = currentIndex || game.currentPlayerIndex;
  const currentPlayer = game.playersData[currentPlayerIndex];

  const nextPlayer =
    game.playersData[currentPlayerIndex + 1] || game.playersData[0];

  const nextPlayerIndex = game.playersData.findIndex(
    (p) => p.user.id === nextPlayer.user.id,
  );

  const turnSecondsUsed = timeLeft || turnSeconds;

  let targetPlayerIndex = currentPlayerIndex + 1;

  if (targetPlayerIndex === game.playersData.length) {
    targetPlayerIndex = 0;
  }

  const maxScore = Math.max(...game.playersData.map((p) => p.score));

  const declareWinnersAndEndGame = () => {
    const winners = game.playersData.filter(
      (player) => player.score === maxScore && player.winner,
    );

    const maxScoredPlayers = game.playersData.filter(
      (player) => player.score === maxScore,
    );

    if (maxScoredPlayers.length !== winners.length) {
      return;
    }

    const embed = new EmbedBuilder();

    if (winners.length === 1) {
      embed
        .setTitle("Congratulations!")
        .setDescription(
          `Here is your winner, the mastermind of this Jotto game.`,
        )
        .addFields({ name: "Winner", value: `<@${currentPlayer.user.id}>` })
        .setColor(flatColors.green);

      let url = currentPlayer.user.defaultAvatarURL;

      if (typeof currentPlayer.user.avatarURL === "function") {
        url =
          currentPlayer.user.avatarURL() ||
          currentPlayer.user.avatar ||
          currentPlayer.user.defaultAvatarURL;
      } else if (typeof currentPlayer.user.avatarURL === "string") {
        // @ts-ignore
        url = currentPlayer.user.avatarURL;
      }

      embed.setThumbnail(url);

      logger.info("Winner:");
      logger.info(`${currentPlayer.user.tag} ${currentPlayer.user.id}`);

      // eslint-disable-next-line no-console
      console.log({ ...currentPlayer, user: undefined });
    } else if (winners.length > 1) {
      embed
        .setTitle("Congratulations!")
        .setDescription(
          stripIndents`Here are your winners,
          the masterminds of this Jotto game:
          
          ${winners.map((w) => `<@${w.user.id}>`).join(", ")}
          `,
        )
        .setColor(flatColors.green);

      logger.info("Winners:");
      logger.info(winners.map((w) => `${w.user.tag} ${w.user.id}`).join(", "));

      // eslint-disable-next-line no-console
      console.log(winners.map((w) => ({ ...w, user: undefined })));
    } else {
      return;
    }

    const scoresText =
      `\n**Scores:**\n` +
      game.playersData
        .map((player) => `<@${player.user.id}>: **${player.score}**`)
        .join("\n");

    embed.setDescription(embed.data.description + scoresText);

    message.channel.send({ content: "​", embeds: [embed] });

    logger.info(`Game ended: ${new Date()}`);

    setCurrentJottoGame(channelId, null);

    return;
  };

  if (
    !game.playersData.find((p) => p.attemptsLeft > 0) &&
    !game.playersData.find((p) => p.score > 0)
  ) {
    message.channel
      .send("> No player has scored so the game ends without a winner.")
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    setCurrentJottoGame(channelId, null);

    return;
  } else if (
    !game.playersData.find((p) => p.attemptsLeft > 0) &&
    game.playersData.find((p) => p.score > 0)
  ) {
    if (currentPlayer.winner) {
      declareWinnersAndEndGame();
      return;
    } else {
      currentPlayer.winner = true;
    }
  }

  if (game.playersData[currentPlayerIndex].attemptsLeft < 1) {
    await changeJottoTurn(message, nextPlayerIndex);
    return;
  }

  logger.info("=== Current Player Log Start ===");
  logger.info(currentPlayer.user);
  logger.info("=== Current Player Log End ===");

  if (currentPlayer.score === maxScore && maxScore > 0) {
    if (currentPlayer.winner) {
      declareWinnersAndEndGame();
      return;
    } else {
      currentPlayer.winner = true;
    }
  }

  let targetPlayer = game.playersData[targetPlayerIndex];

  if (targetPlayer.secretFoundBy?.id) {
    for (let i = 0; game.playersData.length; i++) {
      if (!game.playersData[i]) {
        break;
      }

      if (
        !game.playersData[i].secretFoundBy &&
        game.playersData[i].user.id !== currentPlayer.user.id
      ) {
        targetPlayerIndex = i;
        targetPlayer = game.playersData[i];
        break;
      }
    }
  }

  if (targetPlayer.secretFoundBy?.id) {
    await changeJottoTurn(message, nextPlayerIndex);
    return;
  }

  const currentMember = await message.guild.members.fetch(
    game.playersData[currentPlayerIndex].user.id,
  );

  const targetMember = await message.guild.members.fetch(
    game.playersData[targetPlayerIndex].user.id,
  );

  let timeRemainingInSeconds = turnSecondsUsed;

  const getCriteriaMessageFooter = (timeRemainingInSeconds: number) =>
    `${timeRemainingInSeconds} seconds remaining`;

  const embed = new EmbedBuilder();

  embed.setColor(flatColors.blue);

  embed.setTitle(
    `Guess ${
      targetMember.nickname || targetMember.user.username
    }'s secret word`,
  );

  embed.setDescription(stripIndents`
  **${currentMember.nickname || currentMember.user.username}**,
    ${oneLine`
      Send any **${targetPlayer.secret.length}**-letter test word to guess
      **${targetMember.nickname || targetMember.user.username}**'s secret word.
    `}
  `);

  // prettier-ignore
  embed.addFields({
    name: "Letterboard",
    value: `${targetPlayer.availableLetters
      .map((x) =>
        targetPlayer.removedLetters.includes(x)
          ? ` ~~[${x}]~~ `
          : targetPlayer.revealedLetters.includes(x)
            ? ` **[${x}]** `
            : ` ${x} `,
      )
      .join(" ")}`,
    inline: false,
  });

  let removedLetters = "None";

  if (targetPlayer.removedLetters.length > 0) {
    removedLetters = targetPlayer.removedLetters.join(" ");
  }

  embed.addFields({
    name: "Removed Letters",
    value: removedLetters,
    inline: true,
  });

  let revealedLetters = "None";

  if (targetPlayer.revealedLetters.length > 0) {
    revealedLetters = targetPlayer.revealedLetters.join(" ");
  }

  embed.addFields({
    name: "Discovered Letters",
    value: revealedLetters,
    inline: true,
  });

  embed.setFooter({
    text: getCriteriaMessageFooter(timeRemainingInSeconds),
  });

  const criteriaMessage = await message.channel
    .send({
      content: oneLine`<@${currentPlayer.user.id}>,
      you have ${currentPlayer.attemptsLeft} attempts left.`,
      embeds: [embed],
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      return undefined;
    });

  if (!criteriaMessage) {
    return;
  }

  {
    const intervalForGameChecking = setInterval(async () => {
      const game = getCurrentJottoGame(channelId);

      if (!game) {
        setTurnInverval(channelId, undefined);
        setCurrentJottoGame(channelId, null);
        clearInterval(intervalForGameChecking);
        return;
      }
    }, 500);
  }

  const tick = 3;

  const interval = setInterval(async () => {
    const game = getCurrentJottoGame(channelId);

    if (!game) {
      setTurnInverval(channelId, undefined);
      setCurrentJottoGame(channelId, null);
      clearInterval(interval);
      return;
    }

    if (timeRemainingInSeconds < 0) {
      embed.setFooter({
        text: getCriteriaMessageFooter(0),
      });

      await criteriaMessage
        .edit({ content: criteriaMessage.content, embeds: [embed] })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      clearInterval(interval);
      return;
    }

    timeRemainingInSeconds = timeRemainingInSeconds - tick;

    embed.setFooter({
      text: getCriteriaMessageFooter(timeRemainingInSeconds),
    });

    await criteriaMessage
      .edit({ content: criteriaMessage.content, embeds: [embed] })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    logger.info(stripIndents`
      ${new Date()}
      Turn: ${currentPlayer.user.tag}
      Time Remaining: ${timeRemainingInSeconds}s
      Attempts Left: ${currentPlayer.attemptsLeft}
      Target:
      Secret: ${targetPlayer.secret}
      Revealed: ${targetPlayer.revealedLetters.join(" ")}
      Removed: ${targetPlayer.removedLetters.join(" ")}
    `);
  }, tick * 1000);

  setTurnInverval(channelId, interval);

  const collection = await message.channel
    .awaitMessages({
      filter: (m: Message) =>
        m.author.id === currentPlayer.user.id &&
        !m.content.includes(" ") &&
        !m.reference &&
        !/[^A-Z]/gi.test(m.content),

      time: (turnSecondsUsed + 1) * 1000,
      max: 1,
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      return undefined;
    });

  {
    const game = getCurrentJottoGame(channelId);

    if (!game) {
      try {
        setTurnInverval(channelId, undefined);
        clearInterval(interval);
      } catch (error) {
        logger.error(error as Error);
      }

      return;
    }
  }

  try {
    embed.setFooter({
      text: getCriteriaMessageFooter(0),
    });

    await criteriaMessage
      .edit({ content: criteriaMessage.content, embeds: [embed] })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    clearInterval(interval);
  } catch (error) {
    logger.error(error as Error);
  }

  const attemptsLeft = game.playersData[currentPlayerIndex].attemptsLeft - 1;

  if (attemptsLeft < 1) {
    message.channel.send(
      `<@${currentPlayer.user.id}> doesn't have any more attempts.`,
    );
  }

  game.playersData[currentPlayerIndex].attemptsLeft = attemptsLeft;

  setCurrentJottoGame(channelId, game);

  const wordMessage = collection?.first();

  if (wordMessage && !/[^A-Z]/gi.test(wordMessage.content)) {
    const word = wordMessage.content.split(" ").slice(-1)[0].toUpperCase();
    const wordArray = word.split("").sort();
    const secretArray = targetPlayer.secret.toUpperCase().split("");

    logger.info({ word });

    if (word.length !== targetPlayer.secret.length) {
      wordMessage
        .reply(
          "\n" +
            oneLine`**${word}** doesn't have ${
              targetPlayer.secret.length
            } letters like
          **${
            targetMember.nickname || targetMember.user.username
          }**'s secret word.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      await changeJottoTurn(
        wordMessage,
        currentPlayerIndex,
        timeRemainingInSeconds,
      );

      return;
    }

    const commonLetters = wordArray
      .filter((letter) => secretArray.includes(letter))
      .sort();

    const unmatchedLetters = wordArray.filter(
      (letter) => !secretArray.includes(letter),
    );

    let allUnmatchedGotRemovedPreviously = false;

    if (
      !unmatchedLetters.find((x) => !targetPlayer.removedLetters.includes(x))
    ) {
      allUnmatchedGotRemovedPreviously = true;
    }

    if (word.toUpperCase() === targetPlayer.secret.toUpperCase()) {
      targetPlayer.secretFoundBy = currentPlayer.user;

      currentPlayer.score = currentPlayer.score + 1;

      wordMessage
        .reply(
          `\nCongrats! You found ${
            targetMember.nickname || targetMember.user.username
          }'s secret word: **${word}**.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      await changeJottoTurn(wordMessage, currentPlayerIndex);
      return;
    } else if (commonLetters.length === 0) {
      targetPlayer.removedLetters = Array.from(
        new Set([...targetPlayer.removedLetters, ...wordArray]),
      );

      wordMessage
        .reply(
          "\n" +
            oneLine`None of the letters of **${word}** matches with
          **${
            targetMember.nickname || targetMember.user.username
          }**'s secret word.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    } else if (allUnmatchedGotRemovedPreviously) {
      targetPlayer.revealedLetters = Array.from(
        new Set([...targetPlayer.revealedLetters, ...commonLetters]),
      );

      wordMessage
        .reply(
          "\n" +
            oneLine`**${word}** has **${commonLetters.join(", ")}** (${
              commonLetters.length
            }) letter${commonLetters.length > 1 ? "s" : ""} common in
          **${
            targetMember.nickname || targetMember.user.username
          }**'s secret word.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    } else {
      wordMessage
        .reply(
          "\n" +
            oneLine`**${word}** has **${commonLetters.length}** letter${
              commonLetters.length > 1 ? "s" : ""
            } common in
          **${
            targetMember.nickname || targetMember.user.username
          }**'s secret word.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    }
  } else {
    criteriaMessage.channel.send(oneLine`
      <@${currentPlayer.user.id}> didn't send any word
      within ${turnSecondsUsed} seconds.
      Now it's next player's turn.
    `);
  }

  game.currentPlayerIndex = nextPlayerIndex;

  await changeJottoTurn(message, game.currentPlayerIndex);
};

export const startJottoGame = async (message: Message) => {
  const game = getCurrentJottoGame(message.channel.id);

  if (!game) {
    return;
  }

  if (game.playersData.length < 2) {
    message.channel
      .send("**At least 2 players are needed to start the game.**")
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    setCurrentJottoGame(message.channel.id, null);

    return;
  }

  shuffleArray(game.playersData);

  setCurrentJottoGame(message.channel.id, { ...game, gameStarted: true });

  await changeJottoTurn(message);
};

interface InitialData {
  message: Message;
  embed: EmbedBuilder;
  interval: NodeJS.Timeout;
}

const initialMessages: {
  [channelId: string]: InitialData | undefined;
} = {};

export const getInitialMessageAndEmbed = (channelId: string) =>
  initialMessages[channelId];

export const setInitialMessageAndEmbed = (data: InitialData) => {
  initialMessages[data.message.channel.id] = data;
};

export const askToJoinJottoGame = async (
  ctx: CommandContext,
  game: JottoData,
) => {
  const client = getDiscordJSClient();

  const channel = (await client.channels.fetch(ctx.channelID)) as TextChannel;

  const embed = new EmbedBuilder();

  embed.setColor(flatColors.yellow);

  embed.setTitle("Jotto - Guess the secret word");

  embed.setDescription(stripIndents`
    ${oneLine`${ctx.user.mention} started a Jotto game
    with a secret word with **${game.playersData[0].secret.length}** letters.`}
    
    Use \`/jotto\` slash command and set your own ${
      game.playersData[0].secret.length
    }-letter secret word to join.
  `);

  embed.setFooter({
    text: `${timeToJoinInSeconds} seconds remaining`,
  });

  const message = await channel.send({ content: "​", embeds: [embed] });

  const tickInSeconds = 5;

  let t = 0;

  const interval = setInterval(() => {
    setInitialMessageAndEmbed({ message, embed, interval });

    const game = getCurrentJottoGame(message.channel.id);

    if (!game) {
      setCurrentJottoGame(message.channel.id, null);
      clearInterval(interval);
      return;
    }

    if (t >= timeToJoinInSeconds) {
      if (game.playersData.length < 2) {
        message.channel
          .send("**At least 2 players are needed to start the game.**")
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
          });

        setCurrentJottoGame(message.channel.id, null);
        embed.setColor(flatColors.red);
      } else {
        embed.setColor(flatColors.green);
        startJottoGame(message);
      }

      embed.setFooter({
        text: `0 seconds remaining.`,
      });

      message.edit({ embeds: [embed] }).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

      clearInterval(interval);
      return;
    }

    if (t !== 0) {
      embed.setFooter({
        text: `${timeToJoinInSeconds - t} seconds remaining.`,
      });

      message.edit({ embeds: [embed] }).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    }

    t = t + tickInSeconds;
  }, tickInSeconds * 1000);
};

export const notifyJoined = async (ctx: CommandContext) => {
  const client = getDiscordJSClient();

  const channel = (await client.channels.fetch(ctx.channelID)) as TextChannel;

  await channel.send(
    `${
      ctx.member?.nick || ctx.user.username
    } joined and set their own secret word.`,
  );
};
