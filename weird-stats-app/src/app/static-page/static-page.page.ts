import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';

interface StaticSection {
  heading: string;
  body?: string[];
  bullets?: string[];
}

interface StaticPageContent {
  title: string;
  eyebrow?: string;
  updated: string;
  numbered?: boolean;
  intro?: string;
  sections: StaticSection[];
  foot?: string;
}

const SUPPORT_EMAIL = 'support@weirdstats.ai';
const PRIVACY_EMAIL = 'privacy@weirdstats.ai';

const CONTACT: StaticPageContent = {
  title: 'Contact us',
  eyebrow: 'We’re listening',
  updated: '',
  intro: "Questions, feedback, or something not working right? We read every message and usually reply within a couple of days.",
  sections: [
    {
      heading: 'General support',
      body: [`Email ${SUPPORT_EMAIL} for anything about your account, billing, a bug, or a feature idea.`],
    },
    {
      heading: 'Reporting a card',
      body: [
        'If a specific card looks wrong or inappropriate, use the Report option on the card itself '
        + '(the ⋮ menu on any card you’re viewing) rather than emailing — it routes straight to our review queue so we can act faster.',
      ],
    },
    {
      heading: 'Privacy & data requests',
      body: [`For access, correction, or deletion of your personal data, email ${PRIVACY_EMAIL} and we’ll take it from there.`],
    },
    {
      heading: 'Press or partnerships',
      body: [`Reach out at ${SUPPORT_EMAIL} and mention what you’re working on.`],
    },
  ],
};

const TERMS: StaticPageContent = {
  title: 'Terms & Conditions',
  eyebrow: 'The agreement',
  updated: 'Last updated: July 15, 2026',
  numbered: true,
  intro: 'These Terms & Conditions ("Terms") govern your access to and use of WeirdStats.ai, including the website, web app, and any related services (together, the "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.',
  sections: [
    {
      heading: 'What WeirdStats is',
      body: [
        'WeirdStats turns a question you type into a short, shareable "stat card" using AI that searches the web and summarizes what it finds. '
        + 'Cards are meant to be interesting and informative — not authoritative research or professional advice. AI-generated content can be '
        + 'incomplete, out of date, or wrong. Always verify a figure before relying on it for any decision that matters.',
      ],
    },
    {
      heading: 'Eligibility & accounts',
      bullets: [
        'You must be at least 13 years old (or the minimum age of digital consent in your country) to use the Service.',
        'You need an account to generate, save, or publish cards. Provide accurate information and keep your login credentials secure.',
        'You are responsible for all activity that occurs under your account. Tell us promptly if you suspect unauthorized use.',
      ],
    },
    {
      heading: 'Free and paid plans',
      body: [
        'The Free plan includes a limited number of card generations per rolling 24-hour window. Premium removes that limit and the share '
        + 'watermark. Premium is offered as an auto-renewing monthly or yearly subscription, or as a one-time 30-day pass; the exact price, '
        + 'billing interval, and any applicable taxes are shown at checkout before you pay.',
        'Payments are processed by Stripe. Subscriptions renew automatically until cancelled; you can cancel anytime from your account, and '
        + 'cancellation takes effect at the end of the current billing period. Except where required by law, payments are non-refundable.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: ['You agree not to:'],
      bullets: [
        'use the Service for anything illegal, harmful, harassing, hateful, or deceptive;',
        'generate or publish content that is defamatory, invasive of privacy, or infringes someone else’s rights;',
        'attempt to reverse-engineer, scrape at scale, overload, or disrupt the Service or its infrastructure;',
        'misuse the reporting system or attempt to bypass usage limits, security, or access controls.',
      ],
    },
    {
      heading: 'Content you create and publish',
      body: [
        'You retain ownership of the questions you submit. When you publish a card publicly, you grant WeirdStats a worldwide, '
        + 'non-exclusive, royalty-free license to host, display, and distribute that card within the Service and in link previews. '
        + 'You are responsible for content you publish. We may remove any card and suspend or terminate accounts that violate these Terms.',
      ],
    },
    {
      heading: 'Intellectual property',
      body: [
        'The Service, including its software, design, branding, and the "WeirdStats" name and logo, is owned by us and protected by '
        + 'intellectual-property laws. These Terms do not grant you any right to our trademarks or to copy or resell the Service.',
      ],
    },
    {
      heading: 'Disclaimers',
      body: [
        'THE SERVICE AND ALL CARDS ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, '
        + 'INCLUDING ACCURACY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. We do not warrant that any card is accurate, '
        + 'complete, or current, or that the Service will be uninterrupted or error-free.',
      ],
    },
    {
      heading: 'Limitation of liability',
      body: [
        'To the maximum extent permitted by law, WeirdStats and its operators will not be liable for any indirect, incidental, special, '
        + 'consequential, or punitive damages, or for any loss arising from your reliance on a card. Our total liability for any claim '
        + 'relating to the Service will not exceed the greater of the amount you paid us in the twelve months before the claim, or USD $50.',
      ],
    },
    {
      heading: 'Indemnity',
      body: [
        'You agree to indemnify and hold harmless WeirdStats and its operators from claims, damages, and expenses (including reasonable '
        + 'legal fees) arising out of your misuse of the Service, your published content, or your violation of these Terms or of any law '
        + 'or third-party right.',
      ],
    },
    {
      heading: 'Termination',
      body: [
        'You may stop using the Service and delete your account at any time. We may suspend or terminate access if you violate these '
        + 'Terms or to protect the Service or other users. Sections that by their nature should survive termination (ownership, disclaimers, '
        + 'limitation of liability, indemnity) will survive.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'These Terms are governed by the laws of the jurisdiction in which WeirdStats is operated, without regard to conflict-of-law rules. '
        + 'Any dispute will be brought in the courts of that jurisdiction, unless a mandatory consumer-protection law provides otherwise.',
      ],
    },
    {
      heading: 'Changes to these Terms',
      body: [
        'We may update these Terms as the product evolves. Material changes will be reflected in the "last updated" date above and, where '
        + 'appropriate, announced in the app. Continued use after an update means you accept the revised Terms.',
      ],
    },
    {
      heading: 'Contact',
      body: [`Questions about these Terms? Email ${SUPPORT_EMAIL}.`],
    },
  ],
  foot: 'This document is provided for transparency and does not constitute legal advice.',
};

const PRIVACY: StaticPageContent = {
  title: 'Privacy Policy',
  eyebrow: 'Your data',
  updated: 'Last updated: July 15, 2026 · Effective: July 15, 2026',
  numbered: true,
  intro: 'This Privacy Policy explains what information WeirdStats.ai ("WeirdStats," "we," "us") collects, how we use and share it, and the choices and rights you have. It applies to our website, web app, and related services (the "Service"). By using the Service, you agree to the practices described here.',
  sections: [
    {
      heading: 'Who we are',
      body: [
        'WeirdStats is the operator of WeirdStats.ai and acts as the controller of the personal data described in this policy. '
        + `If you have any questions or wish to exercise your rights, contact us at ${PRIVACY_EMAIL}.`,
      ],
    },
    {
      heading: 'Information we collect',
      body: ['We collect the following categories of information:'],
      bullets: [
        'Account information — your name, email address, and profile photo, provided through your chosen sign-in method (Google, Facebook, or email/password), plus an optional avatar and display name you set.',
        'Content you create — the questions ("prompts") you submit to generate cards, and the cards you save, publish, duplicate, or report.',
        'Usage information — how many cards you have generated and when, used to enforce plan limits, plus in-app events such as views and shares.',
        'Device and technical data — IP address, browser and device type, and similar information collected automatically by our hosting and analytics providers.',
        'Cookies and analytics data — see the "Cookies and tracking" section below.',
        'Payment information — if you subscribe, our payment processor (Stripe) collects your payment details directly. We do not receive or store your full card number; we retain only a customer/subscription reference and your plan status.',
      ],
    },
    {
      heading: 'How we use your information',
      body: ['We use the information above to:'],
      bullets: [
        'provide and operate the Service — create, save, publish, and display your cards;',
        'process your questions into cards (see "AI generation and your prompts" below);',
        'enforce Free-plan limits and manage Premium subscriptions and billing;',
        'maintain security, prevent abuse, and moderate reported content;',
        'understand and improve how the Service is used through analytics;',
        'communicate with you about your account, support requests, and important changes;',
        'comply with legal obligations and enforce our Terms.',
      ],
    },
    {
      heading: 'AI generation and your prompts',
      body: [
        'When you generate a card, the question you submit is sent to OpenAI’s API, which researches and formats the result. OpenAI processes '
        + 'this text to produce a response. Per OpenAI’s API terms, data sent through the API is not used to train their models by default. '
        + 'Do not include sensitive personal information in your prompts. A card you publish (including its originating question, where shown) '
        + 'becomes visible to others by your choice.',
      ],
    },
    {
      heading: 'Cookies and tracking',
      body: [
        'We use strictly necessary cookies and local storage to keep you signed in, remember your consent choice, and hold unsaved draft cards '
        + 'on your device. With your consent, we also use analytics and session-analysis tools. We ask for consent on your first visit — nothing '
        + 'non-essential loads until you accept, and you can decline.',
      ],
      bullets: [
        'Google Analytics 4 — aggregated traffic and usage metrics.',
        'Microsoft Clarity — aggregated, anonymized interaction and session-replay data.',
        'Hotjar — aggregated interaction and feedback data.',
      ],
    },
    {
      heading: 'How we share information',
      body: [
        'We do not sell your personal data. We share information only with service providers who process it on our behalf under contract, '
        + 'and only as needed to run the Service:',
      ],
      bullets: [
        'Google Firebase (Authentication, Firestore, Storage, Hosting) — account and card storage and app delivery.',
        'OpenAI — processing your prompts to generate cards.',
        'Stripe — payment processing and subscription management.',
        'Google Analytics, Microsoft Clarity, Hotjar — analytics (consent-based).',
        'Your sign-in provider (Google or Facebook) — to authenticate you.',
      ],
    },
    {
      heading: 'Public content',
      body: [
        'Cards you choose to publish are visible to other users on Explore, on your public profile, and in link previews when shared. '
        + 'Private cards and unsaved drafts are not public. You can unpublish or delete a card at any time from your profile.',
      ],
    },
    {
      heading: 'Legal bases (EEA/UK users)',
      body: ['Where the GDPR or UK GDPR applies, we rely on these legal bases:'],
      bullets: [
        'Performance of a contract — to provide the Service you request and manage your subscription.',
        'Consent — for non-essential cookies and analytics (which you can withdraw).',
        'Legitimate interests — to secure, maintain, and improve the Service and prevent abuse.',
        'Legal obligation — where we must retain or disclose data to comply with the law.',
      ],
    },
    {
      heading: 'Data retention',
      body: [
        'We keep your account and card data for as long as your account is active. When you delete a card it is removed from our database '
        + '(and its social-preview image from storage). When you delete your account, we delete or anonymize your personal data, except where '
        + 'we must retain limited records to comply with legal, tax, or security obligations.',
      ],
    },
    {
      heading: 'Data security',
      body: [
        'We use industry-standard measures — including encryption in transit, authentication controls, and access restrictions — to protect '
        + 'your data. No method of transmission or storage is completely secure, so we cannot guarantee absolute security, but we work to '
        + 'protect your information and to notify you and regulators of a breach where required by law.',
      ],
    },
    {
      heading: 'International data transfers',
      body: [
        'Our providers (including Google, OpenAI, and Stripe) may process and store data in the United States and other countries. Where we '
        + 'transfer data internationally, we rely on appropriate safeguards such as Standard Contractual Clauses or the providers’ certified '
        + 'transfer mechanisms.',
      ],
    },
    {
      heading: 'Your privacy rights',
      body: [
        'Depending on where you live (including under the GDPR/UK GDPR and California’s CCPA/CPRA), you may have the right to:',
      ],
      bullets: [
        'access the personal data we hold about you and request a copy;',
        'correct inaccurate data or complete incomplete data;',
        'delete your data and account;',
        'port your data to another service;',
        'object to or restrict certain processing, and withdraw consent for analytics;',
        'opt out of the "sale" or "sharing" of personal data — note we do not sell or share your data for cross-context advertising;',
        'not be discriminated against for exercising these rights.',
      ],
    },
    {
      heading: 'Exercising your rights',
      body: [
        `To exercise any of these rights, email ${PRIVACY_EMAIL}. You can also delete individual cards from your profile at any time, and manage `
        + 'your subscription from your account. We will verify your request and respond within the time required by applicable law. You may '
        + 'also lodge a complaint with your local data-protection authority.',
      ],
    },
    {
      heading: 'Children’s privacy',
      body: [
        'The Service is not directed to children under 13, and we do not knowingly collect personal data from them. Where a higher minimum '
        + 'age applies (for example, 16 in parts of the EEA), that age applies. If you believe a child has provided us personal data, '
        + `contact ${PRIVACY_EMAIL} and we will delete it.`,
      ],
    },
    {
      heading: 'Third-party links',
      body: [
        'Cards may cite or link to third-party sources. We are not responsible for the privacy practices or content of sites we do not '
        + 'operate. Review their policies before providing them information.',
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'We may update this Privacy Policy as the Service evolves. We will revise the "last updated" date above and, for material changes, '
        + 'provide a more prominent notice in the app. Your continued use after an update means you accept the revised policy.',
      ],
    },
    {
      heading: 'Contact us',
      body: [
        `For any privacy question or request, email ${PRIVACY_EMAIL}. For general support, email ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
  foot: 'This policy is provided for transparency and does not constitute legal advice.',
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
