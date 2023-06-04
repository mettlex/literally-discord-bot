import {
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export const sendCoupHelpMessage = (message: Message) => {
  const channel = message.channel;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("coup_cs")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Show Cheat Sheet"),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("How To Play")
      .setURL(
        "https://www.youtube.com/watch?v=a8bY3zI9FL4&list=PLDNi2Csm13eaUpcmveWPzVJ3fIlaFrvZn",
      ),
  );

  channel.send({
    content: "Please press on a button below:",
    components: [row],
  });
};
