import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-project-modal',
  template: `
    <div class="pm-sheet">
      <div class="pm-header">
        <span class="pm-title">New project</span>
        <button class="pm-close" (click)="cancel()" aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <label class="pm-label">Project name</label>
      <input
        class="pm-input"
        type="text"
        [(ngModel)]="name"
        placeholder="World coffee habits"
        maxlength="60"
        autocapitalize="sentences"
        (keyup.enter)="save()"
        #nameInput />

      <button class="pm-save" [disabled]="!name.trim()" (click)="save()">
        <ion-icon name="checkmark-outline"></ion-icon> Save
      </button>
    </div>
  `,
  styles: [`
    :host { --purple: #6C5CE7; --green: #1D9E75; }
    .pm-sheet { padding: 18px 18px 20px; background: #fff; border-radius: 20px; }
    .pm-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;
    }
    .pm-title { font-size: 17px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.3px; }
    .pm-close {
      width: 30px; height: 30px; border-radius: 50%; border: none; background: #f0f0f4;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      ion-icon { font-size: 18px; color: #6b6b76; }
    }
    .pm-label {
      display: block; font-size: 12px; font-weight: 700; color: #8a8a93; margin-bottom: 7px;
    }
    .pm-input {
      width: 100%; height: 46px; border: 1.5px solid #e2e2e8; border-radius: 12px;
      padding: 0 14px; font-size: 15px; color: #1a1a2e; outline: none; box-sizing: border-box;
      font-family: inherit; background: #fff; -webkit-appearance: none; appearance: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .pm-input::placeholder { color: #b0b0b8; }
    .pm-input:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(29,158,117,0.14); }
    .pm-save {
      width: 100%; height: 48px; margin-top: 18px; border: none; border-radius: 12px;
      background: var(--green); color: #fff; font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      cursor: pointer; font-family: inherit; transition: opacity 0.15s;
      ion-icon { font-size: 18px; }
    }
    .pm-save:disabled { opacity: 0.45; }
    .pm-save:active:not(:disabled) { opacity: 0.85; }
  `],
})
export class ProjectModalComponent {
  name = '';

  constructor(private modalCtrl: ModalController) {}

  save(): void {
    const trimmed = this.name.trim();
    if (!trimmed) return;
    this.modalCtrl.dismiss(trimmed);
  }

  cancel(): void {
    this.modalCtrl.dismiss(null);
  }
}
