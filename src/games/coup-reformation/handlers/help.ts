import { Message, MessageActionRow, MessageButton } from "discord.js";

export const sendCoupHelpMessage = (message: Message) => {
  const channel = message.channel;

  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("coup_cs")
      .setStyle("SECONDARY")
      .setLabel("Show Cheat Sheet"),
    new MessageButton()
      .setCustomId("coup_how_to_play")
      .setStyle("LINK")
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
