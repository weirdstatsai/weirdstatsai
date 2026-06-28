import { Component } from '@angular/core';

interface MenuItem {
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'grid-outline' },
    { label: 'Favorites', icon: 'heart-outline' },
    { label: 'Notifications', icon: 'notifications-outline' },
    { label: 'Achievements', icon: 'trophy-outline' },
    { label: 'Invite Friends', icon: 'people-outline' },
    { label: 'Settings', icon: 'settings-outline' },
    { label: 'About', icon: 'information-circle-outline' },
    { label: 'Help & Support', icon: 'help-circle-outline' },
  ];
}
