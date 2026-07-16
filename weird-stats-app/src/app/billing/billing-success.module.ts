import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BillingSuccessPage } from './billing-success.page';

const routes: Routes = [{ path: '', component: BillingSuccessPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BillingSuccessPage],
})
export class BillingSuccessPageModule {}
