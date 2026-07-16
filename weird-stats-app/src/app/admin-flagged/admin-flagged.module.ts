import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AdminFlaggedPage } from './admin-flagged.page';

@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule,
    RouterModule.forChild([{ path: '', component: AdminFlaggedPage }]),
  ],
  declarations: [AdminFlaggedPage],
})
export class AdminFlaggedPageModule {}
