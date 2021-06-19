import { oneLine } from "common-tags";
import { Client, MessageEmbed } from "discord.js";
import { ButtonStyle, ComponentType, SlashCreator } from "slash-create";
import { setupGame } from "../setup";
import { Action } from "../types";
import { prefixes, timeToJoinInSeconds } from "./config";
import { flatColors } from "../../config";
import {
  coupActionNamesInClassic,
  getCurrentCoupGame,
  getDescriptionFromCardName,
  getInitialMessageAndEmbed,
  influenceCardImagesClassic,
  setCurrentCoupGame,
} from "./data";
import { sendCoupHelpMessage } from "./handlers/help";
import { ExtendedMessage, ExtendedTextChannel } from "../../extension";
import { getGuildIds } from "../../app";
import {
  makeCoupCommands,
  showInfluences,
  slashCommandOptionsForCheckCards,
} from "./slash-commands";
import { ActionEventName, InfluenceCard } from "./types";
import { askToJoinCoupGame, changeCoupTurn, startCoupGame } from "./game-loop";
import EventEmitter from "events";

export const actions: Action[] = [
  {
    commands: ["fs", "force-start", "force start"],
    handler: async (message) => {
      if (message.author.bot || message.channel.type !== "text") {
        return;
      }

      if (!message.member?.hasPermission("MANAGE_GUILD")) {
        return;
      }

      const initialData = getInitialMessageAndEmbed(message.channel.id);

      if (initialData) {
        const { message: initialMessage, embed, interval } = initialData;

        embed.setColor(flatColors.blue);
        embed.fields[0].name = `Time up!`;
        embed.fields[0].value = `Let's see who joined below.`;

        try {
          await initialMessage.edit(embed);
          clearInterval(interval);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }

      const game = getCurrentCoupGame(message.channel.id);

      if (game && !game.gameStarted) {
        startCoupGame(message);
      } else if (game && game.gameStarted) {
        changeCoupTurn(message);
      } else {
        message.reply(
          oneLine`there is no initiated game so
          please use \`${prefixes[0]}start\` to initiate.`,
        );
      }
    },
    description: oneLine`Start the game immediately ignoring
      the ${timeToJoinInSeconds} seconds time to join.`,
  },
  {
    commands: ["h", "help"],
    handler: sendCoupHelpMessage,
    description: "Display help message",
  },
  {
    commands: ["c", "check"],
    handler: (message) => {
      if (message.author.bot || message.channel.type !== "text") {
        return;
      }

      const channel = message.channel as ExtendedTextChannel;

      channel
        .send({
          content: oneLine`Use \`/${slashCommandOptionsForCheckCards.name}\`
          slash command to check your influence cards secretly.`,
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    },
    description: "Check your own Influence Cards secretly.",
  },
  {
    commands: ["allcards", "all cards"],
    handler: async (message) => {
      if (message.author.bot || message.channel.type !== "text") {
        return;
      }

      const keys = Object.keys(influenceCardImagesClassic).sort();

      const name = keys[0] as InfluenceCard["name"];

      const embed = new MessageEmbed()
        .setTitle(name.toUpperCase())
        .setDescription(getDescriptionFromCardName(name))
        .setImage(influenceCardImagesClassic[name][0]);

      const channel = message.channel as ExtendedTextChannel;

      channel.sendWithComponents({
        content: "",
        options: { embed },
        components: [
          {
            components: [
              {
                label: "Previous",
                custom_id: "previous_influence_card_1",
                disabled: true,
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
              },
              {
                label: "Next",
                custom_id: "next_influence_card_1",
                disabled: false,
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
              },
            ],
          },
        ],
      });
    },
    description: "Show all available influence cards.",
  },
  {
    commands: ["stop"],
    handler: (message) => {
      if (message.author.bot || message.channel.type !== "text") {
        return;
      }

      if (!message.member?.hasPermission("MANAGE_GUILD")) {
        message.reply(
          oneLine`Only a member with Manage Server permission
          can force-stop the game.`,
        );
        return;
      }

      const game = getCurrentCoupGame(message.channel.id);

      if (!game) {
        message.reply("There is no Coup game running.");
        return;
      }

      setCurrentCoupGame(message.channel.id, null);

      message.channel.send("> Successfully stopped the current Coup game.");
    },
  },
  {
    commands: ["s", "start", "begin"],
    handler: (message) => {
      if (message.author.bot) {
        return;
      }

      let game = getCurrentCoupGame(message.channel.id);

      if (game) {
        message.reply("There is already a Coup game running.");
        return;
      }

      game = {
        gameStarted: false,
        gameStartedAt: new Date(),
        mode: "classic",
        deck: [],
        players: [
          {
            id: message.author.id,
            tag: message.author.tag,
            name: message.member?.nickname || message.author.username,
            coins: 2,
            influences: [],
            avatarURL:
              message.author.avatarURL({ dynamic: true }) ||
              message.author.avatarURL() ||
              message.author.defaultAvatarURL,
          },
        ],
        currentPlayer: message.author.id,
        turnCount: 0,
        eventEmitter: new EventEmitter(),
      };

      setCurrentCoupGame(message.channel.id, game);

      askToJoinCoupGame(message).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    },
    description: "Start a new Coup game in the current text channel.",
  },
  {
    commands: ["j", "join"],
    handler: (message) => {
      const game = getCurrentCoupGame(message.channel.id);

      if (!game) {
        message.reply("There is no Coup game running.");
        return;
      }

      if (game.gameStarted) {
        message.reply("The game started already so it's not joinable now.");
        return;
      }

      if (game.players.find((p) => p.id === message.author.id)) {
        message.reply("You already joined the game.");
        return;
      }

      game.players.push({
        id: message.author.id,
        tag: message.author.tag,
        name: message.member?.nickname || message.author.username,
        coins: 2,
        influences: [],
        avatarURL:
          message.author.avatarURL({ dynamic: true }) ||
          message.author.avatarURL() ||
          message.author.defaultAvatarURL,
      });

      message.channel.send(`${message.author} joined the game.`);
    },
    description: "Join the Coup game",
  },
];

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommands(makeCoupCommands(guildIDs));
};

export const setupCoupReformationGame = (
  client: Client,
  creator: SlashCreator,
) => {
  setupGame(client, prefixes, [...actions]);

  let guildIDs = getGuildIds();

  registerCommnads(creator, guildIDs);

  setInterval(() => {
    const newGuildIds = getGuildIds();

    const foundNewGuildIds = newGuildIds.filter((id) => !guildIDs.includes(id));

    if (foundNewGuildIds.length > 0) {
      guildIDs = newGuildIds;

      registerCommnads(creator, foundNewGuildIds);

      creator.syncCommands({ syncGuilds: true });
    }
  }, 3000);

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

        const actionEventName: ActionEventName = `action_${actionName}`;

        game.eventEmitter.emit(actionEventName, {
          channelId: ctx.channelID,
          player,
        });
      }

      return;
    }
  });
};
