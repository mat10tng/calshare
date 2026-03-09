/** All cat GIFs available for display on the availability grid. */
export const CAT_GIFS: string[] = [
  'cat-work.gif',
  'cat-personal.gif',
  'cat-fitness.gif',
  'cat-school.gif',
  'cat-family.gif',
  'cat-social.gif',
];

/** Pick a random cat GIF filename from the catalog. */
export function randomCatGif(): string {
  return CAT_GIFS[Math.floor(Math.random() * CAT_GIFS.length)];
}
