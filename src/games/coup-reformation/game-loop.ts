/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import { differenceInSeconds } from "date-fns";
import { Message, MessageEmbed, TextChannel } from "discord.js";
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
  convertNumberToEmojis,
} from "./data";
import {
  AnswerToForeignAidBlock,
  CoupActionNameInClassic,
  CoupGame,
  CoupPlayer,
  Influence,
} from "./types";

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
      { ...game.deck.pop()!, dismissed: false },
      { ...game.deck.pop()!, dismissed: false },
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

  if (
    !game.eventEmitter ||
    !game.eventEmitter.on ||
    !game.eventEmitter.once ||
    !game.eventEmitter.emit
  ) {
    game.eventEmitter = new EventEmitter();
  }

  const currentPlayerId = game.currentPlayer;

  const activePlayers = game.players.filter(
    (p) =>
      p.influences[0] &&
      p.influences[1] &&
      (!p.influences[0].dismissed || !p.influences[1].dismissed),
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

  game.turnCount++;

  logger.info(`channelId: ${channelId}, turnCount: ${game.turnCount}`);

  if (game.turnCount > 0) {
    const influencesEmbed = new MessageEmbed()
      .setTitle("Dismissed Influences")
      .setColor(flatColors.blue);

    let currentInflencesText = "";

    for (const p of game.players) {
      const foundDisarmed = p.influences.find((inf) => inf.dismissed);

      if (foundDisarmed) {
        currentInflencesText += `\n\n${
          p.id === currentPlayerId ? "> " : ""
        } <@${p.id}> had `;

        currentInflencesText += oneLine`
        ${p.influences[0]?.dismissed ? `\`${p.influences[0]?.name}\`, ` : ""}
        ${p.influences[1]?.dismissed ? `\`${p.influences[1]?.name}\`` : ""}
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

  if (game && player && !player.influences.find((inf) => !inf.dismissed)) {
    game.currentPlayer = activePlayers[nextPlayerIndex].id;
    setCurrentCoupGame(channelId, game);
    changeCoupTurn(message);
    return;
  }

  const embed = new MessageEmbed()
    .setTitle(`Make your move!`)
    .addField(`Coins 💰`, convertNumberToEmojis(player.coins), true)
    .addField(
      `Influences 👥`,
      convertNumberToEmojis(
        player.influences.filter((inf) => !inf.dismissed).length,
      ),
      true,
    )
    .setDescription(`${player.name}, it's your turn. Choose an action below.`)
    .setColor(flatColors.blue)
    .setFooter(oneLine`${player.name}, take an action now!`, player.avatarURL);

  let actions: CoupActionNameInClassic[] = [];

  if (game.mode === "classic") {
    actions = coupActionNamesInClassic;
  }

  const messageWithActionButtons = await channel.sendWithComponents({
    content: `<@${player.id}>`,
    options: { embed },
    components: [
      {
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: "Cheat Sheet",
            custom_id: "coup_cs",
          },
          {
            type: ComponentType.BUTTON,
            // @ts-ignore
            style: ButtonStyle.LINK,
            label: "How To Play",
            url: "https://www.youtube.com/watch?v=a8bY3zI9FL4&list=PLDNi2Csm13eaUpcmveWPzVJ3fIlaFrvZn",
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: "My Influences 🤫",
            custom_id: "coup_show_influences",
          },
        ],
      },
      {
        components: actions.slice(0, 3).map((a) => ({
          type: ComponentType.BUTTON,
          style:
            a === "coup" || a === "assassinate"
              ? ButtonStyle.DESTRUCTIVE
              : ButtonStyle.PRIMARY,
          label: `${getLabelForCoupAction(a)} ${
            a === "assassinate"
              ? "🔪"
              : a === "coup"
              ? "💥"
              : a === "steal"
              ? "🔓"
              : a === "exchange"
              ? "♻️"
              : a === "foreignAid"
              ? "💸"
              : a === "tax"
              ? "🏦"
              : a === "income"
              ? "☝️"
              : ""
          }`,
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
        components: actions.slice(3).map((a) => ({
          type: ComponentType.BUTTON,
          style:
            a === "coup" || a === "assassinate"
              ? ButtonStyle.DESTRUCTIVE
              : ButtonStyle.PRIMARY,
          label: `${getLabelForCoupAction(a)} ${
            a === "assassinate"
              ? "🔪"
              : a === "coup"
              ? "💥"
              : a === "steal"
              ? "🔓"
              : a === "exchange"
              ? "♻️"
              : a === "foreignAid"
              ? "💸"
              : a === "tax"
              ? "🏦"
              : a === "income"
              ? "☝️"
              : ""
          }`,
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

      game.eventEmitter.once(
        "action_foreignAid",
        ({ channelId: eventChannelId, player }) => {
          if (eventChannelId === channelId) {
            if (!game) {
              resolve(undefined);
              return;
            }

            const embed = new MessageEmbed()
              .setColor(flatColors.yellow)
              .setAuthor(player.name, player.avatarURL)
              .setDescription(stripIndents`
                I want to take foreign aid. **2** coins please!
              
                ${oneLine`
                If you claim that you have a **duke**,
                you can block my foreign aid.
                If you don't, press allow button below.
                `}
              `);

            channel.sendWithComponents({
              content: game.players
                .filter((p) => p.id !== player.id)
                .map((p) => `<@${p.id}>`)
                .join(", "),
              options: { embed },
              components: [
                {
                  components: [
                    {
                      label: "Allow",
                      custom_id: "allow_action_in_coup",
                      type: ComponentType.BUTTON,
                      style: ButtonStyle.PRIMARY,
                    },
                    {
                      label: "Block Foreign Aid",
                      custom_id: "block_foreign_aid_in_coup",
                      type: ComponentType.BUTTON,
                      style: ButtonStyle.DESTRUCTIVE,
                    },
                    {
                      type: ComponentType.BUTTON,
                      style: ButtonStyle.SECONDARY,
                      label: "My Influences 🤫",
                      custom_id: "coup_show_influences",
                    },
                  ],
                },
              ],
            });

            game.players[currentPlayerIndex].decidedAction = "foreignAid";

            game.players[currentPlayerIndex].votesRequiredForAction =
              game.players.length - 2;

            takenAction = "foreignAid";

            resolve(game);
          }
        },
      );
    },
  );

  game = await waitForPlayerTurnInCoup;

  if (!game) {
    return;
  }

  try {
    if (!(messageWithActionButtons instanceof Array)) {
      await messageWithActionButtons.delete();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  player = game.players.find((p) => p.id === currentPlayerId);

  if (!takenAction || !player) {
    return;
  }

  if (takenAction === "income") {
    const embed = new MessageEmbed()
      .setColor(flatColors.blue)
      .setAuthor(player.name, player.avatarURL)
      .setDescription(
        oneLine`
          I took **1** coin as income and I have **${player.coins}** coins now.
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
  } else if (takenAction === "foreignAid") {
    let counterAction: {
      type: "allowed" | "block";
      player?: CoupPlayer;
      blockingPlayer?: CoupPlayer;
      action?: CoupActionNameInClassic;
      influence?: Influence["name"];
    } = { type: "allowed" };

    const waitForCounterAction = new Promise<typeof counterAction>(
      (resolve) => {
        if (!game) {
          resolve(counterAction);
          return;
        }

        game.eventEmitter.once("all_players_allowed_action", () => {
          resolve(counterAction);
        });

        game.eventEmitter.once("block", (data) => {
          counterAction.type = "block";
          resolve({ ...counterAction, ...data });
        });
      },
    );

    counterAction = await waitForCounterAction;

    if (counterAction.type === "allowed") {
      coupActionsInClassic.foreignAid(channelId, game, player);

      const embed = new MessageEmbed()
        .setColor(flatColors.blue)
        .setAuthor(player.name, player.avatarURL)
        .setDescription(
          oneLine`
          I took **2** coins as foreign aid
          and I have **${player.coins}** coins now.
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

      await channel.send(embed);

      await sleep(2000);
    }
    if (counterAction.type === "block") {
      const { blockingPlayer, action, influence } = counterAction;

      if (!blockingPlayer || !action || !influence) {
        return;
      }

      player.blockingPlayer = blockingPlayer;

      blockingPlayer.votesRequiredForAction = game.players.length - 2;

      const embed = new MessageEmbed()
        .setColor(flatColors.yellow)
        .setAuthor(blockingPlayer.name, blockingPlayer.avatarURL)
        .setDescription(
          oneLine`
            I block ${player.name}'s foreign aid with my **${influence}**.
          `,
        );

      await channel.sendWithComponents({
        content: game.players
          .filter(
            (p) => player?.blockingPlayer && p.id !== player.blockingPlayer.id,
          )
          .map((p) => `<@${p.id}>`)
          .join(", "),
        options: { embed },
        components: [
          {
            components: [
              {
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
                label: `Let it go`,
                custom_id: `let_go_in_coup`,
              },
              {
                type: ComponentType.BUTTON,
                style: ButtonStyle.DESTRUCTIVE,
                label: `Challenge`,
                custom_id: `challenge_${blockingPlayer.id}_${influence}_coup`,
              },
            ],
          },
        ],
      });

      const answer = await new Promise<AnswerToForeignAidBlock>((resolve) => {
        if (!game) {
          resolve({ challenging: false });
          return;
        }

        game.eventEmitter.once(
          "blocked_foreign_aid_answered",
          (answer: AnswerToForeignAidBlock) => {
            resolve(answer);
          },
        );
      });

      const { challenging, challengingPlayer, influenceName } = answer;

      if (challenging && challengingPlayer && influenceName) {
        const embed = new MessageEmbed()
          .setColor(flatColors.yellow)
          .setAuthor(challengingPlayer.name, challengingPlayer.avatarURL)
          .setDescription(
            oneLine`
            I challenge!
            ${blockingPlayer.name} doesn't have a **${influenceName}**.
          `,
          );

        await channel.send({
          content: `<@${blockingPlayer.id}>`,
          embed,
        });

        await sleep(2000);

        const duke = blockingPlayer.influences.find(
          (inf) => !inf.dismissed && inf.name === "duke",
        );

        if (duke) {
          const activeInfluences = challengingPlayer.influences.filter(
            (inf) => !inf.dismissed,
          );

          if (activeInfluences.length === 2) {
            challengingPlayer.lostChallenge = true;

            setCurrentCoupGame(channelId, game);

            const embed = new MessageEmbed()
              .setTitle("Challenge Failed")
              .setColor(flatColors.blue)
              .setThumbnail(duke.imageURL)
              .setDescription(
                oneLine`
                ${blockingPlayer.name} really had **${influenceName}**!
              `,
              );

            await channel.sendWithComponents({
              content: `<@${challengingPlayer.id}>`,
              options: { embed },
              components: [
                {
                  components: [
                    {
                      type: ComponentType.BUTTON,
                      style: ButtonStyle.PRIMARY,
                      label: `Dismiss One Influence`,
                      custom_id: `coup_show_influences`,
                    },
                  ],
                },
              ],
            });

            await new Promise((resolve) => {
              if (!game) {
                resolve(false);
                return;
              }

              game.eventEmitter.once("dismissed_influence_in_coup", () => {
                resolve(true);
              });
            });
          } else {
            await eliminatePlayer(challengingPlayer, channel, game);
          }
        } else {
          coupActionsInClassic.foreignAid(channelId, game, player);

          const activeInfluences = blockingPlayer.influences.filter(
            (inf) => !inf.dismissed,
          );

          if (activeInfluences.length === 2) {
            blockingPlayer.lostChallenge = true;

            setCurrentCoupGame(channelId, game);

            const embed = new MessageEmbed()
              .setTitle("Challenge Succeeded")
              .setColor(flatColors.blue)
              .setDescription(
                oneLine`
                ${blockingPlayer.name}, you don't have any **${influenceName}**!
                Now you dismiss one of your influences.
              `,
              );

            await channel.sendWithComponents({
              content: `<@${blockingPlayer.id}>`,
              options: { embed },
              components: [
                {
                  components: [
                    {
                      type: ComponentType.BUTTON,
                      style: ButtonStyle.PRIMARY,
                      label: `Dismiss One Influence`,
                      custom_id: `coup_show_influences`,
                    },
                  ],
                },
              ],
            });

            await new Promise((resolve) => {
              if (!game) {
                resolve(false);
                return;
              }

              game.eventEmitter.once("dismissed_influence_in_coup", () => {
                resolve(true);
              });
            });
          } else {
            await eliminatePlayer(blockingPlayer, channel, game);
          }

          const embed = new MessageEmbed()
            .setColor(flatColors.blue)
            .setAuthor(player.name, player.avatarURL)
            .setDescription(
              oneLine`
          I took **2** coins as foreign aid
          and I have **${player.coins}** coins now.
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

          await channel.send(embed);

          await sleep(2000);
        }
      }
    }
  }

  game.currentPlayer = activePlayers[nextPlayerIndex].id;

  setCurrentCoupGame(channelId, game);

  changeCoupTurn(message);
};

export const getLabelForCoupAction = (actionName: string) => {
  return (
    actionName[0].toUpperCase() +
    actionName.slice(1).replace(/(.)([A-Z])/g, "$1 $2")
  );
};

export const eliminatePlayer = async (
  p: CoupPlayer,
  channel: TextChannel,
  game: CoupGame,
) => {
  for (let i = 0; i < p.influences.length; i++) {
    p.influences[i].dismissed = true;
  }

  setCurrentCoupGame(channel.id, game);

  const embed = new MessageEmbed()
    .setAuthor(`Player Eliminated`, p.avatarURL)
    .setColor(flatColors.red)
    .setDescription(
      oneLine`${p.name}'s
      **${p.influences[0]?.name}** &
      **${p.influences[0]?.name}** got dismissed so
      ${p.name} is out of the game.`,
    );

  channel.send(embed);

  await sleep(2000);
};
