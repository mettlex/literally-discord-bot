import { oneLine } from "common-tags";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { flatColors } from "../../../config";
import { shuffleArray } from "../../../utils/array";
import { handleChallenge } from "../game-loop";
import { ChallengeOrNotData, CoupGame, CoupPlayer, Influence } from "../types";

/* eslint-disable indent */
export const handleExchange = async ({
  game,
  player,
  channel,
}: {
  game: CoupGame;
  player: CoupPlayer;
  channel: TextChannel;
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

  const performExchange = async () => {
    player.influencesToReturn = 2;

    shuffleArray(game.deck);

    player.influences.push({ ...game.deck.pop()!, dismissed: false });
    player.influences.push({ ...game.deck.pop()!, dismissed: false });

    const embed = new EmbedBuilder()
      .setTitle("Exchange Influences")
      .setColor(flatColors.blue)
      .setDescription(
        oneLine`
          ${player.name}, you took **2** new influences from the deck.
          Now keep any 2 and return 2 back to the deck.  
        `,
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("coup_show_influences")
        .setStyle(ButtonStyle.Primary)
        .setLabel("Return Two Influences"),
    );

    await channel.send({
      content: `<@${player.id}>`,
      options: { embeds: [embed] },
      components: [row],
    });

    await new Promise((resolve) => {
      if (!game) {
        resolve(false);
      }

      game.eventEmitter.once("exchange_completed_in_coup", () => {
        resolve(true);
      });
    });

    const returnedInfluences: Influence[] = [];

    for (let i = 0; i < player.influences.length; i++) {
      if (player.influences[i].returned) {
        returnedInfluences.push(player.influences[i]);
      }
    }

    player.influences = player.influences.filter((inf) => !inf.returned);

    returnedInfluences.forEach(({ name, description, imageURL }) => {
      game.deck.push({ name, description, imageURL });
    });

    shuffleArray(game.deck);

    player.influencesToReturn = undefined;
  };

  if (challenging === false) {
    await performExchange();
  } else if (challenging && challengingPlayer && influenceName) {
    const lostPlayer = await handleChallenge({
      channel,
      game,
      challengingPlayer,
      player,
      influenceName,
    });

    if (lostPlayer.id === challengingPlayer.id) {
      await performExchange();
    }
  }
};
