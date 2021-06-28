import { oneLine, oneLineTrim } from "common-tags";
import { MessageEmbed } from "discord.js";
import { ButtonStyle, ComponentType } from "slash-create";
import { flatColors } from "../../../config";
import { ExtendedTextChannel } from "../../../extension";
import sleep from "../../../utils/sleep";
import { coupActionsInClassic } from "../data";
import { handleChallenge } from "../game-loop";
import { BlockData, ChallengeOrNotData, CoupGame, CoupPlayer } from "../types";

/* eslint-disable indent */
export const handleSteal = async ({
  game,
  player,
  channel,
  activePlayers,
  channelId,
}: {
  game: CoupGame;
  player: CoupPlayer;
  channel: ExtendedTextChannel;
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
    influences,
  } = answer;

  if (!challenging) {
    if (blockingPlayer && action && influences && influences.length === 2) {
      player.blockingPlayerId = blockingPlayer.id;

      blockingPlayer.votesRequiredForAction = activePlayers.length - 2;

      const embed = new MessageEmbed()
        .setColor(flatColors.yellow)
        .setAuthor(blockingPlayer.name, blockingPlayer.avatarURL)
        .setDescription(
          oneLine`
          I block ${player.name}'s stealing
          with my **${influences[0]}** or **${influences[1]}**.
        `,
        );

      await channel.sendWithComponents({
        content: activePlayers
          .filter((p) => blockingPlayer && p.id !== blockingPlayer.id)
          .map((p) => `<@${p.id}>`)
          .join(", "),
        options: { embed },
        components: [
          {
            components: [
              {
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
                label: `Let it go`,
                custom_id: `let_go_in_coup`,
              },
              {
                type: ComponentType.BUTTON,
                style: ButtonStyle.DESTRUCTIVE,
                label: `Challenge`,
                custom_id: oneLineTrim`challenge_
                ${blockingPlayer.id}_${influences[0]}_${influences[1]}
                _coup`,
              },
            ],
          },
        ],
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

      const { challenging, challengingPlayer, influenceName, influenceName2 } =
        answer;

      if (challenging && challengingPlayer && influenceName && influenceName2) {
        const lostPlayer = await handleChallenge({
          channel,
          game,
          challengingPlayer,
          player: blockingPlayer,
          influenceName,
          influenceName2,
        });

        if (lostPlayer.id !== challengingPlayer.id) {
          const stolenCoins = coupActionsInClassic.steal(
            channelId,
            game,
            targetPlayer,
            player,
          );

          const embed = new MessageEmbed()
            .setColor(flatColors.blue)
            .setAuthor(player.name, player.avatarURL)
            .setDescription(
              oneLine`
              I stole **${stolenCoins}** coins from ${targetPlayer.name}
              and I have **${player.coins}** coin${
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
                  oneLine`I have to coup against
                  a player in my next turn.`) ||
                ""
              }
            `,
            );

          await channel.send(embed);

          await sleep(2000);
        }
      }
    } else {
      const stolenCoins = coupActionsInClassic.steal(
        channelId,
        game,
        targetPlayer,
        player,
      );

      const embed = new MessageEmbed()
        .setColor(flatColors.blue)
        .setAuthor(player.name, player.avatarURL)
        .setDescription(
          oneLine`
          I stole **${stolenCoins}** coins from ${targetPlayer.name}
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

      await channel.send(embed);

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
      const stolenCoins = coupActionsInClassic.steal(
        channelId,
        game,
        targetPlayer,
        player,
      );

      const embed = new MessageEmbed()
        .setColor(flatColors.blue)
        .setAuthor(player.name, player.avatarURL)
        .setDescription(
          oneLine`
        I stole **${stolenCoins}** coins from ${targetPlayer.name}
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

      await channel.send(embed);

      await sleep(2000);
    }
  }
};
