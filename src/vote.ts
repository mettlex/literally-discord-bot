import {
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { prefixes as lyPrefixes } from "./config";
import { hasVoted } from "./top.gg/api";

export const setupVote = (client: Client) => {
  client.on("messageCreate", async (message) => {
    if (
      message.author.bot ||
      !lyPrefixes.find((p) => message.content.toLowerCase().startsWith(p)) ||
      !message.content.toLowerCase().trim().endsWith("vote")
    ) {
      return;
    }

    const result = await hasVoted(message.author.id);

    if (result === null) {
      message.reply(
        "Sorry, Top.gg API has failed to check your voting status.",
      );

      return;
    }

    const channel = message.channel;

    let content = "";

    if (result === true) {
      content = "Thanks! You have voted within last 12 hours.";
    } else {
      content =
        "Please vote every 12 hours to get special abilities Literally!";
    }

    content += ` ${message.author}`;

    channel
      .send({
        content,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("Vote for Literally")
              .setStyle(ButtonStyle.Link)
              .setURL("https://top.gg/bot/842397311916310539/vote"),
          ),
        ],
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
  });
};
