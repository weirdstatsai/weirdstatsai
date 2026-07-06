import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
  },
  // Legacy /tabs/* URLs (old shared links, bookmarks) → clean equivalents.
  { path: 'tabs/home', redirectTo: '/home' },
  { path: 'tabs/explore', redirectTo: '/explore' },
  { path: 'tabs/profile', redirectTo: '/profile' },
  { path: 'tabs', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'card',
    loadChildren: () => import('./card-detail/card-detail.module').then(m => m.CardDetailPageModule),
  },
  {
    path: 'card/:id',
    data: { dynamicSeo: true },
    loadChildren: () => import('./card-detail/card-detail.module').then(m => m.CardDetailPageModule),
  },
  {
    path: 'share-card',
    loadChildren: () => import('./share-card/share-card.module').then(m => m.ShareCardPageModule),
  },
  {
    path: 'public-profile/:uid',
    data: { dynamicSeo: true },
    loadChildren: () => import('./public-profile/public-profile.module').then(m => m.PublicProfilePageModule),
  },
  {
    path: 'account',
    loadChildren: () => import('./account/account.module').then(m => m.AccountPageModule),
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminPageModule),
  },
  {
    path: 'admin-user/:uid',
    loadChildren: () => import('./admin-user/admin-user.module').then(m => m.AdminUserPageModule),
  },
  {
    path: 'share/:id',
    loadChildren: () => import('./share/share.module').then(m => m.SharePageModule),
  },
  {
    path: 'seed-data',
    loadChildren: () => import('./seed-data/seed-data.module').then(m => m.SeedDataPageModule),
  },
  {
    path: 'contact',
    data: { slug: 'contact', seo: { title: 'Contact — WeirdStats.ai', description: 'Get in touch with the WeirdStats.ai team.' } },
    loadChildren: () => import('./static-page/static-page.module').then(m => m.StaticPagePageModule),
  },
  {
    path: 'terms',
    data: { slug: 'terms', seo: { title: 'Terms & Conditions — WeirdStats.ai', description: 'Terms and conditions for using WeirdStats.ai.' } },
    loadChildren: () => import('./static-page/static-page.module').then(m => m.StaticPagePageModule),
  },
  {
    path: 'privacy',
    data: { slug: 'privacy', seo: { title: 'Privacy Policy — WeirdStats.ai', description: 'How WeirdStats.ai handles your data.' } },
    loadChildren: () => import('./static-page/static-page.module').then(m => m.StaticPagePageModule),
  },
  {
    path: 'project/:id/import',
    loadChildren: () => import('./project-import/project-import.module').then(m => m.ProjectImportPageModule),
  },
  {
    path: 'project/:id',
    loadChildren: () => import('./project-detail/project-detail.module').then(m => m.ProjectDetailPageModule),
  },
  // Anything unmatched (removed legacy routes, typos, stale links) → home.
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
