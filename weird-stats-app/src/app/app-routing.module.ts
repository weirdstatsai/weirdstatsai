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
    path: 'admin-users',
    loadChildren: () => import('./admin-users/admin-users.module').then(m => m.AdminUsersPageModule),
  },
  {
    path: 'admin-cards',
    loadChildren: () => import('./admin-cards/admin-cards.module').then(m => m.AdminCardsPageModule),
  },
  {
    path: 'admin-flagged',
    loadChildren: () => import('./admin-flagged/admin-flagged.module').then(m => m.AdminFlaggedPageModule),
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
    data: { seo: { title: 'Contact — WeirdStats.ai', description: 'Talk to the WeirdStats team about enterprise plans, API access, and partnerships.' } },
    loadChildren: () => import('./contact/contact.module').then(m => m.ContactPageModule),
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
    path: 'project/:id/generate',
    loadChildren: () => import('./project-generate/project-generate.module').then(m => m.ProjectGeneratePageModule),
  },
  {
    path: 'project/:id',
    loadChildren: () => import('./project-detail/project-detail.module').then(m => m.ProjectDetailPageModule),
  },
  {
    path: 'pricing',
    data: { seo: { title: 'Pricing — WeirdStats.ai', description: 'WeirdStats Free and Premium plans — unlimited stat cards and watermark-free sharing.' } },
    loadChildren: () => import('./pricing/pricing.module').then(m => m.PricingPageModule),
  },
  // Stripe checkout return pages.
  {
    path: 'billing/success',
    loadChildren: () => import('./billing/billing-success.module').then(m => m.BillingSuccessPageModule),
  },
  { path: 'billing/cancel', redirectTo: '/home', pathMatch: 'full' },
  // Anything unmatched (removed legacy routes, typos, stale links) → home.
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
