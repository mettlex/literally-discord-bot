import { oneLine } from "common-tags";
import { EmbedBuilder, TextChannel } from "discord.js";
import { flatColors } from "../../../config";
import sleep from "../../../utils/sleep";
import { coupActionsInClassic } from "../data";
import { handleChallenge } from "../game-loop";
import { ChallengeOrNotData, CoupGame, CoupPlayer } from "../types";

/* eslint-disable indent */
export const handleTax = async ({
  game,
  player,
  channel,
  channelId,
}: {
  game: CoupGame;
  player: CoupPlayer;
  channel: TextChannel;
  channelId: string;
}) => {
  const answer = await new Promise<ChallengeOrNotData>((resolve) => {
    if (!game) {
      resolve({ challenging: false });
      return;
    }

    game.eventEmitter.once("all_players_allowed_action", () => {
      resolve({ challenging: false });
    });

    game.eventEmitter.once(
      "challenged_or_not",
      (answer: ChallengeOrNotData) => {
        resolve(answer);
      },
    );
  });

  const { challenging, challengingPlayer, influenceName } = answer;

  if (challenging === false) {
    coupActionsInClassic.tax(channelId, game, player);

    const embed = new EmbedBuilder()
      .setColor(flatColors.blue)
      .setAuthor({ name: player.name, iconURL: player.avatarURL })
      .setDescription(
        oneLine`
        I took **3** coins as tax
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

    await sleep(2000);
  } else if (challenging && challengingPlayer && influenceName) {
    const lostPlayer = await handleChallenge({
      channel,
      game,
      challengingPlayer,
      player,
      influenceName: "duke",
    });

    if (lostPlayer.id === challengingPlayer.id) {
      coupActionsInClassic.tax(channelId, game, player);

      const embed = new EmbedBuilder()
        .setColor(flatColors.blue)
        .setAuthor({ name: player.name, iconURL: player.avatarURL })
        .setDescription(
          oneLine`
        I took **3** coins as tax
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

      await sleep(2000);
    }
  }
};
