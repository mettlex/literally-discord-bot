/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import {
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import pino from "pino";
import { CommandContext, ComponentContext } from "slash-create";
import { getCurrentTWAGame, setCurrentTWAGame } from ".";
import { getDiscordJSClient } from "../../app";
import { flatColors } from "../../config";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

// const padTimeToString = (time: number) =>
//   time > 9 ? time.toString() : `0${time}`;

export const endTWAGame = (channelId: string) => {
  setCurrentTWAGame(channelId, null);
};

export const askToJoinTheWinkingAssassinGame = async (
  channel: TextChannel,
  ctx: CommandContext,
) => {
  let timeLimitInMinutes = 5;

  const data = ctx.options as {
    ["time_limit"]?: number;
  };

  if (data.time_limit && data.time_limit < 30) {
    timeLimitInMinutes = data.time_limit;
  }

  const game = setCurrentTWAGame(ctx.channelID, {
    gameStarted: false,
    gameStartedAt: new Date(),
    gameDurationInSeconds: timeLimitInMinutes * 60,
    alivePlayerIds: [ctx.user.id],
    deadPlayerIds: [],
    assassinIds: [],
    playerActions: {},
  });

  const playerActions: { [id: string]: string[] } = {};

  for (const id of game!.alivePlayerIds) {
    playerActions[id] = [];
  }

  setCurrentTWAGame(ctx.channelID, { ...game!, playerActions });

  const maxTimeInSecondsToJoin = 45;

  const embed = new MessageEmbed()
    .setColor(flatColors.blue)
    .setTitle("The Winking Assassin")
    .setDescription(
      stripIndents`
        > What is this game?
      ` +
        "\n" +
        oneLine`
        _A game of death and deception. 

        The Godfather secretly will choose the “Assassin”. 

        The assassin kills off other players
        one at a time by winking at them
        although the assassin must do it secretly, without others witnessing it.

        If anyone witnesses the assassin winking and exposes the assassin,
        the jig is up.
 
        But don’t be too quick to tattle;
        anyone who guesses wrong is immediately sent to swim with the fishes._
        ;)
      ` +
        "\n\n" +
        oneLine`Time to find the assassin is
        **${timeLimitInMinutes}** minutes after the game starts.`,
    )
    .setFooter(`${maxTimeInSecondsToJoin} seconds left to join`);

  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("join_twa")
      .setStyle("PRIMARY")
      .setLabel("okies, i'm up for it."),
  );

  const message = (await channel.send({
    content: `**${ctx.user.mention} is asking you to join:**`,
    options: { embeds: [embed] },
    components: [row],
  })) as Message;

  const maxTime = maxTimeInSecondsToJoin * 1000;
  const tickTime = 1000;

  let time = 0; // ms

  const interval = setInterval(() => {
    time += tickTime;

    const remainingTime = maxTime - time; // ms
    const remainingTimeInSeconds = Math.floor(remainingTime / 1000);

    if (time % (3 * 1000) === 0) {
      embed.setFooter(`${remainingTimeInSeconds} seconds left to join`);

      message.edit({ embeds: [embed] }).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    }

    if (time >= maxTime) {
      const currentGame = getCurrentTWAGame(ctx.channelID);

      if (currentGame && currentGame.alivePlayerIds.length < 4) {
        endTWAGame(ctx.channelID);

        message.channel
          .send(`> At least 4 players are needed to start the game.`)
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
          });

        message.delete().catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

        clearInterval(interval);

        return;
      }

      startTWAGame(ctx);

      message.delete().catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

      try {
        clearInterval(interval);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }
  }, tickTime);
};

export const startTWAGame = async (ctx: ComponentContext | CommandContext) => {
  const game = getCurrentTWAGame(ctx.channelID);

  if (!game) {
    return;
  }

  const client = getDiscordJSClient();

  const channel = client.channels.cache.get(ctx.channelID) as
    | TextChannel
    | undefined;

  if (!channel) {
    return;
  }

  const indexForAssassin = Math.floor(
    Math.random() * game.alivePlayerIds.length,
  );

  game.assassinIds = [
    ...game.assassinIds,
    game.alivePlayerIds[indexForAssassin],
  ];

  game.gameStarted = true;

  setCurrentTWAGame(channel.id, game);

  const maxTime = game.gameDurationInSeconds * 1000;
  const tickTime = 1000;

  let time = 0; // ms

  const interval = setInterval(() => {
    const game = getCurrentTWAGame(ctx.channelID);

    if (!game) {
      clearInterval(interval);
      return;
    }

    time += tickTime;

    setCurrentTWAGame(ctx.channelID, {
      ...game,
      gameDurationInSeconds: game.gameDurationInSeconds - tickTime / 1000,
    });

    if (game.alivePlayerIds.length < 3) {
      channel
        .send(
          oneLine`**The assassin ${game.assassinIds
            .map((id) => `<@${id}>`)
            .join(", ")} killed everyone.
            Well played! The game ends now.**`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      endTWAGame(ctx.channelID);

      clearInterval(interval);

      return;
    }

    if ((time / 1000) % 5 === 0) {
      logger.info(game);
    }

    const remainingTime = maxTime - time; // ms
    const remainingTimeInSeconds = (remainingTime / 1000) % 60;
    const remainingTimeInMinutes = Math.floor(remainingTime / (60 * 1000));

    const chance = Math.round(Math.random());

    if (time % (30 * 1000) === 0 || time < 2000) {
      if (time >= 30 * 1000) {
        const notWitnessedPlayers = Object.entries(game.playerActions)
          .filter((entry) => entry[1].length === 0)
          .map((entry) => `<@${entry[0]}>`);

        if (notWitnessedPlayers.length > 0) {
          channel
            .send(
              `${notWitnessedPlayers.join(", ")}\n` +
                oneLine`If you don't
            witness other players doing something,
            you'll lose.
            Use \`/witness\` slash command to find the assassin.`,
            )
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });
        }

        if (game.deadPlayerIds.length > 0 && chance === 1) {
          const memberNames = game.deadPlayerIds
            .reverse()
            .map((id) => channel.guild.members.cache.get(id))
            .filter((m) => m)
            .map((m) => m?.nickname || m?.user.username)
            .join(", ");

          channel
            .send(`> The Assassin killed **${memberNames}**.`)
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });
        }
      }

      channel
        .send(
          stripIndents`
          ${time < 2000 ? "**The Winking Assassin game has started.**" : ""}
          
          > \`/witness\` to witness (any player can do it)

          > \`/wink\` for winking (only an assassin can do it)
          
          > **${remainingTimeInMinutes} minutes**
          **and ${remainingTimeInSeconds} seconds**
          left to find the assassin.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    }

    if (time >= maxTime + 1000) {
      channel
        .send(
          oneLine`**The assassin ${game.assassinIds
            .map((id) => `<@${id}>`)
            .join(", ")} killed everyone.
            Well played! The game ends now.**`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      endTWAGame(ctx.channelID);

      clearInterval(interval);
    }
  }, tickTime);
};
