import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { EMOJI_CATEGORIES, EmojiCategory } from '../emoji-data';

export const AVATAR_EMOJIS = [
  '🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯',
  '🦄','🐸','🐙','🦋','🦩','🐧','🦜','🦖',
  '🐬','🦈','🦓','🦒','🦘','🦔','🐝','🦅',
  '🍕','🍩','🌮','🍜','🍣','🧁','🍓','🌶️',
  '🎸','🎯','🚀','🌈','⚡','🔥','💎','🎲',
  '🧠','👾','🤖','👻','🎃','🏆','🎪','🌊',
];

/** The avatar shortlist, presented as a single category. */
const AVATAR_CATEGORY: EmojiCategory[] = [
  { name: 'Picks', icon: 'sparkles-outline', emojis: AVATAR_EMOJIS },
];

@Component({
  selector: 'app-emoji-picker',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Category tabs (only worth showing when there's more than one group) -->
      <div class="cat-bar" *ngIf="categories.length > 1">
        <button
          class="cat-tab"
          *ngFor="let c of categories; let i = index"
          [class.active]="i === activeIndex"
          (click)="activeIndex = i"
          [attr.aria-label]="c.name">
          <ion-icon [name]="c.icon"></ion-icon>
          <span>{{ c.name }}</span>
        </button>
      </div>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="emoji-grid">
        <button
          class="emoji-btn"
          *ngFor="let e of categories[activeIndex].emojis"
          [class.selected]="current === e"
          (click)="pick(e)">
          {{ e }}
        </button>
      </div>

      <!-- Clearing is a real choice for the card's hero emoji. -->
      <button class="clear-btn" *ngIf="allowClear" (click)="pick('')">
        <ion-icon name="ban-outline"></ion-icon> No emoji
      </button>
    </ion-content>
  `,
  styles: [`
    ion-toolbar { --background: #fff; }
    ion-title { font-size: 17px; font-weight: 700; }

    .cat-bar {
      display: flex; gap: 6px;
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      padding: 4px 12px 10px;
      background: #fff;
      scrollbar-width: none;
    }
    .cat-bar::-webkit-scrollbar { display: none; }
    .cat-tab {
      flex: none;
      display: inline-flex; align-items: center; gap: 5px;
      border: 0; border-radius: 999px;
      padding: 7px 13px;
      background: #f1f1f6; color: #61637a;
      font: inherit; font-size: 12.5px; font-weight: 700;
      cursor: pointer;
    }
    .cat-tab ion-icon { font-size: 14px; }
    .cat-tab.active { background: var(--ion-color-primary); color: #fff; }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      padding: 8px 0 16px;
    }
    @media (min-width: 560px) {
      .emoji-grid { grid-template-columns: repeat(8, 1fr); }
    }
    .emoji-btn {
      background: #f4f4f8;
      border: 2.5px solid transparent;
      border-radius: 14px;
      aspect-ratio: 1;
      font-size: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.12s, border-color 0.12s;
      width: 100%;
    }
    .emoji-btn.selected {
      border-color: var(--ion-color-primary);
      background: rgba(var(--ion-color-primary-rgb), 0.08);
      transform: scale(1.12);
    }
    .emoji-btn:active { transform: scale(0.88); }

    .clear-btn {
      display: flex; align-items: center; justify-content: center; gap: 7px;
      width: 100%; margin: 4px 0 24px;
      padding: 12px; border-radius: 14px;
      border: 1px dashed rgba(20,22,45,0.25);
      background: #fff; color: #61637a;
      font: inherit; font-size: 13.5px; font-weight: 700;
      cursor: pointer;
    }
    .clear-btn ion-icon { font-size: 16px; }
    .clear-btn:active { background: #f6f6f9; }
  `],
})
export class EmojiPickerComponent implements OnInit {
  @Input() current: string | null = null;
  /** Sheet heading. */
  @Input() title = 'Choose your avatar';
  /** 'avatar' = the curated shortlist; 'all' = the full categorised catalogue. */
  @Input() mode: 'avatar' | 'all' = 'avatar';
  /** Offer a "No emoji" button (a card's hero emoji can be cleared; an avatar can't). */
  @Input() allowClear = false;

  categories: EmojiCategory[] = AVATAR_CATEGORY;
  activeIndex = 0;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.categories = this.mode === 'all' ? EMOJI_CATEGORIES : AVATAR_CATEGORY;
    // Open on the category holding the current emoji, so the picker starts where
    // the user already is rather than always on the first tab.
    if (this.current) {
      const i = this.categories.findIndex(c => c.emojis.includes(this.current as string));
      if (i >= 0) this.activeIndex = i;
    }
  }

  pick(emoji: string): void {
    this.modalCtrl.dismiss(emoji);
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null);
  }
}
