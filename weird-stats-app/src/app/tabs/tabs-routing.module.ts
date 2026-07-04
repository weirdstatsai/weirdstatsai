import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

// The TabsPage shell sits at the root path so tab URLs are clean
// (/home, /explore, /profile) instead of leaking the /tabs prefix.
const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        data: {
          seo: {
            title: 'WeirdStats.ai — Ask something weird, get a chart worth sharing',
            description: 'Turn any curious question into surprising stats, rankings, and visual insights in seconds. WeirdStats.ai makes charts worth sharing.',
          },
        },
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule),
      },
      {
        path: 'explore',
        data: {
          seo: {
            title: 'Explore trending WeirdStats — surprising charts & rankings',
            description: 'Browse trending stat cards across animals, countries, money, sports and more. Discover charts worth sharing on WeirdStats.ai.',
          },
        },
        loadChildren: () => import('../explore/explore.module').then(m => m.ExplorePageModule),
      },
      {
        path: 'profile',
        data: {
          seo: {
            title: 'Your profile — WeirdStats.ai',
            description: 'Your saved and published WeirdStats stat cards.',
          },
        },
        loadChildren: () => import('../profile/profile.module').then(m => m.ProfilePageModule),
      },
      {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
