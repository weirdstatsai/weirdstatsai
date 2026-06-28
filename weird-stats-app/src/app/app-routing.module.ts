import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    path: 'card',
    loadChildren: () => import('./card-detail/card-detail.module').then(m => m.CardDetailPageModule),
  },
  {
    path: 'card/:id',
    loadChildren: () => import('./card-detail/card-detail.module').then(m => m.CardDetailPageModule),
  },
  {
    path: 'share-card',
    loadChildren: () => import('./share-card/share-card.module').then(m => m.ShareCardPageModule),
  },
  {
    path: 'public-profile/:uid',
    loadChildren: () => import('./public-profile/public-profile.module').then(m => m.PublicProfilePageModule),
  },
  {
    path: 'graph-detail',
    loadChildren: () => import('./graph-detail/graph-detail.module').then(m => m.GraphDetailPageModule),
  },
  {
    path: 'graph-detail/:id',
    loadChildren: () => import('./graph-detail/graph-detail.module').then(m => m.GraphDetailPageModule),
  },
  {
    path: 'share/:id',
    loadChildren: () => import('./share/share.module').then(m => m.SharePageModule),
  },
  {
    path: 'seed-data',
    loadChildren: () => import('./seed-data/seed-data.module').then(m => m.SeedDataPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
