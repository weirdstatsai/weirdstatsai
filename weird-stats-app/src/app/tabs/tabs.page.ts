import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnDestroy {
  active = 'home';
  private navSub: Subscription;

  constructor(private navCtrl: NavController, private router: Router) {
    this.setActiveFromUrl(this.router.url);
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.setActiveFromUrl(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  go(tab: string): void {
    // Root direction so the stack is replaced on every switch — repeated tab
    // taps must not pile views up in the outlet.
    this.navCtrl.navigateRoot('/' + tab, { animated: false });
  }

  private setActiveFromUrl(url: string): void {
    this.active = url.split('?')[0].split('/')[1] || 'home';
  }
}
