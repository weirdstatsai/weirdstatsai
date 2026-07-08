import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-project-add-sheet',
  template: `
    <div class="sheet">
      <div class="sheet-grip"></div>

      <div class="sheet-head">
        <span class="sheet-title">Add to project</span>
        <span class="sheet-sub">Choose how you'd like to build this project</span>
      </div>

      <button class="option" (click)="select('add')">
        <span class="opt-icon purple">
          <ion-icon name="sparkles-outline"></ion-icon>
        </span>
        <span class="opt-text">
          <span class="opt-title">Add a stat</span>
          <span class="opt-sub">Generate a single card from a prompt</span>
        </span>
        <ion-icon class="opt-arrow" name="chevron-forward"></ion-icon>
      </button>

      <button class="option" (click)="select('bulk')">
        <span class="opt-icon green">
          <ion-icon name="document-text-outline"></ion-icon>
        </span>
        <span class="opt-text">
          <span class="opt-title">Import a file
            <span class="opt-badge">Bulk</span>
          </span>
          <span class="opt-sub">PDF, Word, Excel, or CSV → graphs</span>
        </span>
        <ion-icon class="opt-arrow" name="chevron-forward"></ion-icon>
      </button>

      <button class="sheet-cancel" (click)="dismiss()">Cancel</button>
    </div>
  `,
  styles: [`
    :host { --purple: #6C5CE7; --green: #1D9E75; }
    .sheet {
      background: #fff; padding: 8px 16px calc(18px + env(safe-area-inset-bottom));
      border-radius: 26px 26px 0 0;
    }
    .sheet-grip {
      width: 40px; height: 5px; border-radius: 3px; background: #e0e0e6;
      margin: 6px auto 14px;
    }
    .sheet-head { padding: 0 4px 14px; }
    .sheet-title { display: block; font-size: 18px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.3px; }
    .sheet-sub { display: block; font-size: 13px; color: #8a8a93; margin-top: 3px; }

    .option {
      display: flex; align-items: center; gap: 13px; width: 100%;
      background: #fbfbfd; border: 0.5px solid rgba(0,0,0,0.07);
      border-radius: 16px; padding: 13px 14px; margin-bottom: 10px;
      cursor: pointer; font-family: inherit; text-align: left;
      transition: transform 0.12s, background 0.12s;
    }
    .option:active { transform: scale(0.985); background: #f4f4f8; }

    .opt-icon {
      width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      ion-icon { font-size: 22px; }
    }
    .opt-icon.purple { background: rgba(108,92,231,0.12); ion-icon { color: var(--purple); } }
    .opt-icon.green  { background: rgba(29,158,117,0.12); ion-icon { color: var(--green); } }

    .opt-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .opt-title {
      font-size: 15px; font-weight: 700; color: #1a1a2e;
      display: flex; align-items: center; gap: 7px;
    }
    .opt-sub { font-size: 12.5px; color: #8a8a93; line-height: 1.3; }
    .opt-badge {
      font-size: 10px; font-weight: 700; color: var(--green);
      background: rgba(29,158,117,0.12); border-radius: 20px; padding: 2px 8px;
      letter-spacing: 0.2px;
    }
    .opt-arrow { font-size: 18px; color: rgba(0,0,0,0.2); flex-shrink: 0; }

    .sheet-cancel {
      width: 100%; height: 46px; margin-top: 6px; border: none;
      border-radius: 14px; background: #f0f0f4; color: #6b6b76;
      font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit;
      transition: background 0.12s;
    }
    .sheet-cancel:active { background: #e6e6ec; }
  `],
})
export class ProjectAddSheetComponent {
  constructor(private modalCtrl: ModalController) {}

  select(choice: 'add' | 'bulk'): void {
    this.modalCtrl.dismiss(choice);
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null);
  }
}
