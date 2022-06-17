/* eslint-disable indent */
import {
  Message,
  Client,
  MessageEmbed,
  ColorResolvable,
  MessageActionRow,
  MessageButton,
} from "discord.js";
import { SlashCreator } from "slash-create";
import { Action } from "../../games/types";
import { setupGame } from "../../games/setup";
import { flatColors, prefixes } from "../../config";
import { getLogger } from "../../app";
import { searchGifOnTenor } from "../../utils/search-tenor";
import { oneLine } from "common-tags";
import { EventEmitter } from "events";

const logger = getLogger();

const eventEmitters: { [channelId: string]: EventEmitter | undefined } = {};

const hugTypesForButtons = [
  {
    label: "Bro Hug",
    customId: "send_bro_hug",
  },
  {
    label: "Sis Hug",
    customId: "send_sis_hug",
  },
  {
    label: "Friendly Hug",
    customId: "send_friendly_hug",
  },
  {
    label: "Romantic Hug",
    customId: "send_romantic_hug",
  },
] as const;

const actions: Action[] = [
  {
    commands: ["gif", "interact", "give"],
    handler: async (message, commands, messageContentWithoutPrefix) => {
      if (message.channel.type !== "GUILD_TEXT") {
        return;
      }

      let content = messageContentWithoutPrefix.toLowerCase();

      for (const command of commands) {
        if (content.startsWith(command.toLowerCase())) {
          content = content.replace(command.toLowerCase(), "");
          break;
        }
      }

      const searchTerm = content
        .replace(/<&?#?@?!?\d+>/gi, "")
        .toLowerCase()
        .trim();

      performInteraction({ message, searchTerm, specificText: searchTerm });
    },
  },
  {
    commands: ["hug"],
    handler: async (message, commands, messageContentWithoutPrefix) => {
      if (message.channel.type !== "GUILD_TEXT") {
        return;
      }

      let content = messageContentWithoutPrefix.toLowerCase();

      for (const command of commands) {
        if (content.startsWith(command.toLowerCase())) {
          content = content.replace(command.toLowerCase(), "");
          break;
        }
      }

      let hugType: HugType | null = null;

      if (content.includes("bro")) {
        hugType = "bro hug";
      } else if (content.includes("sis")) {
        hugType = "girl hug sis";
      } else if (content.includes("friend") || content.includes("fren")) {
        hugType = "hug friend";
      } else if (content.includes("love") || content.includes("roman")) {
        hugType = "romantic hug";
      }

      if (!hugType) {
        const channel = message.channel;

        const row = new MessageActionRow();

        hugTypesForButtons.forEach((h) =>
          row.addComponents(
            new MessageButton()
              .setCustomId(h.customId)
              .setLabel(h.label)
              .setStyle("PRIMARY"),
          ),
        );

        const chooseTypeMessage = await channel.send({
          content: `${message.author}, select the type of hug:`,
          components: [row],
        });

        hugType = await new Promise((resolve) => {
          let emitter = eventEmitters[message.channel.id];

          if (!emitter) {
            emitter = eventEmitters[message.channel.id] = new EventEmitter();
          }

          emitter.once(
            `received_hug_type_${message.author.id}`,
            (data: HugType) => {
              emitter?.removeAllListeners();
              resolve(data);
            },
          );
        });

        (chooseTypeMessage as Message).delete();
      }

      if (!hugType) {
        return;
      }

      performInteraction({
        message,
        searchTerm: hugType,
        specificText:
          hugType === "bro hug"
            ? "a bro hug"
            : hugType === "girl hug sis"
            ? "a sis hug"
            : hugType === "romantic hug"
            ? "a romantic hug"
            : "a friendly hug",
      });
    },
  },
];

export const performInteraction = async ({
  message,
  searchTerm,
  specificText,
}: {
  message: Message;
  searchTerm: string;
  specificText: string;
}) => {
  try {
    const mentions = message.mentions.users.map((u) => u).slice(0, 5);

    const response = await searchGifOnTenor(searchTerm);

    if (!response || !response.results || response.results.length < 1) {
      return;
    }

    const randomIndex: number = Math.floor(
      Math.random() * response.results.length,
    );

    const url: string = response.results[randomIndex].media[0].gif.url;

    const embed = new MessageEmbed()
      .setColor(flatColors.blue as ColorResolvable)
      .setImage(url).setDescription(oneLine`
      ${message.author} gives${
      (mentions.length > 0 &&
        `${mentions.map((u) => ` <@${u.id}>`).join(",")}`) ||
      ""
    } ${specificText}.
    `);

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(error as Error);
  }
};

export const setupGif = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", (ctx) => {
    if (hugTypesForButtons.find((hug) => hug.customId === ctx.customID)) {
      const customID =
        ctx.customID as typeof hugTypesForButtons[number]["customId"];

      let emitter = eventEmitters[ctx.channelID];

      if (!emitter) {
        emitter = eventEmitters[ctx.channelID] = new EventEmitter();
      }

      const hugType: HugType =
        customID === "send_bro_hug"
          ? "bro hug"
          : customID === "send_sis_hug"
          ? "girl hug sis"
          : customID === "send_romantic_hug"
          ? "romantic hug"
          : "hug friend";

      emitter.emit(`received_hug_type_${ctx.user.id}`, hugType);

      ctx.acknowledge();

      return;
    }
  });

  setupGame(client, prefixes, actions);
};

export type HugType =
  | "bro hug"
  | "girl hug sis"
  | "hug friend"
  | "romantic hug";
