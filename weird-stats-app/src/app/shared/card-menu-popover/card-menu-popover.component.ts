import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-card-menu-popover',
  templateUrl: './card-menu-popover.component.html',
  styleUrls: ['./card-menu-popover.component.scss'],
})
export class CardMenuPopoverComponent {
  @Input() isPublished = false;

  constructor(private popoverCtrl: PopoverController) {}

  pick(action: string): void {
    this.popoverCtrl.dismiss({ action });
  }
}
