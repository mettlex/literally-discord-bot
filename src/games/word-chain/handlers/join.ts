import { addSeconds, differenceInSeconds } from "date-fns";
import {
  Client,
  ColorResolvable,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import { prefixes, secondsToJoin } from "../config";
import { flatColors } from "../../../config";
import { actions, getAllActiveGames } from "..";
import { ComponentContext } from "slash-create";

export const join = (message: Message) => {
  const joinAction = actions.find((a) => a.commands.includes("join"))!;

  const channelId = message.channel.id;

  const activeGames = getAllActiveGames();

  if (!activeGames[channelId]?.joinable) {
    const embed = new MessageEmbed()
      .setDescription(`The game is not joinable. ${message.author}`)
      .setColor(flatColors.red as ColorResolvable);

    message.reply({ embeds: [embed] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    return;
  }

  if (activeGames[channelId]) {
    if (activeGames[channelId]!.userIds.includes(message.author.id)) {
      return;
    }

    activeGames[channelId] = {
      ...activeGames[channelId]!,
      userIds: [...activeGames[channelId]!.userIds, message.author.id],
      playerLives: {
        ...activeGames[channelId]!.playerLives,
        [message.author.id]: activeGames[channelId]!.maxLives,
      },
    };

    const embed = new MessageEmbed()
      .setDescription(`${message.author} joined the game.`)
      .addField(
        "How to join",
        `Send \`${prefixes[0]}${joinAction.commands[0]}\` or \`${prefixes[0]}${
          joinAction.commands[joinAction.commands.length - 1]
        }\` here in this channel to join`,
      )
      .addField(
        "Time left to join",
        `${differenceInSeconds(
          addSeconds(activeGames[channelId]!.gameStartedAt, secondsToJoin),
          new Date(),
        )} seconds`,
      )
      .setColor(flatColors.green as ColorResolvable);

    const channel = message.channel;

    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("join_word_chain")
        .setStyle("PRIMARY")
        .setLabel("Lemme join too!"),
    );

    channel
      .send({
        content: "",
        options: { embeds: [embed] },
        components: [row],
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
  }
};

export const joinUsingButton = (ctx: ComponentContext, client: Client) => {
  if (!ctx.member) {
    ctx.acknowledge();
    return;
  }

  const joinAction = actions.find((a) => a.commands.includes("join"))!;

  const channelId = ctx.channelID;

  const channel = client.channels.cache.get(channelId) as TextChannel;

  const player = ctx.user;

  const activeGames = getAllActiveGames();

  if (!activeGames[channelId]?.joinable) {
    ctx.acknowledge();

    const embed = new MessageEmbed()
      .setDescription(`The game is not joinable. ${player.mention}`)
      .setColor(flatColors.red as ColorResolvable);

    channel
      .send({ embeds: [embed], content: `${player.mention}` })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    return;
  }

  if (activeGames[channelId]) {
    if (activeGames[channelId]!.userIds.includes(player.id)) {
      ctx.acknowledge();
      return;
    }

    ctx.send(`${ctx.member.nick || ctx.user.username} is joining.`);

    activeGames[channelId] = {
      ...activeGames[channelId]!,
      userIds: [...activeGames[channelId]!.userIds, player.id],
      playerLives: {
        ...activeGames[channelId]!.playerLives,
        [player.id]: activeGames[channelId]!.maxLives,
      },
    };

    const embed = new MessageEmbed()
      .setDescription(`${player.mention} joined the game.`)
      .addField(
        "How to join",
        `Send \`${prefixes[0]}${joinAction.commands[0]}\` or \`${prefixes[0]}${
          joinAction.commands[joinAction.commands.length - 1]
        }\` here in this channel to join or tap on the button below.`,
      )
      .addField(
        "Time left to join",
        `${differenceInSeconds(
          addSeconds(activeGames[channelId]!.gameStartedAt, secondsToJoin),
          new Date(),
        )} seconds`,
      )
      .setColor(flatColors.green as ColorResolvable);

    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("join_word_chain")
        .setStyle("PRIMARY")
        .setLabel("Lemme join too!"),
    );

    channel
      .send({
        content: "",
        options: { embeds: [embed] },
        components: [row],
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
  }
};
