import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { SharePageRoutingModule } from './share-routing.module';
import { SharePage } from './share.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    SharePageRoutingModule,
  ],
  declarations: [SharePage],
})
export class SharePageModule {}
