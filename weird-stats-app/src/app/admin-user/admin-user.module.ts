import { NgModule, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { AdminUserPage } from './admin-user.page';

@Pipe({ name: 'statsFilter' })
export class StatsFilterPipe implements PipeTransform {
  transform(cards: any[], status: string): number {
    if (!cards) return 0;
    return cards.filter(c => (c.publishStatus ?? 'draft') === status).length;
  }
}

@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule, SharedModule,
    RouterModule.forChild([{ path: '', component: AdminUserPage }]),
  ],
  declarations: [AdminUserPage, StatsFilterPipe],
})
export class AdminUserPageModule {}
