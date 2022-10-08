import { oneLine } from "common-tags";
import {
  Client,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import { SlashCreator } from "slash-create";
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
import {
  makeCoupCommands,
  slashCommandOptionsForCheckCards,
} from "./slash-commands";
import { InfluenceCard } from "./types";
import { askToJoinCoupGame, changeCoupTurn, startCoupGame } from "./game-loop";
import EventEmitter from "events";
import { handleInteractions } from "./interactions";
import { hasVoted } from "../../top.gg/api";
import { getLiterallyUserModel } from "../../database";
import sleep from "../../utils/sleep";
import { getGuildIds } from "../../utils/shards";

export const actions: Action[] = [
  {
    commands: ["h", "help"],
    handler: sendCoupHelpMessage,
    description: "Display help message (cheat sheet & video tutorial)",
  },
  {
    commands: ["fs", "force-start", "force start"],
    handler: async (message) => {
      if (message.author.bot || message.channel.type !== "GUILD_TEXT") {
        return;
      }

      if (!message.member?.permissions.has("MANAGE_GUILD")) {
        return;
      }

      const initialData = getInitialMessageAndEmbed(message.channel.id);

      if (initialData) {
        const { message: initialMessage, embed, interval } = initialData;

        embed.setColor(flatColors.blue);
        embed.fields[0].name = `Time up!`;
        embed.fields[0].value = `Let's see who joined below.`;

        try {
          await initialMessage.edit({ embeds: [embed] });
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
    commands: ["c", "check"],
    handler: (message) => {
      if (message.author.bot || message.channel.type !== "GUILD_TEXT") {
        return;
      }

      const channel = message.channel as TextChannel;

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
      if (message.author.bot || message.channel.type !== "GUILD_TEXT") {
        return;
      }

      const keys = Object.keys(influenceCardImagesClassic).sort();

      const name = keys[0] as InfluenceCard["name"];

      const embed = new MessageEmbed()
        .setTitle(name.toUpperCase())
        .setDescription(getDescriptionFromCardName(name))
        .setImage(influenceCardImagesClassic[name][0]);

      const channel = message.channel as TextChannel;

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setLabel("Previous")
          .setCustomId("previous_influence_card_1")
          .setDisabled(true)
          .setStyle("PRIMARY"),
        new MessageButton()
          .setLabel("Next")
          .setCustomId("next_influence_card_1")
          .setDisabled(false)
          .setStyle("PRIMARY"),
      );

      channel.send({
        content: "​",
        embeds: [embed],
        components: [row],
      });
    },
    description: "Show all available influence cards.",
  },
  {
    commands: ["stop"],
    handler: (message) => {
      if (message.author.bot || message.channel.type !== "GUILD_TEXT") {
        return;
      }

      if (!message.member?.permissions.has("MANAGE_GUILD")) {
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
    description: oneLine`
      Stop the running Coup game
      (requires __Manage Server__ permission)
    `,
  },
  {
    commands: ["s", "start", "begin"],
    handler: async (message) => {
      if (message.author.bot || message.channel.type !== "GUILD_TEXT") {
        return;
      }

      const voted = await hasVoted(message.author.id);

      const LiterallyUser = getLiterallyUserModel();

      const literallyUser = await LiterallyUser.findOrCreate({
        id: message.author.id,
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

          const channel = message.channel as TextChannel;

          const row = new MessageActionRow().addComponents(
            new MessageButton()
              .setLabel("Vote for Literally")
              .setStyle("LINK")
              .setURL("https://top.gg/bot/842397311916310539/vote"),
          );

          channel
            .send({
              content: oneLine`**${message.author}, please vote on Top.gg
              and then start the game.**`,
              options: { embeds: [embed] },
              components: [row],
            })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });

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

          const channel = message.channel as TextChannel;

          const row = new MessageActionRow().addComponents(
            new MessageButton()
              .setLabel("Vote for Literally")
              .setStyle("LINK")
              .setURL("https://top.gg/bot/842397311916310539/vote"),
          );

          await channel
            .send({
              content: oneLine`${message.author}`,
              options: { embeds: [embed] },
              components: [row],
            })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });

          await sleep(5000);
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
    handler: async (message) => {
      const game = getCurrentCoupGame(message.channel.id);

      if (!game) {
        message.reply("There is no Coup game running.");
        return;
      }

      const voted = await hasVoted(message.author.id);

      const LiterallyUser = getLiterallyUserModel();

      const literallyUser = await LiterallyUser.findOrCreate({
        id: message.author.id,
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

          const channel = message.channel as TextChannel;

          const row = new MessageActionRow().addComponents(
            new MessageButton()
              .setLabel("Vote for Literally")
              .setStyle("LINK")
              .setURL("https://top.gg/bot/842397311916310539/vote"),
          );

          channel
            .send({
              content: oneLine`**${message.author}, please vote on Top.gg
              and then join the game.**`,
              options: { embeds: [embed] },
              components: [row],
            })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });

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

          const channel = message.channel as TextChannel;

          const row = new MessageActionRow().addComponents(
            new MessageButton()
              .setLabel("Vote for Literally")
              .setStyle("LINK")
              .setURL("https://top.gg/bot/842397311916310539/vote"),
          );

          await channel
            .send({
              content: oneLine`${message.author}`,
              options: { embeds: [embed] },
              components: [row],
            })
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });

          await sleep(5000);
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

  let guildIDs = await getGuildIds(client);

  registerCommnads(creator, guildIDs);

  setInterval(async () => {
    const newGuildIds = await getGuildIds(client);

    const foundNewGuildIds = newGuildIds.filter((id) => !guildIDs.includes(id));

    if (foundNewGuildIds.length > 0) {
      guildIDs = newGuildIds;

      registerCommnads(creator, foundNewGuildIds);

      creator.syncCommands({ syncGuilds: true });
    }
  }, 3000);

  client.on("messageCreate", (message) => {
    const firstMentionedUser = message.mentions.users.first();

    if (message.author.bot || !firstMentionedUser) {
      return;
    }

    if (message.content.includes(client.user!.id)) {
      message.content = message.content.replace(/<@\d+>/g, "").trim();
    }

    if (message.content.trim().length === 0) {
      return;
    }

    const game = getCurrentCoupGame(message.channel.id);

    if (!game) {
      return;
    }

    if (game.currentPlayer !== message.author.id) {
      return;
    }

    const player = game.players.find((p) => p.id === message.author.id);

    if (!player) {
      return;
    }

    const targetPlayer = game.players.find(
      (p) => p.id === firstMentionedUser.id,
    );

    if (!targetPlayer || player.id === targetPlayer.id) {
      return;
    }

    if (!targetPlayer.influences.find((inf) => !inf.dismissed)) {
      message.reply(
        oneLine`${targetPlayer.name} is out of the game
        for having all influences dismissed.`,
      );

      return;
    }

    player.targetPlayerId = targetPlayer.id;

    game.eventEmitter.emit("got_target_player");
  });

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

        const channel = (await client.channels.fetch(channelId)) as TextChannel;

        if (!game.startMessageId) {
          message = (await channel.messages.fetch({ limit: 1 })).first();
        } else {
          message = await channel.messages.fetch(game.startMessageId);
        }

        if (!message) {
          continue;
        }

        if (game.gameStarted) {
          channel.send(
            oneLine`> **The bot needed a technical restart.
            Please resume the game by selecting an action.**`,
          );

          changeCoupTurn(message);
        } else {
          channel.send(
            oneLine`> **The bot needed a technical restart.
            Please rejoin the game.**`,
          );

          askToJoinCoupGame(message);
        }
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};
