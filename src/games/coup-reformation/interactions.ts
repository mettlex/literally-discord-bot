import { oneLine } from "common-tags";
import { Client, MessageEmbed, TextChannel } from "discord.js";
import EventEmitter from "events";
import { ButtonStyle, ComponentType, SlashCreator } from "slash-create";
import { flatColors } from "../../config";
import { getLiterallyUserModel } from "../../database";
import { ExtendedMessage, ExtendedTextChannel } from "../../extension";
import { hasVoted } from "../../top.gg/api";
import {
  coupActionNamesInClassic,
  getCurrentCoupGame,
  getDescriptionFromCardName,
  influenceCardImagesClassic,
  setCurrentCoupGame,
} from "./data";
import { showInfluences } from "./slash-commands";
import {
  ChallengeOrNotData,
  Influence,
  InfluenceCard,
  influenceCardNamesInClassic,
} from "./types";

const removeButtonsFromMessage = async (
  channel: ExtendedTextChannel,
  messageId: string,
  color: string = flatColors.red,
) => {
  try {
    const message = (await channel.messages.fetch(
      messageId,
    )) as ExtendedMessage;

    const oldEmbed = message.embeds[0];

    const embed = new MessageEmbed().setColor(color);

    if (oldEmbed.author?.name) {
      embed.setAuthor(
        oldEmbed.author.name,
        oldEmbed.author.iconURL,
        oldEmbed.author.url,
      );
    }

    if (oldEmbed.description) {
      embed.setDescription(oldEmbed.description);
    }

    if (oldEmbed.title) {
      embed.setTitle(oldEmbed.title);
    }

    if (oldEmbed.fields && oldEmbed.fields.length > 0) {
      embed.addFields(oldEmbed.fields);
    }

    if (oldEmbed.thumbnail?.url) {
      embed.setThumbnail(oldEmbed.thumbnail?.url);
    }

    if (oldEmbed.image?.url) {
      embed.setImage(oldEmbed.image?.url);
    }

    message.editWithComponents({
      content: message.content,
      options: { embed },
      components: [],
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};

export const handleInteractions = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", async (ctx) => {
    if (ctx.user.bot) {
      return;
    }

    const game = getCurrentCoupGame(ctx.channelID);

    const player = game?.players.find((p) => p.id === ctx.user.id);

    if (game && player && !player.influences.find((inf) => !inf.dismissed)) {
      await ctx.acknowledge();
      return;
    }

    const nextCustomIdPartial = "next_influence_card_";
    const previousCustomIdPartial = "previous_influence_card_";

    const changeCardEmbed = async (i: number) => {
      const channel = (await client.channels.fetch(
        ctx.channelID,
      )) as ExtendedTextChannel;

      const message = (await channel.messages.fetch(
        ctx.message.id,
      )) as ExtendedMessage;

      const keys = Object.keys(influenceCardImagesClassic).sort();

      const name = keys[i] as InfluenceCard["name"];

      const embed = new MessageEmbed()
        .setTitle(name.toUpperCase())
        .setDescription(getDescriptionFromCardName(name))
        .setImage(influenceCardImagesClassic[name][0]);

      message.editWithComponents({
        content: "",
        options: { embed },
        components: [
          {
            components: [
              {
                label: "Previous",
                custom_id: `previous_influence_card_${i - 1}`,
                disabled: i === 0,
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
              },
              {
                label: "Next",
                custom_id: `next_influence_card_${i + 1}`,
                disabled: i === keys.length - 1,
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
              },
            ],
          },
        ],
      });
    };

    if (ctx.customID === "coup_cs") {
      await ctx.send({
        ephemeral: true,
        embeds: [
          {
            title: "Coup Cheat Sheet",
            image: {
              url: "https://cdn.discordapp.com/attachments/848495134874271764/855743509926510602/coup_game_rules.png",
            },
          },
        ],
      });

      return;
    } else if (ctx.customID === "coup_show_influences") {
      await showInfluences(ctx).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

      return;
    } else if (ctx.customID.startsWith("coup_dismiss_influence_")) {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game) {
        return;
      }

      const player = game.players.find((p) => p.id === ctx.user.id);

      if (!player) {
        return;
      }

      const i = parseInt(ctx.customID.replace("coup_dismiss_influence_", ""));

      const influence = player.influences[i];

      influence.dismissed = true;

      player.lostChallenge = false;

      setCurrentCoupGame(ctx.channelID, game);

      game.eventEmitter.emit("dismissed_influence_in_coup", {
        dismissedInfluence: influence,
        dismissedInfluenceIndex: i,
      });

      const description = `I dismissed my **${influence.name.toUpperCase()}**.`;

      const embed = new MessageEmbed()
        .setColor(flatColors.red)
        .setAuthor(player.name, player.avatarURL)
        .setThumbnail(influence.imageURL)
        .setDescription(description);

      const channel = (await client.channels.fetch(
        ctx.channelID,
      )) as TextChannel;

      channel.send(embed);

      return;
    } else if (ctx.customID.startsWith("coup_return_influence_")) {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game) {
        return;
      }

      const player = game.players.find((p) => p.id === ctx.user.id);

      if (
        !player ||
        game.currentPlayer !== player.id ||
        !player.influencesToReturn
      ) {
        return;
      }

      const i = parseInt(ctx.customID.replace("coup_return_influence_", ""));

      const influence = player.influences[i];

      if (influence.returned) {
        await ctx.send(
          oneLine`**${player.name}**, this influence has already been returned.
          Select another influence.`,
        );

        return;
      }

      influence.returned = true;

      if (player.influencesToReturn === 0 || player.exchanging === false) {
        setCurrentCoupGame(ctx.channelID, game);

        game.eventEmitter.emit("exchange_completed_in_coup");

        const description = oneLine`
          I completed the exchange and
          returned 2 influences to the deck.
        `;

        const embed = new MessageEmbed()
          .setColor(flatColors.blue)
          .setAuthor(player.name, player.avatarURL)
          .setDescription(description);

        const channel = (await client.channels.fetch(
          ctx.channelID,
        )) as TextChannel;

        channel.send(embed);

        return;
      } else {
        player.influencesToReturn--;

        if (player.influencesToReturn === 0) {
          player.exchanging = false;

          game.eventEmitter.emit("exchange_completed_in_coup");

          const description = oneLine`
          I completed the exchange and
          returned 2 influences to the deck.
        `;

          const embed = new MessageEmbed()
            .setColor(flatColors.blue)
            .setAuthor(player.name, player.avatarURL)
            .setDescription(description);

          const channel = (await client.channels.fetch(
            ctx.channelID,
          )) as TextChannel;

          channel.send(embed);
        } else {
          await ctx.send(
            `**${player.name}** returned 1 influence. 1 more left to return.`,
            {
              ephemeral: true,
              components: [
                {
                  type: ComponentType.ACTION_ROW,
                  components: [
                    {
                      type: ComponentType.BUTTON,
                      style: ButtonStyle.PRIMARY,
                      label: "Return One Influence",
                      custom_id: "coup_show_influences",
                    },
                  ],
                },
              ],
            },
          );
        }

        setCurrentCoupGame(ctx.channelID, game);

        return;
      }
    } else if (ctx.customID.startsWith(nextCustomIdPartial)) {
      const i = parseInt(ctx.customID.replace(nextCustomIdPartial, ""));
      changeCardEmbed(i).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    } else if (ctx.customID.startsWith(previousCustomIdPartial)) {
      const i = parseInt(ctx.customID.replace(previousCustomIdPartial, ""));
      changeCardEmbed(i).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    } else if (ctx.customID === "join_coup") {
      const voted = await hasVoted(ctx.user.id);

      const LiterallyUser = await getLiterallyUserModel();

      const literallyUser = await LiterallyUser.findOrCreate({
        id: ctx.user.id,
      });

      if (literallyUser) {
        if (
          voted === false &&
          literallyUser.specialGamesPlayedAt &&
          literallyUser.specialGamesPlayedAt.length > 4
        ) {
          const embed = new MessageEmbed()
            .setColor(flatColors.green)
            .setTitle("Please upvote Literally")
            .setThumbnail(
              "https://cdn.discordapp.com/attachments/848495134874271764/858672943130607656/tenor.gif",
            ).setDescription(oneLine`It takes only a minute
            to vote for Literally on Top.gg website. Just do it!`);

          ctx.send(
            oneLine`**${ctx.user.mention}, please vote on Top.gg
            and then join the game.**`,
            {
              embeds: [embed.toJSON()],
              components: [
                {
                  type: ComponentType.ACTION_ROW,
                  components: [
                    {
                      label: "Vote for Literally",
                      type: ComponentType.BUTTON,
                      // @ts-ignore
                      style: ButtonStyle.LINK,
                      url: "https://top.gg/bot/842397311916310539/vote",
                    },
                  ],
                },
              ],
            },
          );

          return;
        } else if (
          voted === false &&
          literallyUser.specialGamesPlayedAt &&
          literallyUser.specialGamesPlayedAt.length <= 4
        ) {
          const embed = new MessageEmbed()
            .setColor(flatColors.green)
            .setTitle("Please upvote Literally")
            .setImage(
              "https://cdn.discordapp.com/attachments/848495134874271764/858666036655816704/justdoit.gif",
            ).setDescription(oneLine`It takes only a minute
            to vote for Literally on Top.gg website. Just do it!`);

          ctx
            .send(oneLine`${ctx.user.mention}`, {
              embeds: [embed.toJSON()],
              components: [
                {
                  type: ComponentType.ACTION_ROW,
                  components: [
                    {
                      label: "Vote for Literally",
                      type: ComponentType.BUTTON,
                      // @ts-ignore
                      style: ButtonStyle.LINK,
                      url: "https://top.gg/bot/842397311916310539/vote",
                    },
                  ],
                },
              ],
            })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });
        }

        if (!literallyUser.specialGamesPlayedAt) {
          literallyUser.specialGamesPlayedAt = [];
        }

        if (literallyUser.specialGamesPlayedAt.length > 4) {
          literallyUser.specialGamesPlayedAt.shift();
        }

        literallyUser.specialGamesPlayedAt.push(new Date());

        literallyUser.save();
      }

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game) {
        ctx.send("There is no Coup game running.");
        return;
      }

      if (game.gameStarted) {
        ctx.send("The game started already so it's not joinable now.");
        return;
      }

      if (game.players.find((p) => p.id === ctx.user.id)) {
        ctx.send("You already joined the game.");
        return;
      }

      game.players.push({
        id: ctx.user.id,
        tag: `${ctx.user.username}#${ctx.user.discriminator}`,
        name: ctx.member?.nick || ctx.user.username,
        coins: 2,
        influences: [],
        avatarURL:
          ctx.user.dynamicAvatarURL() ||
          ctx.user.avatarURL ||
          ctx.user.defaultAvatarURL,
      });

      ctx.send(`${ctx.user.mention} joined the game.`);
    }

    const actionName = coupActionNamesInClassic.find((a) =>
      ctx.customID.startsWith(a),
    );

    if (actionName && /_\d+$/g.test(ctx.customID)) {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

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

      if (game.mode === "classic") {
        if (!actionName) {
          return;
        }

        const playerId = ctx.customID.replace(`${actionName}_`, "");

        const player = game.players.find(
          (p) =>
            p.influences[0] &&
            p.influences[1] &&
            (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
            p.id === playerId,
        );

        if (!player) {
          return;
        }

        if (playerId !== game.currentPlayer || playerId !== ctx.user.id) {
          return;
        }

        const actionEventName = `action_${actionName}`;

        game.eventEmitter.emit(actionEventName, {
          channelId: ctx.channelID,
          player,
        });
      }

      return;
    }

    const channel = (await client.channels.fetch(
      ctx.channelID,
    )) as ExtendedTextChannel;

    if (ctx.customID === "allow_action_in_coup") {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      if (game.currentPlayer === ctx.user.id) {
        return;
      }

      const player = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === game.currentPlayer,
      );

      if (!player) {
        return;
      }

      if (!(player.voteReceivedFromIds instanceof Array)) {
        player.voteReceivedFromIds = [];
      }

      if (player.voteReceivedFromIds.includes(ctx.user.id)) {
        return;
      }

      if (typeof player.votesRequiredForAction === "number") {
        if (player.votesRequiredForAction <= 0) {
          player.voteReceivedFromIds = [];
          game.eventEmitter.emit("all_players_allowed_action");
          removeButtonsFromMessage(channel, ctx.message.id, flatColors.green);
          return;
        }

        player.votesRequiredForAction--;

        player.voteReceivedFromIds.push(ctx.user.id);

        setCurrentCoupGame(ctx.channelID, game);
      }
    } else if (ctx.customID === "block_foreign_aid_in_coup") {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      if (game.currentPlayer === ctx.user.id) {
        return;
      }

      const player = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === game.currentPlayer,
      );

      if (!player) {
        return;
      }

      const blockingPlayer = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === ctx.user.id &&
          p.id !== player.id,
      );

      if (!blockingPlayer) {
        return;
      }

      const action = coupActionNamesInClassic.find((a) => a === "foreignAid");
      const influence: Influence["name"] | undefined =
        influenceCardNamesInClassic.find((inf) => inf === "duke");

      game.eventEmitter.emit("block", {
        player,
        blockingPlayer,
        action,
        influence,
      });

      removeButtonsFromMessage(channel, ctx.message.id, flatColors.red);
    } else if (ctx.customID === "let_go_in_coup") {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      const player = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === game.currentPlayer,
      );

      if (!player) {
        return;
      }

      if (!player.blockingPlayerId) {
        return;
      }

      const blockingPlayer = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === player.blockingPlayerId,
      );

      if (!blockingPlayer || blockingPlayer.id === ctx.user.id) {
        return;
      }

      if (!(blockingPlayer.voteReceivedFromIds instanceof Array)) {
        blockingPlayer.voteReceivedFromIds = [];
      }

      if (blockingPlayer.voteReceivedFromIds.includes(ctx.user.id)) {
        return;
      }

      if (typeof blockingPlayer.votesRequiredForAction === "number") {
        if (blockingPlayer.votesRequiredForAction <= 0) {
          blockingPlayer.voteReceivedFromIds = [];
          const answer: ChallengeOrNotData = { challenging: false };
          game.eventEmitter.emit("challenged_or_not", answer);
          removeButtonsFromMessage(channel, ctx.message.id, flatColors.green);
          return;
        }

        blockingPlayer.votesRequiredForAction--;

        blockingPlayer.voteReceivedFromIds.push(ctx.user.id);

        setCurrentCoupGame(ctx.channelID, game);
      }
    } else if (/^challenge_\d+_\w+_?\w*_coup$/gi.test(ctx.customID)) {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      const challengingPlayer = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === ctx.user.id,
      );

      if (!challengingPlayer) {
        return;
      }

      const match =
        // eslint-disable-next-line max-len
        /^challenge_(?<challengedPlayerId>\d+)_(?<influenceName>\w+)_coup$/i.exec(
          ctx.customID,
        );

      const match2 =
        // eslint-disable-next-line max-len
        /^challenge_(?<challengedPlayerId>\d+)_(?<influenceName>\w+)_(?<influenceName2>\w+)_coup$/i.exec(
          ctx.customID,
        );

      if (!match || !match.groups) {
        return;
      }

      if (match2 && match2.groups && match2.groups.influenceName2) {
        const { challengedPlayerId, influenceName, influenceName2 } =
          match2.groups as {
            challengedPlayerId: string;
            influenceName: Influence["name"];
            influenceName2: Influence["name"];
          };

        if (
          !challengedPlayerId ||
          !influenceName ||
          !influenceName2 ||
          challengingPlayer.id === challengedPlayerId
        ) {
          return;
        }

        const answer: ChallengeOrNotData = {
          challenging: true,
          challengingPlayer,
          influenceName,
          influenceName2,
        };

        game.eventEmitter.emit("challenged_or_not", answer);
      } else {
        const { challengedPlayerId, influenceName } = match.groups as {
          challengedPlayerId: string;
          influenceName: Influence["name"];
          influenceName2?: Influence["name"];
        };

        if (
          !challengedPlayerId ||
          !influenceName ||
          challengingPlayer.id === challengedPlayerId
        ) {
          return;
        }

        const answer: ChallengeOrNotData = {
          challenging: true,
          challengingPlayer,
          influenceName,
        };

        game.eventEmitter.emit("challenged_or_not", answer);
      }

      removeButtonsFromMessage(channel, ctx.message.id, flatColors.red);
    } else if (ctx.customID === "block_stealing_in_coup") {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      if (game.currentPlayer === ctx.user.id) {
        return;
      }

      const player = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === game.currentPlayer,
      );

      if (!player) {
        return;
      }

      const blockingPlayer = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === ctx.user.id &&
          p.id !== player.id,
      );

      if (!blockingPlayer) {
        return;
      }

      const action = coupActionNamesInClassic.find((a) => a === "steal");
      const influences: Influence["name"][] = ["ambassador", "captain"];

      game.eventEmitter.emit("block", {
        player,
        blockingPlayer,
        action,
        influences,
      });

      removeButtonsFromMessage(channel, ctx.message.id, flatColors.red);
    } else if (ctx.customID === "block_assassination_in_coup") {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      if (game.currentPlayer === ctx.user.id) {
        return;
      }

      const player = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === game.currentPlayer,
      );

      if (!player) {
        return;
      }

      const blockingPlayer = game.players.find(
        (p) =>
          p.influences[0] &&
          p.influences[1] &&
          (!p.influences[0].dismissed || !p.influences[1].dismissed) &&
          p.id === ctx.user.id &&
          p.id !== player.id,
      );

      if (!blockingPlayer) {
        return;
      }

      const action = coupActionNamesInClassic.find((a) => a === "assassinate");
      const influence: Influence["name"] = "contessa";

      game.eventEmitter.emit("block", {
        player,
        blockingPlayer,
        action,
        influence,
      });

      removeButtonsFromMessage(channel, ctx.message.id, flatColors.red);
    }
  });
};
