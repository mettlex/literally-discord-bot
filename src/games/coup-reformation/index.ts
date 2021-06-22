import { oneLine } from "common-tags";
import { Client, Message, MessageEmbed, TextChannel } from "discord.js";
import { ButtonStyle, ComponentType, SlashCreator } from "slash-create";
import { setupGame } from "../setup";
import { Action } from "../types";
import { prefixes, timeToJoinInSeconds } from "./config";
import { flatColors } from "../../config";
import {
  getAllCurrentCoupGames,
  getCurrentCoupGame,
  getDescriptionFromCardName,
  getInitialMessageAndEmbed,
  influenceCardImagesClassic,
  setCurrentCoupGame,
} from "./data";
import { sendCoupHelpMessage } from "./handlers/help";
import { ExtendedTextChannel } from "../../extension";
import { getGuildIds } from "../../app";
import {
  makeCoupCommands,
  slashCommandOptionsForCheckCards,
} from "./slash-commands";
import { InfluenceCard } from "./types";
import { askToJoinCoupGame, changeCoupTurn, startCoupGame } from "./game-loop";
import EventEmitter from "events";
import { handleInteractions } from "./interactions";

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
        startMessageId: message.id,
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

export const setupCoupReformationGame = async (
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

  handleInteractions(client, creator);

  try {
    const currentCoupGames = getAllCurrentCoupGames();

    for (const channelId in currentCoupGames) {
      if (typeof channelId === "string") {
        const game = currentCoupGames[channelId];

        if (!game) {
          continue;
        }

        let message: Message | undefined;

        if (!game.startMessageId) {
          const channel = (await client.channels.fetch(
            channelId,
          )) as TextChannel;

          message = (await channel.messages.fetch({ limit: 1 })).first();
        }

        if (!message) {
          continue;
        }

        if (game.gameStarted) {
          changeCoupTurn(message);
        } else {
          startCoupGame(message);
        }
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};
