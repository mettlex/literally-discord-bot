import { oneLine } from "common-tags";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { flatColors } from "../../../config";
import { coupActionsInClassic } from "../data";
import { CoupGame, CoupPlayer, Influence } from "../types";

/* eslint-disable indent */
export const handleCoup = async ({
  game,
  player,
  channel,
  activePlayers,
  channelId,
}: {
  game: CoupGame;
  player: CoupPlayer;
  channel: TextChannel;
  activePlayers: CoupPlayer[];
  channelId: string;
}) => {
  const targetPlayer = activePlayers.find(
    (p) => p.id === player?.targetPlayerId,
  );

  if (!player || player.coins < 7 || !player.targetPlayerId || !targetPlayer) {
    return;
  }

  if (!targetPlayer) {
    return;
  }

  targetPlayer.lostChallenge = true;

  let dismissedInfluence: Influence;

  const activeInfluences = targetPlayer.influences.filter(
    (inf) => !inf.dismissed,
  );

  if (activeInfluences.length === 2) {
    const embed = new EmbedBuilder()
      .setTitle(`**${player.name}** couped against ${targetPlayer.name}.`)
      .setColor(flatColors.blue)
      .setDescription(
        oneLine`
          ${targetPlayer.name}, choose one of your influences to dismiss:
        `,
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("coup_show_influences")
        .setStyle(ButtonStyle.Primary)
        .setLabel("Dismiss One Influence"),
    );

    await channel.send({
      content: `<@${targetPlayer.id}>`,
      options: { embeds: [embed] },
      components: [row],
    });

    const data = await new Promise<{
      dismissedInfluence: Influence;
    }>((resolve) => {
      game.eventEmitter.once(
        "dismissed_influence_in_coup",
        (data: { dismissedInfluence: Influence }) => {
          resolve(data);
        },
      );
    });

    dismissedInfluence = data.dismissedInfluence;
  } else {
    dismissedInfluence = targetPlayer.influences.find((inf) => !inf.dismissed)!;

    targetPlayer.influences.forEach((inf) => {
      inf.dismissed = true;
    });
  }

  coupActionsInClassic.coup(channelId, game, player, targetPlayer);

  if (dismissedInfluence) {
    const embed = new EmbedBuilder()
      .setColor(flatColors.blue)
      .setAuthor({ name: player.name, iconURL: player.avatarURL })
      .setDescription(
        oneLine`
        I paid **7** coins to coup against ${targetPlayer.name}'s ${
          dismissedInfluence.name
        }
        and I have **${player.coins}** coin${player.coins > 1 ? "s" : ""} now.
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

    await channel.send({ content: "​", embeds: [embed] });
  }
};
