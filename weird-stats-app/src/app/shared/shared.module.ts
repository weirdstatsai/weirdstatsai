import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ChartComponent } from './chart/chart.component';
import { LoginComponent } from '../login/login.component';
import { MiniChartComponent } from './mini-chart/mini-chart.component';
import { EmojiPickerComponent } from './emoji-picker/emoji-picker.component';
import { WeirdCardComponent } from './weird-card/weird-card.component';
import { CardBadgesComponent } from './card-badges/card-badges.component';

import { CardRankingComponent } from './cards/card-ranking/card-ranking.component';
import { CardKpiComponent } from './cards/card-kpi/card-kpi.component';
import { CardVersusComponent } from './cards/card-versus/card-versus.component';
import { CardFactComponent } from './cards/card-fact/card-fact.component';
import { CardChartComponent } from './cards/card-chart/card-chart.component';
import { CardTableComponent } from './cards/card-table/card-table.component';
import { CardMapComponent } from './cards/card-map/card-map.component';
import { PlanModalComponent } from './plan-modal/plan-modal.component';
import { PublishModalComponent } from './publish-modal/publish-modal.component';
import { CardMenuPopoverComponent } from './card-menu-popover/card-menu-popover.component';
import { StripEmojiPipe } from './strip-emoji.pipe';
import { ProjectModalComponent } from './project-modal/project-modal.component';
import { ProjectAddSheetComponent } from './project-add-sheet/project-add-sheet.component';

const CARD_COMPONENTS = [
  CardRankingComponent,
  CardKpiComponent,
  CardVersusComponent,
  CardFactComponent,
  CardChartComponent,
  CardTableComponent,
  CardMapComponent,
];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule],
  declarations: [
    ChartComponent,
    LoginComponent,
    MiniChartComponent,
    EmojiPickerComponent,
    WeirdCardComponent,
    CardBadgesComponent,
    PlanModalComponent,
    PublishModalComponent,
    CardMenuPopoverComponent,
    StripEmojiPipe,
    ProjectModalComponent,
    ProjectAddSheetComponent,
    ...CARD_COMPONENTS,
  ],
  exports: [
    ChartComponent,
    LoginComponent,
    MiniChartComponent,
    EmojiPickerComponent,
    WeirdCardComponent,
    CardBadgesComponent,
    PlanModalComponent,
    PublishModalComponent,
    CardMenuPopoverComponent,
    StripEmojiPipe,
    ProjectModalComponent,
    ProjectAddSheetComponent,
    ...CARD_COMPONENTS,
  ],
})
export class SharedModule {}
