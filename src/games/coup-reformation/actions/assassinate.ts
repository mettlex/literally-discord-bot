import { oneLine } from "common-tags";
import {
  ColorResolvable,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  TextChannel,
  ButtonStyle,
} from "discord.js";
import { flatColors } from "../../../config";
import sleep from "../../../utils/sleep";
import { coupActionsInClassic } from "../data";
import { handleChallenge } from "../game-loop";
import {
  BlockData,
  ChallengeOrNotData,
  CoupGame,
  CoupPlayer,
  Influence,
} from "../types";

/* eslint-disable indent */
export const handleAssassinate = async ({
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
  const answer = await new Promise<ChallengeOrNotData & BlockData>(
    (resolve) => {
      if (!game) {
        resolve({ challenging: false });
        return;
      }

      game.eventEmitter.once("all_players_allowed_action", () => {
        resolve({ challenging: false });
      });

      game.eventEmitter.once("block", (data: BlockData) => {
        resolve({ ...data, challenging: false });
      });

      game.eventEmitter.once(
        "challenged_or_not",
        (answer: ChallengeOrNotData) => {
          resolve(answer);
        },
      );
    },
  );

  if (!player.targetPlayerId) {
    return;
  }

  const targetPlayer = game.players.find(
    (p) => p.id === player?.targetPlayerId,
  );

  if (!targetPlayer) {
    return;
  }

  const {
    challenging,
    challengingPlayer,
    influenceName,
    blockingPlayer,
    action,
    influence,
  } = answer;

  const performAssassination = async () => {
    targetPlayer.lostChallenge = true;

    let dismissedInfluence: Influence;

    const activeInfluences = targetPlayer.influences.filter(
      (inf) => !inf.dismissed,
    );

    if (activeInfluences.length === 2) {
      const embed = new EmbedBuilder()
        .setTitle("Assassination Succeeded")
        .setColor(flatColors.blue as ColorResolvable)
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
      dismissedInfluence = targetPlayer.influences.find(
        (inf) => !inf.dismissed,
      )!;

      targetPlayer.influences.forEach((inf) => {
        inf.dismissed = true;
      });
    }

    coupActionsInClassic.assassinate(channelId, game, player, targetPlayer);

    if (dismissedInfluence) {
      const embed = new EmbedBuilder()
        .setColor(flatColors.blue as ColorResolvable)
        .setAuthor({ name: player.name, iconURL: player.avatarURL })
        .setDescription(
          oneLine`
          I paid **3** coins to assassinate ${targetPlayer.name}'s ${
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

  if (!challenging) {
    if (blockingPlayer && action && influence) {
      player.blockingPlayerId = blockingPlayer.id;

      blockingPlayer.votesRequiredForAction = activePlayers.length - 2;

      const embed = new EmbedBuilder()
        .setColor(flatColors.yellow as ColorResolvable)
        .setAuthor({
          name: blockingPlayer.name,
          iconURL: blockingPlayer.avatarURL,
        })
        .setDescription(
          oneLine`
          I block ${player.name}'s assassination
          with my **${influence}**.
        `,
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("let_go_in_coup")
          .setStyle(ButtonStyle.Primary)
          .setLabel("Let it go"),

        new ButtonBuilder()
          .setCustomId(`challenge_${blockingPlayer.id}_${influence}_coup`)
          .setStyle(ButtonStyle.Danger)
          .setLabel("Challenge"),
      );

      await channel.send({
        content: activePlayers
          .filter((p) => blockingPlayer && p.id !== blockingPlayer.id)
          .map((p) => `<@${p.id}>`)
          .join(", "),
        options: { embeds: [embed] },
        components: [row],
      });

      const answer = await new Promise<ChallengeOrNotData>((resolve) => {
        if (!game) {
          resolve({ challenging: false });
          return;
        }

        game.eventEmitter.once(
          "challenged_or_not",
          (answer: ChallengeOrNotData) => {
            resolve(answer);
          },
        );
      });

      const { challenging, challengingPlayer, influenceName } = answer;

      if (challenging && challengingPlayer && influenceName) {
        const lostPlayer = await handleChallenge({
          channel,
          game,
          challengingPlayer,
          player: blockingPlayer,
          influenceName,
        });

        if (lostPlayer.id !== challengingPlayer.id) {
          await performAssassination();
          await sleep(2000);
        }
      }
    } else {
      await performAssassination();
      await sleep(2000);
    }
  } else if (challenging && challengingPlayer && influenceName) {
    const lostPlayer = await handleChallenge({
      channel,
      game,
      challengingPlayer,
      player,
      influenceName,
    });

    if (lostPlayer.id === challengingPlayer.id) {
      await performAssassination();
      await sleep(2000);
    }
  }
};
