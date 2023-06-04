/* eslint-disable indent */
import { oneLine } from "common-tags";
import { EmbedBuilder, TextChannel } from "discord.js";
import { flatColors } from "../../../config";
import sleep from "../../../utils/sleep";
import { CoupPlayer } from "../types";

export const handleIncome = async ({
  player,
  channel,
}: {
  player: CoupPlayer;
  channel: TextChannel;
}) => {
  const embed = new EmbedBuilder()
    .setColor(flatColors.blue)
    .setAuthor({ name: player.name, iconURL: player.avatarURL })
    .setDescription(
      oneLine`
        I took **1** coin as income and I have **${player.coins}** coin${
        player.coins > 1 ? "s" : ""
      } now.
      ${
        (player.coins > 2 &&
          player.coins < 7 &&
          oneLine`If I have an assassin,
          I may assassinate in my next turn.`) ||
        ""
      }
      ${
        (player.coins > 6 &&
          player.coins < 10 &&
          oneLine`I can coup against a player in my next turn.`) ||
        ""
      }
      ${
        (player.coins > 9 &&
          oneLine`I have to coup against a player in my next turn.`) ||
        ""
      }
    `,
    );

  channel.send({ content: "​", embeds: [embed] });

  await sleep(2000);
};
