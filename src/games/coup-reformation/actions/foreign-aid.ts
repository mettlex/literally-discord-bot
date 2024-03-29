import { oneLine } from "common-tags";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { flatColors } from "../../../config";
import sleep from "../../../utils/sleep";
import { coupActionsInClassic } from "../data";
import { handleChallenge } from "../game-loop";
import {
  ChallengeOrNotData,
  CoupActionNameInClassic,
  CoupGame,
  CoupPlayer,
  Influence,
} from "../types";

/* eslint-disable indent */
export const handleForeignAid = async ({
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
  let counterAction: {
    type: "allowed" | "block";
    player?: CoupPlayer;
    blockingPlayer?: CoupPlayer;
    action?: CoupActionNameInClassic;
    influence?: Influence["name"];
  } = { type: "allowed" };

  const waitForCounterAction = new Promise<typeof counterAction>((resolve) => {
    if (!game) {
      resolve(counterAction);
      return;
    }

    game.eventEmitter.once("all_players_allowed_action", () => {
      resolve(counterAction);
    });

    game.eventEmitter.once("block", (data) => {
      counterAction.type = "block";
      resolve({ ...counterAction, ...data });
    });
  });

  counterAction = await waitForCounterAction;

  if (counterAction.type === "allowed") {
    coupActionsInClassic.foreignAid(channelId, game, player);

    const embed = new EmbedBuilder()
      .setColor(flatColors.blue)
      .setAuthor({ name: player.name, iconURL: player.avatarURL })
      .setDescription(
        oneLine`
        I took **2** coins as foreign aid
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
  if (counterAction.type === "block") {
    const { blockingPlayer, action, influence } = counterAction;

    if (!blockingPlayer || !action || !influence) {
      return;
    }

    player.blockingPlayerId = blockingPlayer.id;

    blockingPlayer.votesRequiredForAction = activePlayers.length - 2;

    const embed = new EmbedBuilder()
      .setColor(flatColors.yellow)
      .setAuthor({
        name: blockingPlayer.name,
        iconURL: blockingPlayer.avatarURL,
      })
      .setDescription(
        oneLine`
          I block ${player.name}'s foreign aid with my **${influence}**.
        `,
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setStyle(ButtonStyle.Primary)
        .setLabel("Let it go")
        .setCustomId(`let_go_in_coup`),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setLabel("Challenge")
        .setCustomId(`challenge_${blockingPlayer.id}_${influence}_coup`),
    ]);

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
        influenceName: "duke",
      });

      if (lostPlayer.id === blockingPlayer.id) {
        coupActionsInClassic.foreignAid(channel.id, game, player);

        const embed = new EmbedBuilder()
          .setColor(flatColors.blue)
          .setAuthor({ name: player.name, iconURL: player.avatarURL })
          .setDescription(
            oneLine`
        I took **2** coins as foreign aid
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
  }
};
