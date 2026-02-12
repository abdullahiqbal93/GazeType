import { KeyDef } from './types';

/**
 * Virtual keyboard layout definitions.
 */

export const KEYBOARD_ROWS: KeyDef[][] = [
  // Row 1: numbers
  [
    { label: '1', value: '1', type: 'char' },
    { label: '2', value: '2', type: 'char' },
    { label: '3', value: '3', type: 'char' },
    { label: '4', value: '4', type: 'char' },
    { label: '5', value: '5', type: 'char' },
    { label: '6', value: '6', type: 'char' },
    { label: '7', value: '7', type: 'char' },
    { label: '8', value: '8', type: 'char' },
    { label: '9', value: '9', type: 'char' },
    { label: '0', value: '0', type: 'char' },
  ],
  // Row 2: QWERTY top
  [
    { label: 'Q', value: 'q', type: 'char' },
    { label: 'W', value: 'w', type: 'char' },
    { label: 'E', value: 'e', type: 'char' },
    { label: 'R', value: 'r', type: 'char' },
    { label: 'T', value: 't', type: 'char' },
    { label: 'Y', value: 'y', type: 'char' },
    { label: 'U', value: 'u', type: 'char' },
    { label: 'I', value: 'i', type: 'char' },
    { label: 'O', value: 'o', type: 'char' },
    { label: 'P', value: 'p', type: 'char' },
  ],
  // Row 3: QWERTY middle
  [
    { label: 'A', value: 'a', type: 'char' },
    { label: 'S', value: 's', type: 'char' },
    { label: 'D', value: 'd', type: 'char' },
    { label: 'F', value: 'f', type: 'char' },
    { label: 'G', value: 'g', type: 'char' },
    { label: 'H', value: 'h', type: 'char' },
    { label: 'J', value: 'j', type: 'char' },
    { label: 'K', value: 'k', type: 'char' },
    { label: 'L', value: 'l', type: 'char' },
  ],
  // Row 4: QWERTY bottom
  [
    { label: '⇧', value: '', type: 'shift', width: 1.5 },
    { label: 'Z', value: 'z', type: 'char' },
    { label: 'X', value: 'x', type: 'char' },
    { label: 'C', value: 'c', type: 'char' },
    { label: 'V', value: 'v', type: 'char' },
    { label: 'B', value: 'b', type: 'char' },
    { label: 'N', value: 'n', type: 'char' },
    { label: 'M', value: 'm', type: 'char' },
    { label: '⌫', value: '', type: 'backspace', width: 1.5 },
  ],
  // Row 5: special keys
  [
    { label: '◀', value: '', type: 'left' },
    { label: '▶', value: '', type: 'right' },
    { label: ',', value: ',', type: 'char' },
    { label: '.', value: '.', type: 'char' },
    { label: '?', value: '?', type: 'char' },
    { label: 'SPACE', value: ' ', type: 'space', width: 3 },
    { label: '↵', value: '\n', type: 'enter', width: 1.5 },
    { label: 'CLR', value: '', type: 'clear', width: 1.5 },
    { label: '🔊', value: '', type: 'tts', width: 1.5 },
  ],
];
