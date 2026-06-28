import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { SeedDataPage } from './seed-data.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: SeedDataPage }]),
  ],
  declarations: [SeedDataPage],
})
export class SeedDataPageModule {}
