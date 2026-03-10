const ADJECTIVES = [
  'brave', 'calm', 'clever', 'cozy', 'cute', 'daring', 'eager', 'fancy',
  'gentle', 'happy', 'jolly', 'kind', 'lively', 'merry', 'noble', 'plucky',
  'quiet', 'rosy', 'silly', 'sunny', 'swift', 'tiny', 'warm', 'witty',
  'bold', 'bright', 'fuzzy', 'lucky', 'peppy', 'snug',
];

const ANIMALS = [
  'bear', 'bunny', 'cat', 'deer', 'duck', 'falcon', 'fox', 'frog',
  'hamster', 'hedgehog', 'koala', 'lemur', 'lynx', 'moose', 'newt',
  'otter', 'owl', 'panda', 'parrot', 'penguin', 'pony', 'puppy',
  'quail', 'robin', 'seal', 'sloth', 'sparrow', 'tiger', 'whale', 'wolf',
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Deterministic cute name from any string ID, e.g. "sunny-otter" */
export function participantName(id: string): string {
  const hash = hashId(id);
  const adj = ADJECTIVES[Math.abs(hash) % ADJECTIVES.length];
  const animal = ANIMALS[Math.abs(hash >> 8) % ANIMALS.length];
  return `${adj}-${animal}`;
}

/** Deterministic HSL color from any string ID — warm, distinct hues at good saturation */
export function participantColor(id: string): string {
  const hash = hashId(id);
  // Spread hues using golden angle (~137.5°) for maximum visual separation
  const hue = Math.abs(hash * 137.508) % 360;
  return `hsl(${Math.round(hue)}, 35%, 65%)`;
}
