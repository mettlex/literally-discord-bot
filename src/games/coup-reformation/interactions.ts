import { Client, MessageEmbed, TextChannel } from "discord.js";
import EventEmitter from "events";
import { ButtonStyle, ComponentType, SlashCreator } from "slash-create";
import { flatColors } from "../../config";
import { ExtendedMessage, ExtendedTextChannel } from "../../extension";
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

      game.eventEmitter.emit("dismissed_influence_in_coup");

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

        const player = game.players.find((p) => p.id === playerId);

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

      const player = game.players.find((p) => p.id === game.currentPlayer);

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

      const player = game.players.find((p) => p.id === game.currentPlayer);

      if (!player) {
        return;
      }

      const blockingPlayer = game.players.find(
        (p) => p.id === ctx.user.id && p.id !== player.id,
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

      const player = game.players.find((p) => p.id === game.currentPlayer);

      if (!player) {
        return;
      }

      if (!player.blockingPlayer) {
        return;
      }

      if (!(player.blockingPlayer.voteReceivedFromIds instanceof Array)) {
        player.blockingPlayer.voteReceivedFromIds = [];
      }

      if (player.blockingPlayer.voteReceivedFromIds.includes(ctx.user.id)) {
        return;
      }

      if (typeof player.blockingPlayer.votesRequiredForAction === "number") {
        if (player.blockingPlayer.votesRequiredForAction <= 0) {
          player.blockingPlayer.voteReceivedFromIds = [];
          const answer: ChallengeOrNotData = { challenging: false };
          game.eventEmitter.emit("challenged_or_not", answer);
          removeButtonsFromMessage(channel, ctx.message.id, flatColors.green);
          return;
        }

        player.blockingPlayer.votesRequiredForAction--;

        player.blockingPlayer.voteReceivedFromIds.push(ctx.user.id);

        setCurrentCoupGame(ctx.channelID, game);
      }
    } else if (/challenge_\d+_\w+_coup/gi.test(ctx.customID)) {
      await ctx.acknowledge();

      const game = getCurrentCoupGame(ctx.channelID);

      if (!game || !game.gameStarted) {
        return;
      }

      const challengingPlayer = game.players.find((p) => p.id === ctx.user.id);

      if (!challengingPlayer) {
        return;
      }

      const match =
        /challenge_(?<blockingPlayerId>\d+)_(?<influenceName>\w+)_coup/gi.exec(
          ctx.customID,
        );

      if (!match || !match.groups) {
        return;
      }

      const { blockingPlayerId, influenceName } = match.groups as {
        blockingPlayerId: string;
        influenceName: Influence["name"];
      };

      if (!blockingPlayerId || !influenceName) {
        return;
      }

      const answer: ChallengeOrNotData = {
        challenging: true,
        challengingPlayer,
        influenceName,
      };

      game.eventEmitter.emit("challenged_or_not", answer);

      removeButtonsFromMessage(channel, ctx.message.id, flatColors.red);
    }
  });
};
