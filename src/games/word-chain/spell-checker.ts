import spellChecker from "spellchecker";

export const checkSpell = (word: string): boolean => {
  return !spellChecker.isMisspelled(word);
};
