import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';

interface StaticPageContent {
  title: string;
  updated: string;
  intro?: string;
  sections: Array<{ heading: string; body: string[] }>;
}

const CONTACT: StaticPageContent = {
  title: 'Contact us',
  updated: '',
  intro: "Questions, feedback, or something not working right? We'd like to hear about it.",
  sections: [
    {
      heading: 'Email',
      body: ['support@weirdstats.ai — we read every message and usually reply within a couple of days.'],
    },
    {
      heading: 'Reporting a card',
      body: [
        'If a specific card looks wrong or inappropriate, use the Report option on the card itself '
        + '(the ⋮ menu on any card you\'re viewing) instead of emailing — it routes straight to our review queue.',
      ],
    },
    {
      heading: 'Press or partnerships',
      body: ['Reach out at the same address above and mention what you\'re working on.'],
    },
  ],
};

const TERMS: StaticPageContent = {
  title: 'Terms and conditions',
  updated: 'Last updated: June 2026',
  intro: 'These terms cover your use of WeirdStats.ai. By creating an account or using the app, you agree to them.',
  sections: [
    {
      heading: 'What WeirdStats is',
      body: [
        'WeirdStats generates short, shareable statistic cards from a question you type in, using an AI model that '
        + 'searches the web and summarizes what it finds. Cards are meant to be interesting and informative, not a '
        + 'substitute for primary research — always verify a number before relying on it for anything important.',
      ],
    },
    {
      heading: 'Accounts',
      body: [
        'You need an account to generate, save, or publish cards. You\'re responsible for keeping your login secure '
        + 'and for activity that happens under your account.',
      ],
    },
    {
      heading: 'Free and Premium plans',
      body: [
        'The Free plan includes a limited number of card generations per day, refreshed on a rolling 24-hour '
        + 'window. Premium removes that limit and the share watermark for a monthly fee. Premium billing details '
        + 'are presented at the time of upgrade.',
      ],
    },
    {
      heading: 'Content you publish',
      body: [
        'When you publish a card publicly, other users can view it on Explore or your profile. Don\'t publish '
        + 'content that is illegal, harassing, or knowingly false. We reserve the right to remove any published '
        + 'card and suspend accounts that misuse the report system or repeatedly violate these terms.',
      ],
    },
    {
      heading: 'Disclaimer',
      body: [
        'Cards are provided "as is." AI-generated content can be inaccurate or out of date. WeirdStats is not '
        + 'liable for decisions made based on a card\'s content.',
      ],
    },
    {
      heading: 'Changes',
      body: ['We may update these terms as the product changes. Continued use after an update means you accept the revised terms.'],
    },
  ],
};

const PRIVACY: StaticPageContent = {
  title: 'Privacy policy',
  updated: 'Last updated: June 2026',
  intro: 'This explains what data WeirdStats collects and how it\'s used.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Account info from your sign-in method (name, email, profile photo) via Google, Facebook, or email/password.',
        'The questions you submit to generate cards, and the cards you save, publish, or report.',
        'Basic usage data — how many cards you\'ve generated and when — used only to enforce the free-plan daily limit.',
      ],
    },
    {
      heading: 'How your questions are used',
      body: [
        'When you generate a card, your question is sent to OpenAI\'s API to research and format the result. '
        + 'OpenAI processes this text to generate a response; it is not used by WeirdStats to identify you personally.',
      ],
    },
    {
      heading: 'Where data is stored',
      body: [
        'Account and card data is stored on Google Firebase (Firestore and Authentication). Draft cards you '
        + 'haven\'t saved live only in your device\'s local storage, not in our database.',
      ],
    },
    {
      heading: 'Sharing',
      body: [
        'We don\'t sell your data. Cards you choose to publish are visible to other users by design. Private cards '
        + 'and drafts are not.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'You can delete individual cards from your Profile at any time. To delete your account entirely, contact '
        + 'us at support@weirdstats.ai.',
      ],
    },
    {
      heading: 'Children',
      body: ['WeirdStats is not directed at children under 13, and we don\'t knowingly collect data from them.'],
    },
    {
      heading: 'Changes',
      body: ['If this policy changes materially, we\'ll update the date at the top of this page.'],
    },
  ],
};

const PAGES: Record<string, StaticPageContent> = {
  contact: CONTACT,
  terms: TERMS,
  privacy: PRIVACY,
};

@Component({
  selector: 'app-static-page',
  templateUrl: './static-page.page.html',
  styleUrls: ['./static-page.page.scss'],
})
export class StaticPagePage implements OnInit {
  content: StaticPageContent = CONTACT;

  constructor(private route: ActivatedRoute, private navCtrl: NavController) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.data['slug'] as string;
    this.content = PAGES[slug] ?? CONTACT;
  }

  back(): void {
    this.navCtrl.back();
  }
}
