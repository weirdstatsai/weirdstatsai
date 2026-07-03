import { Pipe, PipeTransform } from '@angular/core';

/**
 * Strips emoji/pictographs from card titles — the card art (category badge,
 * side avatars, illustrations) already carries the iconography, so the title
 * stays clean text.
 */
@Pipe({ name: 'stripEmoji' })
export class StripEmojiPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .replace(/\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*/gu, '')
      .replace(/️/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
