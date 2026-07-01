import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { StaticPagePage } from './static-page.page';

@NgModule({
  imports: [
    CommonModule, IonicModule,
    RouterModule.forChild([{ path: '', component: StaticPagePage }]),
  ],
  declarations: [StaticPagePage],
})
export class StaticPagePageModule {}
