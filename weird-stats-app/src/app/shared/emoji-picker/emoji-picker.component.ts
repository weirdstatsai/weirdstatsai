import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

export const AVATAR_EMOJIS = [
  '🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯',
  '🦄','🐸','🐙','🦋','🦩','🐧','🦜','🦖',
  '🐬','🦈','🦓','🦒','🦘','🦔','🐝','🦅',
  '🍕','🍩','🌮','🍜','🍣','🧁','🍓','🌶️',
  '🎸','🎯','🚀','🌈','⚡','🔥','💎','🎲',
  '🧠','👾','🤖','👻','🎃','🏆','🎪','🌊',
];

@Component({
  selector: 'app-emoji-picker',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Choose your avatar</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="emoji-grid">
        <button
          class="emoji-btn"
          *ngFor="let e of emojis"
          [class.selected]="current === e"
          (click)="pick(e)">
          {{ e }}
        </button>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-toolbar {
      --background: #fff;
    }
    ion-title {
      font-size: 17px;
      font-weight: 700;
    }
    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      padding: 8px 0 24px;
    }
    .emoji-btn {
      background: #f4f4f8;
      border: 2.5px solid transparent;
      border-radius: 14px;
      aspect-ratio: 1;
      font-size: 28px;
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
    .emoji-btn:active {
      transform: scale(0.88);
    }
  `],
})
export class EmojiPickerComponent {
  @Input() current: string | null = null;
  readonly emojis = AVATAR_EMOJIS;

  constructor(private modalCtrl: ModalController) {}

  pick(emoji: string): void {
    this.modalCtrl.dismiss(emoji);
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null);
  }
}
