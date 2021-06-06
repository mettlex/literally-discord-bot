/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import { Message, MessageEmbed, TextChannel } from "discord.js";
import pino from "pino";
import { CommandContext } from "slash-create";
import { getCurrentJottoGame, setCurrentJottoGame } from ".";
import { getDiscordJSClient } from "../../app";
import { shuffleArray } from "../../utils/array";
import { flatColors } from "../word-chain/config";
import { timeToJoinInSeconds, turnSeconds } from "./config";

const notInProduction = process.env.NODE_ENV !== "production";

const logger = pino({ prettyPrint: notInProduction });

export const getTurnInverval = (channelId: string) =>
  getCurrentJottoGame(channelId)?.turnInterval;

export const setTurnInverval = (
  channelId: string,
  interval: NodeJS.Timeout,
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
  currentPlayerIndex?: number,
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

  currentPlayerIndex = currentPlayerIndex || game.currentPlayerIndex;

  const turnSecondsUsed = timeLeft || turnSeconds;

  let targetPlayerIndex = currentPlayerIndex + 1;

  if (targetPlayerIndex === game.playersData.length) {
    targetPlayerIndex = 0;
  }

  if (game.playersData[currentPlayerIndex].attempts < 1) {
    await changeJottoTurn(message, targetPlayerIndex);
    return;
  }

  const currentPlayer = game.playersData[currentPlayerIndex];

  let targetPlayer = game.playersData[targetPlayerIndex];

  if (targetPlayer.secretFoundBy) {
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

  if (targetPlayer.secretFoundBy) {
    const embed = new MessageEmbed()
      .setTitle("Congratulations!")
      .setDescription(`Here is your winner, the mastermind of this Jotto game.`)
      .addField("Winner", `<@${currentPlayer.user.id}>`)
      .setColor(flatColors.green);

    let url = currentPlayer.user.defaultAvatarURL;

    if (typeof currentPlayer.user.avatarURL === "function") {
      url =
        currentPlayer.user.avatarURL({ dynamic: true }) ||
        currentPlayer.user.avatar ||
        currentPlayer.user.defaultAvatarURL;
    } else if (typeof currentPlayer.user.avatarURL === "string") {
      // @ts-ignore
      url = currentPlayer.user.avatarURL;
    }

    embed.setThumbnail(url);

    message.channel.send(embed);

    logger.info("Winner:");
    logger.info(currentPlayer.user);

    // eslint-disable-next-line no-console
    console.log({ ...currentPlayer, user: undefined });

    logger.info(`Game ended: ${new Date()}`);

    setCurrentJottoGame(channelId, null);

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

  const embed = new MessageEmbed();

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
  embed.addField(
    "Letterboard",
    `${targetPlayer.availableLetters
      .map((x) =>
        targetPlayer.removedLetters.includes(x)
          ? ` ~~[${x}]~~ `
          : targetPlayer.revealedLetters.includes(x)
            ? ` **[${x}]** `
            : ` ${x} `,
      )
      .join(" ")}`,
    false,
  );

  let removedLetters = "None";

  if (targetPlayer.removedLetters.length > 0) {
    removedLetters = targetPlayer.removedLetters.join(" ");
  }

  embed.addField("Removed Letters", removedLetters, true);

  let revealedLetters = "None";

  if (targetPlayer.revealedLetters.length > 0) {
    revealedLetters = targetPlayer.revealedLetters.join(" ");
  }

  embed.addField("Discovered Letters", revealedLetters, true);

  embed.setFooter(getCriteriaMessageFooter(timeRemainingInSeconds));

  const criteriaMessage = await message.channel
    .send({
      content: oneLine`<@${currentPlayer.user.id}>,
      you have ${currentPlayer.attempts} attempts left.`,
      embed,
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      return undefined;
    });

  if (!criteriaMessage) {
    return;
  }

  const tick = 3;

  const interval = setInterval(async () => {
    if (timeRemainingInSeconds < 0) {
      embed.setFooter(getCriteriaMessageFooter(0));

      await criteriaMessage
        .edit({ content: criteriaMessage.content, embed })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      clearInterval(interval);
      return;
    }

    timeRemainingInSeconds = timeRemainingInSeconds - tick;

    embed.setFooter(getCriteriaMessageFooter(timeRemainingInSeconds));

    await criteriaMessage
      .edit({ content: criteriaMessage.content, embed })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    logger.info(stripIndents`
      ${new Date()}
      Turn: ${currentPlayer.user.tag}
      Time Remaining: ${timeRemainingInSeconds}s
      Attempts: ${currentPlayer.attempts}
      Target:
      Secret: ${targetPlayer.secret}
      Revealed: ${targetPlayer.revealedLetters.join(" ")}
      Removed: ${targetPlayer.removedLetters.join(" ")}
    `);
  }, tick * 1000);

  setTurnInverval(channelId, interval);

  const collection = await message.channel
    .awaitMessages((m: Message) => m.author.id === currentPlayer.user.id, {
      time: (turnSecondsUsed + 1) * 1000,
      max: 1,
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      return undefined;
    });

  try {
    embed.setFooter(getCriteriaMessageFooter(0));

    await criteriaMessage
      .edit({ content: criteriaMessage.content, embed })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    clearInterval(interval);
  } catch (error) {
    logger.error(error);
  }

  game.currentPlayerIndex = targetPlayerIndex;

  const attempts = game.playersData[currentPlayerIndex].attempts - 1;

  if (attempts < 1) {
    message.channel.send(
      `<@${currentPlayer.user.id}> doesn't have any more attempts.`,
    );
  }

  game.playersData[currentPlayerIndex].attempts = attempts;

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

      await changeJottoTurn(wordMessage, targetPlayerIndex);
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

  await changeJottoTurn(message, targetPlayerIndex);
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
  embed: MessageEmbed;
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

export const askToJoinJottoGame = async (ctx: CommandContext) => {
  const client = getDiscordJSClient();

  const channel = (await client.channels.fetch(ctx.channelID)) as TextChannel;

  const embed = new MessageEmbed();

  embed.setColor(flatColors.yellow);

  embed.setTitle("Jotto - Guess the secret word");

  embed.setDescription(stripIndents`
    ${ctx.user.mention} started a Jotto game.
    
    Use \`/jotto\` slash command and set your own secret word to join.
  `);

  embed.setFooter(`${timeToJoinInSeconds} seconds remaining`);

  const message = await channel.send(embed);

  const tickInSeconds = 5;

  let t = 0;

  const interval = setInterval(() => {
    setInitialMessageAndEmbed({ message, embed, interval });

    const game = getCurrentJottoGame(message.channel.id);

    if (!game) {
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

      embed.setFooter(`0 seconds remaining.`);

      message.edit(embed).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

      clearInterval(interval);
      return;
    }

    if (t !== 0) {
      embed.setFooter(`${timeToJoinInSeconds - t} seconds remaining.`);

      message.edit(embed).catch((e) => {
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
