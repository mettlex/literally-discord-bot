import { Client, MessageEmbed } from "discord.js";
import EventEmitter from "events";
import { ButtonStyle, ComponentType, SlashCreator } from "slash-create";
import { ExtendedMessage, ExtendedTextChannel } from "../../extension";
import {
  coupActionNamesInClassic,
  getCurrentCoupGame,
  getDescriptionFromCardName,
  influenceCardImagesClassic,
  setCurrentCoupGame,
} from "./data";
import { showInfluences } from "./slash-commands";
import { Influence, InfluenceCard, influenceCardNamesInClassic } from "./types";

export const handleInteractions = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", async (ctx) => {
    if (ctx.user.bot) {
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

      const playerId = player.id;

      if (playerId !== game.currentPlayer) {
        return;
      }

      const i = parseInt(ctx.customID.replace("coup_dismiss_influence_", ""));

      game.players[game.players.findIndex((p) => p.id === playerId)].influences[
        i
      ].dismissed = true;

      setCurrentCoupGame(ctx.channelID, game);
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

      if (typeof player.votesRequiredForAction === "number") {
        if (player.votesRequiredForAction <= 0) {
          game.eventEmitter.emit("all_players_allowed_action");
          return;
        }

        player.votesRequiredForAction--;

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
    }
  });
};
