import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-publish-modal',
  templateUrl: './publish-modal.component.html',
  styleUrls: ['./publish-modal.component.scss'],
})
export class PublishModalComponent {
  selected: 'public' | 'private' | null = null;

  constructor(private modalCtrl: ModalController) {}

  choose(option: 'public' | 'private'): void {
    this.modalCtrl.dismiss({ choice: option });
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null);
  }
}
