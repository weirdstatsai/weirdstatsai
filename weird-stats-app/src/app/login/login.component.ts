import { Component, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { AuthService } from '../services/auth.service';

type LoginMode = 'choose' | 'email-signin' | 'email-signup' | 'phone';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnDestroy {
  mode: LoginMode = 'choose';
  loading = false;
  error = '';

  // Email/password fields
  email = '';
  password = '';
  confirmPassword = '';
  displayName = '';

  // Phone fields
  phoneNumber = '';
  otpCode = '';
  otpSent = false;

  private recaptchaVerifier?: firebase.auth.RecaptchaVerifier;
  private confirmationResult?: firebase.auth.ConfirmationResult;

  constructor(private modalCtrl: ModalController, private authService: AuthService) {}

  // ── Social ────────────────────────────────────────────────────────────────
  async continueWithGoogle(): Promise<void> {
    await this.run(() => this.authService.signInWithGoogle());
  }

  async continueWithFacebook(): Promise<void> {
    await this.run(() => this.authService.signInWithFacebook());
  }

  // ── Email sign in ─────────────────────────────────────────────────────────
  async signInWithEmail(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      this.error = 'Enter your email and password.';
      return;
    }
    await this.run(() => this.authService.signInWithEmail(this.email.trim(), this.password));
  }

  // ── Email sign up ─────────────────────────────────────────────────────────
  async createAccount(): Promise<void> {
    if (!this.displayName.trim() || !this.email.trim() || !this.password) {
      this.error = 'Fill in all fields.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }
    await this.run(() =>
      this.authService.createAccountWithEmail(this.email.trim(), this.password, this.displayName.trim())
    );
  }

  async forgotPassword(): Promise<void> {
    if (!this.email.trim()) { this.error = 'Enter your email first.'; return; }
    this.loading = true; this.error = '';
    try {
      await this.authService.sendPasswordReset(this.email.trim());
      this.error = '✓ Reset link sent — check your inbox.';
    } catch (e: any) {
      this.error = e?.message ?? 'Could not send reset email.';
    } finally { this.loading = false; }
  }

  // ── Phone ─────────────────────────────────────────────────────────────────
  async sendCode(): Promise<void> {
    if (!this.phoneNumber.trim()) {
      this.error = 'Enter a phone number with country code.';
      return;
    }
    await this.run(async () => {
      this.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
      this.confirmationResult = await this.authService.sendPhoneCode(this.phoneNumber.trim(), this.recaptchaVerifier);
      this.otpSent = true;
      return null;
    });
  }

  async verifyCode(): Promise<void> {
    if (!this.confirmationResult || !this.otpCode.trim()) {
      this.error = 'Enter the verification code.';
      return;
    }
    await this.run(() => this.authService.confirmPhoneCode(this.confirmationResult!, this.otpCode.trim()));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  setMode(m: LoginMode): void { this.mode = m; this.error = ''; }
  cancel(): void { this.modalCtrl.dismiss(false); }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.error = ''; this.loading = true;
    try {
      const r = await action();
      if (r !== null) this.modalCtrl.dismiss(true);
    } catch (e: any) {
      this.error = e?.message ?? 'Something went wrong.';
    } finally { this.loading = false; }
  }

  ngOnDestroy(): void { this.recaptchaVerifier?.clear(); }
}
