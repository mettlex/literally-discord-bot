/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import { Message, MessageEmbed } from "discord.js";
import {
  ButtonStyle,
  CommandContext,
  ComponentButton,
  ComponentContext,
  ComponentType,
} from "slash-create";
import { getCurrentTWAGame, setCurrentTWAGame } from ".";
import { getDiscordJSClient } from "../../app";
import { ExtendedTextChannel } from "../../extension";
import { flatColors } from "../word-chain/config";

const padTimeToString = (time: number) =>
  time > 9 ? time.toString() : `0${time}`;

export const askToJoinTheWinkingAssassinGame = async (
  channel: ExtendedTextChannel,
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
    gameStartedAt: new Date(),
    gameDurationInSeconds: timeLimitInMinutes * 60,
    alivePlayerIds: [ctx.user.id, "1", "2", "3"],
    deadPlayerIds: [],
    assassinIds: [ctx.user.id],
    playerActions: {},
  });

  const playerActions: { [id: string]: string[] } = {};

  for (const id of game!.alivePlayerIds) {
    playerActions[id] = [];
  }

  setCurrentTWAGame(ctx.channelID, { ...game!, playerActions });

  const maxTimeInSecondsToJoin = 5;

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

        (S)he kills off other players one at a time by winking at them
        although he must do it secretly, without others seeing him.

        If anyone witnesses the assassin winking and exposes him,
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

  const buttons: ComponentButton[] = [
    {
      type: ComponentType.BUTTON,
      custom_id: "join_twa",
      label: "okies, i'm up for it.",
      style: ButtonStyle.PRIMARY,
    },
  ];

  const message = (await channel.sendWithComponents({
    content: `**${ctx.user.mention} is asking you to join:**`,
    options: { embed },
    components: [
      {
        components: buttons,
      },
    ],
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

      message.edit({ embed }).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    }

    if (time >= maxTime) {
      const currentGame = getCurrentTWAGame(ctx.channelID);

      if (currentGame && currentGame.alivePlayerIds.length < 4) {
        setCurrentTWAGame(ctx.channelID, undefined);

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
    | ExtendedTextChannel
    | undefined;

  if (!channel) {
    return;
  }

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

    const remainingTime = maxTime - time; // ms
    const remainingTimeInSeconds = (remainingTime / 1000) % 60;
    const remainingTimeInMinutes = Math.floor(remainingTime / (60 * 1000));

    const chance = Math.round(Math.random());

    if ((time % (30 * 1000) === 0 && chance === 1) || time < 2000) {
      if (time >= 30 * 1000) {
        const notWitnessedPlayers = Object.entries(game.playerActions)
          .filter((entry) => entry[1].length === 0)
          .map((entry) => `<@${entry[0]}>`)
          .join(",");

        channel.send(
          `${notWitnessedPlayers}\n\n` +
            oneLine`If you don't
          witness other players doing something,
          you'll lose.
          Use \`/witness\` slash command to find the assassin.`,
        );
      }

      channel
        .send(
          `> ${remainingTimeInMinutes}:${padTimeToString(
            remainingTimeInSeconds,
          )} left to find the assassin.`,
        )
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      // eslint-disable-next-line no-console
      console.log(game);
    }

    if (time >= maxTime + 1000) {
      clearInterval(interval);
    }
  }, tickTime);
};
