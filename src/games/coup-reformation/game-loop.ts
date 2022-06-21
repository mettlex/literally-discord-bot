/* eslint-disable indent */
import { oneLine, stripIndents } from "common-tags";
import { differenceInSeconds } from "date-fns";
import {
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import EventEmitter from "events";
import { getLogger } from "../../app";
import { flatColors } from "../../config";
import { shuffleArray } from "../../utils/array";
import sleep from "../../utils/sleep";
import { handleAssassinate } from "./actions/assassinate";
import { handleCoup } from "./actions/coup";
import { handleExchange } from "./actions/exchange";
import { handleForeignAid } from "./actions/foreign-aid";
import { handleIncome } from "./actions/income";
import { handleSteal } from "./actions/steal";
import { handleTax } from "./actions/tax";
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
    .setFooter({
      text: `${
        message.member?.nickname || message.author.username
      } is asking you to join`,
    })
    .setThumbnail(
      "https://cdn.discordapp.com/attachments/848495134874271764/854318440654831636/roles.png",
    )
    .setColor(flatColors.yellow);

  const channel = message.channel as TextChannel;

  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("join_coup")
      .setStyle("PRIMARY")
      .setLabel("Count me in!"),
  );

  const initialMessage = (await channel.send({
    embeds: [embed],
    components: [row],
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

      initialMessage.edit({ embeds: [embed] });

      startCoupGame(initialMessage);

      clearInterval(interval);

      return;
    }

    embed.fields[0].value = `${timeLeft} seconds`;

    initialMessage.edit({ embeds: [embed] });
  }, 3000);

  setInitialMessageAndEmbed({ message: initialMessage, embed, interval });
};

export const startCoupGame = async (message: Message) => {
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

  const channel = message.channel as TextChannel;

  setCurrentCoupGame(channel.id, game);

  const embed = new MessageEmbed()
    .setTitle("Coup Game Started!")
    .setColor(flatColors.blue)
    .setImage(
      `https://cdn.discordapp.com/attachments/848495134874271764/858310160472211466/coupcards.jpg`,
    )
    .addField(
      "Turn Order",
      game.players.map((p) => `${p.name}`).join(", "),
      false,
    )
    .addField("Influences in Deck", `${game.deck.length}`, true)
    .addField("Total Players", `${game.players.length}`, true)

    .setFooter({
      text: `Check your influences by tapping the button below.`,
    });

  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("coup_show_influences")
      .setStyle("SECONDARY")
      .setLabel("My Influences 🤫"),
  );

  await channel.send({
    embeds: [embed],
    components: [row],
  });

  await sleep(5000);

  changeCoupTurn(message);
};

export const changeCoupTurn = async (message: Message) => {
  const channel = message.channel as TextChannel;
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

  const currentPlayerIndex = activePlayers.findIndex(
    (p) => p.id === currentPlayerId,
  );

  const nextPlayerIndex =
    currentPlayerIndex !== activePlayers.length - 1
      ? currentPlayerIndex + 1
      : 0;

  game.turnCount++;

  let player = game.players.find((p) => p.id === currentPlayerId);

  if (!player) {
    return;
  }

  logger.info(oneLine`
    guild: ${channel.guild.id},
    channel: ${channelId},
    turns: ${game.turnCount},
    player: ${player.tag} (${player.id}),
    influeces: ${player.influences
      .map((inf) => `${inf.name}${(inf.dismissed && " (dismissed)") || ""}`)
      .join(", ")}
  `);

  if (game && player && !player.influences.find((inf) => !inf.dismissed)) {
    game.currentPlayer = activePlayers[nextPlayerIndex].id;
    setCurrentCoupGame(channelId, game);
    changeCoupTurn(message);
    return;
  }

  if (activePlayers.length === 1) {
    const embed = new MessageEmbed();

    embed
      .setTitle("Congratulations!")
      .setDescription(`Here is your winner, the successful leader of Coup!`)
      .addField("Winner", `<@${player.id}>`)
      .setColor(flatColors.green)
      .setThumbnail(player.avatarURL);

    await channel.send({ embeds: [embed] });

    logger.info(
      oneLine`> coup winner: ${player.tag} (${player.id})
      in ${channel.id} of ${channel.guild.id}`,
    );

    setCurrentCoupGame(channelId, null);

    return;
  }

  if (game.turnCount > 0) {
    const influencesEmbed = new MessageEmbed()
      .setTitle("Dismissed Influences")
      .setColor(flatColors.blue);

    let currentInflencesText = "";

    for (const p of game.players) {
      const foundDisarmed = p.influences.find((inf) => inf.dismissed);

      if (foundDisarmed) {
        currentInflencesText += `\n\n${
          p.id === currentPlayerId ? "👉 " : ""
        } <@${p.id}> had `;

        currentInflencesText += oneLine`
        ${p.influences[0]?.dismissed ? `\`${p.influences[0]?.name}\`, ` : ""}
        ${p.influences[1]?.dismissed ? `\`${p.influences[1]?.name}\`` : ""}
        `;
      }
    }

    if (currentInflencesText.length > 0) {
      influencesEmbed.setDescription(currentInflencesText);

      await message.channel.send({ embeds: [influencesEmbed] });

      await sleep(1000);
    }
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
    .setFooter({
      text: oneLine`${player.name}, take an action now!`,
      iconURL: player.avatarURL,
    });

  let actions: CoupActionNameInClassic[] = [];

  if (game.mode === "classic") {
    actions = coupActionNamesInClassic;
  }

  // {
  //   components: [
  //     {
  //       type: ComponentType.BUTTON,
  //       style: ButtonStyle.SECONDARY,
  //       label: "Cheat Sheet",
  //       custom_id: "coup_cs",
  //     },
  //     {
  //       type: ComponentType.BUTTON,
  //       // @ts-ignore
  //       style: ButtonStyle.LINK,
  //       label: "How To Play",
  //       url: "https://www.youtube.com/watch?v=a8bY3zI9FL4&list=PLDNi2Csm13eaUpcmveWPzVJ3fIlaFrvZn",
  //     },
  //     {
  //       type: ComponentType.BUTTON,
  //       style: ButtonStyle.SECONDARY,
  //       label: "My Influences 🤫",
  //       custom_id: "coup_show_influences",
  //     },
  //   ],
  // },
  // {
  //   components: actions.slice(0, 3).map((a) => ({
  //     type: ComponentType.BUTTON,
  //     style:
  //       a === "coup" || a === "assassinate"
  //         ? ButtonStyle.DESTRUCTIVE
  //         : ButtonStyle.SECONDARY,
  //     label: `${getLabelForCoupAction(a)} ${
  //       a === "assassinate"
  //         ? "🔪"
  //         : a === "coup"
  //         ? "💥"
  //         : a === "steal"
  //         ? "🔓"
  //         : a === "exchange"
  //         ? "♻️"
  //         : a === "foreignAid"
  //         ? "💸"
  //         : a === "tax"
  //         ? "🏦"
  //         : a === "income"
  //         ? "☝️"
  //         : ""
  //     }`,
  //     custom_id: `${a}_${player!.id}`,
  //     disabled:
  //       player!.coins < 7 && a === "coup"
  //         ? true
  //         : player!.coins < 3 && a === "assassinate"
  //         ? true
  //         : player!.coins > 9 && a !== "coup"
  //         ? true
  //         : false,
  //   })),
  // },
  // {
  //   components: actions.slice(3).map((a) => ({
  //     type: ComponentType.BUTTON,
  //     style:
  //       a === "coup" || a === "assassinate"
  //         ? ButtonStyle.DESTRUCTIVE
  //         : ButtonStyle.SECONDARY,
  //     label: `${getLabelForCoupAction(a)} ${
  //       a === "assassinate"
  //         ? "🔪"
  //         : a === "coup"
  //         ? "💥"
  //         : a === "steal"
  //         ? "🔓"
  //         : a === "exchange"
  //         ? "♻️"
  //         : a === "foreignAid"
  //         ? "💸"
  //         : a === "tax"
  //         ? "🏦"
  //         : a === "income"
  //         ? "☝️"
  //         : ""
  //     }`,
  //     custom_id: `${a}_${player!.id}`,
  //     disabled:
  //       player!.coins < 7 && a === "coup"
  //         ? true
  //         : player!.coins < 3 && a === "assassinate"
  //         ? true
  //         : player!.coins > 9 && a !== "coup"
  //         ? true
  //         : false,
  //   })),
  // },

  const rows = [
    new MessageActionRow().addComponents(
      new MessageButton()
        .setStyle("SECONDARY")
        .setLabel("Cheat Sheet")
        .setCustomId("coup_cs"),
      new MessageButton()
        .setStyle("LINK")
        .setLabel("How To Play")
        .setURL(
          "https://www.youtube.com/watch?v=a8bY3zI9FL4&list=PLDNi2Csm13eaUpcmveWPzVJ3fIlaFrvZn",
        ),
      new MessageButton()
        .setStyle("SECONDARY")
        .setLabel("My Influences 🤫")
        .setCustomId("coup_show_influences"),
    ),
    new MessageActionRow().addComponents(
      ...actions.slice(0, 3).map((a) =>
        new MessageButton()
          .setStyle(
            a === "coup" || a === "assassinate" ? "DANGER" : "SECONDARY",
          )
          .setLabel(
            `${getLabelForCoupAction(a)} ${
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
          )
          .setCustomId(`${a}_${player!.id}`)
          .setDisabled(
            player!.coins < 7 && a === "coup"
              ? true
              : player!.coins < 3 && a === "assassinate"
              ? true
              : player!.coins > 9 && a !== "coup"
              ? true
              : false,
          ),
      ),
    ),
    new MessageActionRow().addComponents(
      ...actions.slice(3).map((a) =>
        new MessageButton()
          .setStyle(
            a === "coup" || a === "assassinate" ? "DANGER" : "SECONDARY",
          )
          .setLabel(
            `${getLabelForCoupAction(a)} ${
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
          )
          .setCustomId(`${a}_${player!.id}`)
          .setDisabled(
            player!.coins < 7 && a === "coup"
              ? true
              : player!.coins < 3 && a === "assassinate"
              ? true
              : player!.coins > 9 && a !== "coup"
              ? true
              : false,
          ),
      ),
    ),
  ];

  const messageWithActionButtons = await channel.send({
    content: `<@${player.id}>`,
    options: { embeds: [embed] },
    components: [...rows],
  });

  player.exchanging = false;
  player.influencesToReturn = undefined;
  player.voteReceivedFromIds = [];
  player.votesRequiredForAction = 0;

  let takenAction: CoupActionNameInClassic | undefined;

  const waitForPlayerTurnInCoup = new Promise<CoupGame | undefined | null>(
    (resolve) => {
      if (!game) {
        resolve(undefined);
        return;
      }

      game.eventEmitter.once(
        "action_income",
        ({ channelId: eventChannelId, player: p }) => {
          if (eventChannelId === channelId) {
            if (!game) {
              resolve(undefined);
              return;
            }

            coupActionsInClassic.income(channelId, game, p);

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
              .setAuthor({ name: player.name, iconURL: player.avatarURL })
              .setDescription(stripIndents`
                I want to take foreign aid. **2** coins please!
              
                ${oneLine`
                If you claim that you have a **duke**,
                you can block my foreign aid.
                If you don't, press allow button below.
                `}
              `);

            const row = new MessageActionRow().addComponents(
              new MessageButton()
                .setStyle("PRIMARY")
                .setLabel("Allow")
                .setCustomId("allow_action_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Block Foreign Aid")
                .setCustomId("block_foreign_aid_in_coup"),
              new MessageButton()
                .setStyle("SECONDARY")
                .setLabel("My Influences 🤫")
                .setCustomId("coup_show_influences"),
            );

            channel.send({
              content: activePlayers
                .filter((p) => p.id !== player.id)
                .map((p) => `<@${p.id}>`)
                .join(", "),
              options: { embeds: [embed] },
              components: [row],
            });

            game.players[currentPlayerIndex].decidedAction = "foreignAid";

            game.players[currentPlayerIndex].votesRequiredForAction =
              activePlayers.length - 2;

            takenAction = "foreignAid";

            resolve(game);
          }
        },
      );

      game.eventEmitter.once(
        "action_tax",
        ({ channelId: eventChannelId, player }) => {
          if (eventChannelId === channelId) {
            if (!game) {
              resolve(undefined);
              return;
            }

            const embed = new MessageEmbed()
              .setColor(flatColors.yellow)
              .setAuthor({ name: player.name, iconURL: player.avatarURL })
              .setDescription(stripIndents`
                I want to take tax using my duke. **3** coins please!
              
                ${oneLine`
                If you think I don't have a **duke**,
                you can challenge me.
                Otherwise, press allow button below.
                `}
              `);

            const influence: Influence["name"] = "duke";

            const row = new MessageActionRow().addComponents(
              new MessageButton()
                .setStyle("PRIMARY")
                .setLabel("Allow")
                .setCustomId("allow_action_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Challenge")
                .setCustomId(`challenge_${player.id}_${influence}_coup`),
            );

            channel.send({
              content: activePlayers
                .filter((p) => p.id !== player.id)
                .map((p) => `<@${p.id}>`)
                .join(", "),
              options: { embeds: [embed] },
              components: [row],
            });

            game.players[currentPlayerIndex].decidedAction = "tax";

            game.players[currentPlayerIndex].votesRequiredForAction =
              activePlayers.length - 2;

            takenAction = "tax";

            resolve(game);
          }
        },
      );

      game.eventEmitter.once(
        "action_steal",
        async ({
          channelId: eventChannelId,
          player,
        }: {
          channelId: string;
          player: CoupPlayer;
        }) => {
          if (eventChannelId === channelId) {
            if (!game) {
              resolve(undefined);
              return;
            }

            try {
              if (
                !(messageWithActionButtons instanceof Array) &&
                messageWithActionButtons.deletable
              ) {
                await messageWithActionButtons.delete();
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(error);
            }

            if (activePlayers.length === 2) {
              player.targetPlayerId = activePlayers.find(
                (p) => p.id !== player.id,
              )!.id;
            } else {
              const msg = await channel.send(
                `**<@${player.id}>, mention a player to steal from:**`,
              );

              await new Promise((resolve) => {
                if (!game) {
                  resolve(undefined);
                  return;
                }

                game.eventEmitter.once("got_target_player", () => {
                  resolve(true);
                });
              });

              msg.delete().catch(() => {});
            }

            if (!player.targetPlayerId) {
              resolve(undefined);
              return;
            }

            const targetPlayer = game.players.find(
              (p) => p.id === player.targetPlayerId,
            );

            if (!targetPlayer) {
              resolve(undefined);
              return;
            }

            const embed = new MessageEmbed()
              .setColor(flatColors.yellow)
              .setAuthor({ name: player.name, iconURL: player.avatarURL })
              .setDescription(stripIndents`
                I want to steal **2** coins from <@${
                  targetPlayer.id
                }> using my captain.
              
                ${oneLine`
                If you think I don't have a **captain**,
                you can challenge me.
                If you claim you have **ambassador** or **captain**,
                you can try to block me.
                Otherwise, press allow button below.
                `}
              `);

            const influence: Influence["name"] = "captain";

            const row = new MessageActionRow().addComponents(
              new MessageButton()
                .setStyle("PRIMARY")
                .setLabel("Allow")
                .setCustomId("allow_action_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Block Stealing")
                .setCustomId("block_stealing_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Challenge")
                .setCustomId(`challenge_${player.id}_${influence}_coup`),
            );

            channel.send({
              content: activePlayers
                .filter((p) => p.id !== player.id)
                .map((p) => `<@${p.id}>`)
                .join(", "),
              options: { embeds: [embed] },
              components: [row],
            });

            game.players[currentPlayerIndex].decidedAction = "steal";

            game.players[currentPlayerIndex].votesRequiredForAction =
              activePlayers.length - 2;

            takenAction = "steal";

            resolve(game);
          }
        },
      );

      game.eventEmitter.once(
        "action_assassinate",
        async ({
          channelId: eventChannelId,
          player,
        }: {
          channelId: string;
          player: CoupPlayer;
        }) => {
          if (eventChannelId === channelId) {
            if (!game || player.coins < 3) {
              resolve(undefined);
              return;
            }

            try {
              if (
                !(messageWithActionButtons instanceof Array) &&
                messageWithActionButtons.deletable
              ) {
                await messageWithActionButtons.delete();
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(error);
            }

            if (activePlayers.length === 2) {
              player.targetPlayerId = activePlayers.find(
                (p) => p.id !== player.id,
              )!.id;
            } else {
              const msg = await channel.send(
                oneLine`**<@${player.id}>, mention a player
                to assassinate one of their influences:**`,
              );

              await new Promise((resolve) => {
                if (!game) {
                  resolve(undefined);
                  return;
                }

                game.eventEmitter.once("got_target_player", () => {
                  resolve(true);
                });
              });

              msg.delete().catch(() => {});
            }

            if (!player.targetPlayerId) {
              resolve(undefined);
              return;
            }

            const targetPlayer = game.players.find(
              (p) => p.id === player.targetPlayerId,
            );

            if (!targetPlayer) {
              resolve(undefined);
              return;
            }

            const embed = new MessageEmbed()
              .setColor(flatColors.yellow)
              .setAuthor({ name: player.name, iconURL: player.avatarURL })
              .setDescription(stripIndents`
                I want to pay **3** coins to assasinate one of <@${
                  targetPlayer.id
                }>'s influences.
              
                ${oneLine`
                If you think I don't have an **assassin**,
                you can challenge me.
                If you claim you have a **contessa**,
                you can try to block me.
                Otherwise, press allow button below.
                `}
              `);

            const influence: Influence["name"] = "assassin";

            const row = new MessageActionRow().addComponents(
              new MessageButton()
                .setStyle("PRIMARY")
                .setLabel("Allow")
                .setCustomId("allow_action_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Block Assassination")
                .setCustomId("block_assassination_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Challenge")
                .setCustomId(`challenge_${player.id}_${influence}_coup`),
            );

            channel.send({
              content: activePlayers
                .filter((p) => p.id !== player.id)
                .map((p) => `<@${p.id}>`)
                .join(", "),
              options: { embeds: [embed] },
              components: [row],
            });

            game.players[currentPlayerIndex].decidedAction = "assassinate";

            game.players[currentPlayerIndex].votesRequiredForAction =
              activePlayers.length - 2;

            takenAction = "assassinate";

            resolve(game);
          }
        },
      );

      game.eventEmitter.once(
        "action_coup",
        async ({
          channelId: eventChannelId,
          player,
        }: {
          channelId: string;
          player: CoupPlayer;
        }) => {
          if (eventChannelId === channelId) {
            if (!game || player.coins < 3) {
              resolve(undefined);
              return;
            }

            try {
              if (
                !(messageWithActionButtons instanceof Array) &&
                messageWithActionButtons.deletable
              ) {
                await messageWithActionButtons.delete();
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(error);
            }

            if (activePlayers.length === 2) {
              player.targetPlayerId = activePlayers.find(
                (p) => p.id !== player.id,
              )!.id;
            } else {
              const msg = await channel.send(
                oneLine`**<@${player.id}>, mention a player
                to coup against:**`,
              );

              await new Promise((resolve) => {
                if (!game) {
                  resolve(undefined);
                  return;
                }

                game.eventEmitter.once("got_target_player", () => {
                  resolve(true);
                });
              });

              msg.delete().catch(() => {});
            }

            if (!player.targetPlayerId) {
              resolve(undefined);
              return;
            }

            game.players[currentPlayerIndex].decidedAction = "coup";

            takenAction = "coup";

            resolve(game);
          }
        },
      );

      game.eventEmitter.once(
        "action_exchange",
        ({ channelId: eventChannelId, player }) => {
          if (eventChannelId === channelId) {
            if (!game) {
              resolve(undefined);
              return;
            }

            const embed = new MessageEmbed()
              .setColor(flatColors.yellow)
              .setAuthor({ name: player.name, iconURL: player.avatarURL })
              .setDescription(stripIndents`
                I want to exchange influences using my ambassador.
              
                ${oneLine`
                If you think I don't have an **ambassador**,
                you can challenge me.
                Otherwise, press allow button below.
                `}
              `);

            const influence: Influence["name"] = "ambassador";

            const row = new MessageActionRow().addComponents(
              new MessageButton()
                .setStyle("PRIMARY")
                .setLabel("Allow")
                .setCustomId("allow_action_in_coup"),
              new MessageButton()
                .setStyle("DANGER")
                .setLabel("Challenge")
                .setCustomId(`challenge_${player.id}_${influence}_coup`),
            );

            channel.send({
              content: activePlayers
                .filter((p) => p.id !== player.id)
                .map((p) => `<@${p.id}>`)
                .join(", "),
              options: { embeds: [embed] },
              components: [row],
            });

            game.players[currentPlayerIndex].decidedAction = "exchange";

            game.players[currentPlayerIndex].votesRequiredForAction =
              activePlayers.length - 2;

            takenAction = "exchange";

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

  game.eventEmitter = game.eventEmitter.removeAllListeners();

  try {
    if (
      !(messageWithActionButtons instanceof Array) &&
      messageWithActionButtons.deletable &&
      takenAction !== "steal" &&
      takenAction !== "assassinate" &&
      takenAction !== "coup"
    ) {
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
    await handleIncome({ player, channel });
  } else if (takenAction === "foreignAid") {
    await handleForeignAid({ game, player, channel, channelId, activePlayers });
  } else if (takenAction === "tax") {
    await handleTax({ game, player, channel, channelId });
  } else if (takenAction === "steal") {
    await handleSteal({ game, player, channel, channelId, activePlayers });
  } else if (takenAction === "assassinate") {
    await handleAssassinate({
      game,
      player,
      channel,
      channelId,
      activePlayers,
    });
  } else if (takenAction === "coup") {
    await handleCoup({ game, player, channel, activePlayers, channelId });
  } else if (takenAction === "exchange") {
    await handleExchange({ game, player, channel });
  }

  game.eventEmitter = game.eventEmitter.removeAllListeners();

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
  eliminatedPlayer: CoupPlayer,
  channel: TextChannel,
  game: CoupGame,
) => {
  for (let i = 0; i < eliminatedPlayer.influences.length; i++) {
    eliminatedPlayer.influences[i].dismissed = true;
  }

  setCurrentCoupGame(channel.id, game);

  const embed = new MessageEmbed()
    .setAuthor({
      name: `Player Eliminated`,
      iconURL: eliminatedPlayer.avatarURL,
    })
    .setColor(flatColors.red)
    .setDescription(
      oneLine`${eliminatedPlayer.name}'s
      **${eliminatedPlayer.influences[0]?.name}** &
      **${eliminatedPlayer.influences[1]?.name}** got dismissed so
      ${eliminatedPlayer.name} is out of the game.`,
    );

  channel.send({ content: `<@${eliminatedPlayer.id}>`, embeds: [embed] });

  await sleep(2000);
};

export const handleChallenge = async ({
  channel,
  game,
  challengingPlayer,
  player,
  influenceName,
  influenceName2,
}: {
  channel: TextChannel;
  game: CoupGame;
  challengingPlayer: CoupPlayer;
  player: CoupPlayer;
  influenceName: Influence["name"];
  influenceName2?: Influence["name"];
}) => {
  let lostPlayer: CoupPlayer;

  const embed = new MessageEmbed()
    .setColor(flatColors.yellow)
    .setAuthor({
      name: challengingPlayer.name,
      iconURL: challengingPlayer.avatarURL,
    })
    .setDescription(
      oneLine`
            I challenge!
            ${player.name} doesn't have **${influenceName}**${
        influenceName2 ? ` or **${influenceName2}**` : ""
      }.
          `,
    );

  await channel.send({
    content: `<@${player.id}>`,
    embeds: [embed],
  });

  await sleep(2000);

  const foundInfluence = player.influences.find(
    (inf) =>
      !inf.dismissed &&
      ((influenceName2 &&
        (inf.name === influenceName || inf.name === influenceName2)) ||
        inf.name === influenceName),
  );

  if (foundInfluence) {
    const index = player.influences.findIndex(
      (inf) => inf.name === foundInfluence.name,
    );

    shuffleArray(game.deck);

    game.deck.push(player.influences[index]);

    player.influences[index] = { ...game.deck.shift()!, dismissed: false };

    shuffleArray(game.deck);

    lostPlayer = challengingPlayer;

    const activeInfluences = challengingPlayer.influences.filter(
      (inf) => !inf.dismissed,
    );

    if (activeInfluences.length === 2) {
      challengingPlayer.lostChallenge = true;

      setCurrentCoupGame(channel.id, game);

      const embed = new MessageEmbed()
        .setTitle("Challenge Failed")
        .setColor(flatColors.blue)
        .setThumbnail(foundInfluence.imageURL)
        .setDescription(
          oneLine`
            ${player.name} really had **${foundInfluence.name}**!
            Now **${challengingPlayer.name}** have to dismiss one of their
            influences by pressing \`Dismiss One Influence\` button.
            **${player.name}** will put **${foundInfluence.name}** in deck
            and check the __new influence__ from
            the deck by pressing \`My Influences\` button.
          `,
        );

      // {
      //   components: [
      //     {
      //       type: ComponentType.BUTTON,
      //       style: ButtonStyle.SECONDARY,
      //       label: `My Influences 🤫`,
      //       custom_id: `coup_show_influences`,
      //     },
      //     {
      //       type: ComponentType.BUTTON,
      //       style: ButtonStyle.PRIMARY,
      //       label: `Dismiss One Influence`,
      //       custom_id: `coup_show_influences`,
      //     },
      //   ],
      // },

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setLabel("My Influences 🤫")
          .setStyle("SECONDARY")
          .setCustomId("coup_show_influences"),
        new MessageButton()
          .setLabel("Dismiss One Influence")
          .setStyle("PRIMARY")
          .setCustomId("coup_show_influences"),
      );

      await channel.send({
        content: `<@${challengingPlayer.id}> & <@${player.id}>`,
        options: { embeds: [embed] },
        components: [row],
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
      const embed = new MessageEmbed()
        .setTitle("Challenge Failed")
        .setColor(flatColors.blue)
        .setThumbnail(foundInfluence.imageURL)
        .setDescription(
          oneLine`
            ${player.name} really had **${foundInfluence.name}**!
            Now **${player.name}** will check the new influence from
            the deck by pressing \`My Influences\` button.
          `,
        );

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setLabel("My Influences 🤫")
          .setStyle("SECONDARY")
          .setCustomId("coup_show_influences"),
      );

      await channel.send({
        content: `<@${player.id}>`,
        options: { embeds: [embed] },
        components: [row],
      });

      await sleep(2000);

      await eliminatePlayer(challengingPlayer, channel, game);
    }
  } else {
    lostPlayer = player;

    const activeInfluences = player.influences.filter((inf) => !inf.dismissed);

    if (activeInfluences.length === 2) {
      player.lostChallenge = true;

      setCurrentCoupGame(channel.id, game);

      const embed = new MessageEmbed()
        .setTitle("Challenge Succeeded")
        .setColor(flatColors.blue)
        .setDescription(
          oneLine`
            ${player.name}, you don't have any **${influenceName}**${
            influenceName2 ? ` or **${influenceName2}**` : ""
          }!
            Now you dismiss one of your influences.
          `,
        );

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setLabel("Dismiss One Influence")
          .setStyle("PRIMARY")
          .setCustomId("coup_show_influences"),
      );

      await channel.send({
        content: `<@${player.id}>`,
        options: { embeds: [embed] },
        components: [row],
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
      await eliminatePlayer(player, channel, game);
    }
  }

  return lostPlayer;
};
