import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface ContactForm {
  name: string;
  email: string;
  company: string;
  companySize: string;
  role: string;
  phone: string;
  topic: string;
  message: string;
  website: string;   // honeypot — kept off-screen, only bots fill it
}

@Component({
  selector: 'app-contact',
  templateUrl: './contact.page.html',
  styleUrls: ['./contact.page.scss'],
})
export class ContactPage {
  form: ContactForm = {
    name: '', email: '', company: '', companySize: '',
    role: '', phone: '', topic: '', message: '', website: '',
  };

  state: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  submitted = false;   // reveals validation only after a submit attempt
  errorMsg = '';

  readonly sizes = ['1–10', '11–50', '51–200', '201–1,000', '1,000+'];
  readonly topics = [
    'Enterprise plan', 'API access', 'Custom / white-label',
    'Partnership', 'Press & media', 'Something else',
  ];

  readonly directEmail = 'weirdstats.ai@gmail.com';

  constructor(private http: HttpClient, private nav: NavController) {}

  get emailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim());
  }

  get messageValid(): boolean {
    return this.form.message.trim().length >= 10;
  }

  get canSubmit(): boolean {
    return !!this.form.name.trim() && this.emailValid
      && !!this.form.company.trim() && this.messageValid
      && this.state !== 'sending';
  }

  async submit(): Promise<void> {
    this.submitted = true;
    // Honeypot filled → silently "succeed" without hitting the backend.
    if (this.form.website.trim()) { this.state = 'success'; return; }
    if (!this.canSubmit) return;

    this.state = 'sending';
    this.errorMsg = '';
    try {
      const { website, ...payload } = this.form;
      await firstValueFrom(this.http.post(`${environment.apiUrl}/api/contact`, payload));
      this.state = 'success';
    } catch {
      this.state = 'error';
      this.errorMsg = `Couldn't send that just now — please email us directly at ${this.directEmail}.`;
    }
  }

  reset(): void {
    this.form = {
      name: '', email: '', company: '', companySize: '',
      role: '', phone: '', topic: '', message: '', website: '',
    };
    this.state = 'idle';
    this.submitted = false;
  }

  back(): void { this.nav.back(); }
}
