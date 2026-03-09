import type { CalendarCategory } from '@/types';

export interface GifEntry {
  file: string;   // filename under /public/gifs/
  label: string;  // human-readable
  emoji: string;
}

export const GIF_CATALOG: Record<CalendarCategory, GifEntry> = {
  work:     { file: 'cat-work.gif',     label: 'Work',     emoji: '💼' },
  personal: { file: 'cat-personal.gif', label: 'Personal', emoji: '🙂' },
  fitness:  { file: 'cat-fitness.gif',  label: 'Fitness',  emoji: '🏋' },
  school:   { file: 'cat-school.gif',   label: 'School',   emoji: '📚' },
  family:   { file: 'cat-family.gif',   label: 'Family',   emoji: '👨‍👩‍👧' },
  social:   { file: 'cat-social.gif',   label: 'Social',   emoji: '🎉' },
};

export const CATEGORY_OPTIONS: { value: CalendarCategory; label: string; emoji: string }[] = [
  { value: 'work',     label: 'Work',     emoji: '💼' },
  { value: 'personal', label: 'Personal', emoji: '🙂' },
  { value: 'fitness',  label: 'Fitness',  emoji: '🏋' },
  { value: 'school',   label: 'School',   emoji: '📚' },
  { value: 'family',   label: 'Family',   emoji: '👨‍👩‍👧' },
  { value: 'social',   label: 'Social',   emoji: '🎉' },
];
