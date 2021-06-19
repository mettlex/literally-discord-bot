/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import { differenceInSeconds } from "date-fns";
import { Message, MessageEmbed } from "discord.js";
import EventEmitter from "events";
import { ButtonStyle, ComponentType } from "slash-create";
import { getLogger } from "../../app";
import { flatColors } from "../../config";
import { ExtendedTextChannel } from "../../extension";
import { shuffleArray } from "../../utils/array";
import sleep from "../../utils/sleep";
import { prefixes, timeToJoinInSeconds } from "./config";
import {
  coupActionsInClassic,
  createDeck,
  getCurrentCoupGame,
  setCurrentCoupGame,
  setInitialMessageAndEmbed,
  coupActionNamesInClassic,
} from "./data";
import { slashCommandOptionsForCheckCards } from "./slash-commands";
import { CoupActionNameInClassic, CoupGame } from "./types";

const logger = getLogger();

export const askToJoinCoupGame = async (message: Message) => {
  const embed = new MessageEmbed()
    .setTitle("Join Coup Board Game!")
    .setDescription(
      stripIndents`${oneLine`_You are head of influences
    in a city run by a weak and corrupt court. You need to manipulate,
    bluff and bribe your way to power. Your object is to destroy
    the influences of all the other players, forcing them into exile.
    Only one player will survive..._`}

    ${oneLine`In Coup, you want to be the last player with
    influence in the game, with influence being represented
    by hidden character cards in your playing area.`}

    ${oneLine`You may join by pressing the button below
    or by sending \`${prefixes[0]}join\``}
  `,
    )
    .addField("Time left to join", `${timeToJoinInSeconds} seconds`, false)
    .setFooter(
      `${
        message.member?.nickname || message.author.username
      } is asking you to join`,
    )
    .setThumbnail(
      "https://cdn.discordapp.com/attachments/848495134874271764/854318440654831636/roles.png",
    )
    .setColor(flatColors.yellow);

  const channel = message.channel as ExtendedTextChannel;

  const initialMessage = (await channel.sendWithComponents({
    content: "",
    options: { embed },
    components: [
      {
        components: [
          {
            type: ComponentType.BUTTON,
            label: "Count me in!",
            custom_id: "join_coup",
            style: ButtonStyle.PRIMARY,
          },
        ],
      },
    ],
  })) as Message;

  const startTime = new Date();

  const interval = setInterval(() => {
    const game = getCurrentCoupGame(message.channel.id);

    if (!game) {
      clearInterval(interval);
      return;
    }

    const timeLeft =
      timeToJoinInSeconds - differenceInSeconds(new Date(), startTime);

    if (timeLeft <= 0 || game.gameStarted) {
      embed.fields[0].name = `Time up!`;
      embed.fields[0].value = `Let's see who joined below.`;

      initialMessage.edit(embed);

      startCoupGame(initialMessage);

      clearInterval(interval);

      return;
    }

    embed.fields[0].value = `${timeLeft} seconds`;

    initialMessage.edit(embed);
  }, 3000);

  setInitialMessageAndEmbed({ message: initialMessage, embed, interval });
};

export const startCoupGame = (message: Message) => {
  let game = getCurrentCoupGame(message.channel.id);

  if (!game) {
    message.channel.send("> No initial game data found to start.");
    return;
  }

  if (game.players.length < 2) {
    message.channel.send("> At least 2 players are needed to start Coup game.");

    setCurrentCoupGame(message.channel.id, null);

    return;
  }

  game = {
    ...game,
    deck: createDeck({
      playersCount: game.players.length,
      gameMode: "classic",
    }),
    gameStarted: true,
    gameStartedAt: new Date(),
  };

  shuffleArray(game.players);

  game.currentPlayer = game.players[0].id;

  for (let i = 0; i < game.players.length; i++) {
    game.players[i].influences = [
      { ...game.deck.pop()!, disarmed: false },
      { ...game.deck.pop()!, disarmed: false },
    ];
  }

  setCurrentCoupGame(message.channel.id, game);

  changeCoupTurn(message);
};

export const changeCoupTurn = async (message: Message) => {
  const channel = message.channel as ExtendedTextChannel;
  const channelId = channel.id;

  let game = getCurrentCoupGame(channelId);

  if (!game) {
    return;
  }

  if (!game.eventEmitter || !game.eventEmitter.on || !game.eventEmitter.emit) {
    game.eventEmitter = new EventEmitter();
  }

  const currentPlayerId = game.currentPlayer;

  game.turnCount++;

  logger.info(`channelId: ${channelId}, turnCount: ${game.turnCount}`);

  if (game.turnCount > 0) {
    const influencesEmbed = new MessageEmbed()
      .setTitle("DISARMED INFLUENCES")
      .setTimestamp()
      .setColor(flatColors.blue);

    let currentInflencesText = "";

    for (const p of game.players) {
      const foundDisarmed = p.influences.find((inf) => inf.disarmed);

      if (foundDisarmed) {
        currentInflencesText += `\n\n${
          p.id === currentPlayerId ? "> " : ""
        } <@${p.id}> had `;

        currentInflencesText += oneLine`
        ${p.influences[0]?.disarmed ? `\`${p.influences[0]?.name}\`` : ""}
        ${p.influences[1]?.disarmed ? `\`${p.influences[1]?.name}\`` : ""}
        `;
      }
    }

    if (currentInflencesText.length > 0) {
      influencesEmbed.setDescription(currentInflencesText);

      await message.channel.send(influencesEmbed);

      await sleep(1000);
    }
  }

  let player = game.players.find((p) => p.id === currentPlayerId);

  if (!player) {
    return;
  }

  logger.info(player);

  const embed = new MessageEmbed()
    .setTitle(`Make your move, ${player.name}`)
    .addField(`Coins`, player.coins, true)
    .addField(
      `Influences`,
      player.influences.filter((inf) => !inf.disarmed).length,
      true,
    )
    .setDescription(`${player.name}, it's your turn. Choose an action below.`)
    .setColor(flatColors.blue)
    .setFooter(
      oneLine`Check your influences with
        /${slashCommandOptionsForCheckCards.name} command`,
      player.avatarURL,
    );

  let actions: CoupActionNameInClassic[] = [];

  if (game.mode === "classic") {
    actions = coupActionNamesInClassic;
  }

  channel.sendWithComponents({
    content: `<@${player.id}>`,
    options: { embed },
    components: [
      {
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: "Show Cheat Sheet",
            custom_id: "cheat_sheet",
          },
          {
            type: ComponentType.BUTTON,
            // @ts-ignore
            style: ButtonStyle.LINK,
            label: "How To Play",
            url: "https://www.youtube.com/watch?v=a8bY3zI9FL4&list=PLDNi2Csm13eaUpcmveWPzVJ3fIlaFrvZn",
          },
        ],
      },
      {
        components: actions.slice(0, 4).map((a) => ({
          type: ComponentType.BUTTON,
          style:
            a === "coup" || a === "assassinate"
              ? ButtonStyle.DESTRUCTIVE
              : ButtonStyle.PRIMARY,
          label: getLabelForCoupActionButton(a),
          custom_id: `${a}_${player!.id}`,
          disabled:
            player!.coins < 7 && a === "coup"
              ? true
              : player!.coins < 3 && a === "assassinate"
              ? true
              : player!.coins > 9 && a !== "coup"
              ? true
              : false,
        })),
      },
      {
        components: actions.slice(4).map((a) => ({
          type: ComponentType.BUTTON,
          style:
            a === "coup" || a === "assassinate"
              ? ButtonStyle.DESTRUCTIVE
              : ButtonStyle.PRIMARY,
          label: getLabelForCoupActionButton(a),
          custom_id: `${a}_${player!.id}`,
          disabled:
            player!.coins < 7 && a === "coup"
              ? true
              : player!.coins < 3 && a === "assassinate"
              ? true
              : player!.coins > 9 && a !== "coup"
              ? true
              : false,
        })),
      },
    ],
  });

  let takenAction: CoupActionNameInClassic | undefined;

  const waitForPlayerTurnInCoup = new Promise<CoupGame | undefined | null>(
    (resolve) => {
      if (!game) {
        resolve(undefined);
        return;
      }

      game.eventEmitter.once(
        "action_income",
        ({ channelId: eventChannelId, player }) => {
          if (eventChannelId === channelId) {
            if (!game) {
              resolve(undefined);
              return;
            }

            coupActionsInClassic.income(channelId, game, player);

            takenAction = "income";

            resolve(game);
          }
        },
      );
    },
  );

  game = await waitForPlayerTurnInCoup;
  player = game?.players.find((p) => p.id === currentPlayerId);

  if (!takenAction || !game || !player) {
    return;
  }

  if (takenAction === "income") {
    const embed = new MessageEmbed()
      .setColor(flatColors.blue)
      .setAuthor(player.name, player.avatarURL)
      .setDescription(
        oneLine`
          I took 1 coin as income and I have ${player.coins} coins now.
          ${
            (player.coins > 2 &&
              player.coins < 7 &&
              oneLine`If I have an assassin,
              I may assassinate in my next turn.`) ||
            ""
          }
          ${
            (player.coins > 6 &&
              player.coins < 10 &&
              oneLine`I can coup against a player in my next turn.`) ||
            ""
          }
          ${
            (player.coins > 9 &&
              oneLine`I have to coup against a player in my next turn.`) ||
            ""
          }
        `,
      );

    channel.send(embed);
  }

  const activePlayers = game.players.filter(
    (p) =>
      p.influences[0] &&
      p.influences[1] &&
      (!p.influences[0].disarmed || !p.influences[1].disarmed),
  );

  // if (activePlayers.length === 0 || game.turnCount > 20) {
  //   setCurrentCoupGame(channelId, null);
  //   return;
  // }

  const currentPlayerIndex = activePlayers.findIndex(
    (p) => p.id === currentPlayerId,
  );

  const nextPlayerIndex =
    currentPlayerIndex !== activePlayers.length - 1
      ? currentPlayerIndex + 1
      : 0;

  game.currentPlayer = activePlayers[nextPlayerIndex].id;

  setCurrentCoupGame(channelId, game);

  changeCoupTurn(message);
};

export const getLabelForCoupActionButton = (actionName: string) => {
  return (
    actionName[0].toUpperCase() +
    actionName.slice(1).replace(/(.)([A-Z])/g, "$1 $2")
  );
};
