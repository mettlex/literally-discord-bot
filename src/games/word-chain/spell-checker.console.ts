/* eslint-disable no-console */
import { checkSpell, getResultFromNewWiktionaryAPI } from "./spell-checker";

const main = async () => {
  console.log(await getResultFromNewWiktionaryAPI("Test"));
  console.log(await getResultFromNewWiktionaryAPI("TestWRONGWORD"));

  console.log(await checkSpell("Test"));
  console.log(await checkSpell("TestWRONGWORD"));

  console.log(await checkSpell("limb"));
};

main();
