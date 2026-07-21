import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { AdminCardsPage } from './admin-cards.page';

@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule, SharedModule,
    RouterModule.forChild([{ path: '', component: AdminCardsPage }]),
  ],
  declarations: [AdminCardsPage],
})
export class AdminCardsPageModule {}
