import { Component, Input } from '@angular/core';
import { WeirdCard } from '../../models/weird-card.model';

@Component({
  selector: 'app-weird-card',
  templateUrl: './weird-card.component.html',
  styleUrls: ['./weird-card.component.scss'],
})
export class WeirdCardComponent {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() fontSize: 'small' | 'medium' | 'large' = 'medium';
}
