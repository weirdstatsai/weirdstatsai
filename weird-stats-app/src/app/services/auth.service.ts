import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { BehaviorSubject, Observable, of, switchMap } from 'rxjs';
import { UserProfile, DEFAULT_PLAN } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly PHOTO_STORAGE_KEY = 'weird_stats_custom_photo_';

  readonly user$: Observable<firebase.User | null> = this.afAuth.authState;

  readonly userProfile$: Observable<UserProfile | null> = this.user$.pipe(
    switchMap(user => {
      if (!user) return of(null);
      return this.afs.doc<UserProfile>(`users/${user.uid}`).valueChanges() as Observable<UserProfile | null>;
    })
  );

  private currentUser = new BehaviorSubject<firebase.User | null>(null);

  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {
    this.user$.subscribe(user => this.currentUser.next(user));
  }

  isLoggedIn(): boolean {
    return !!this.currentUser.value;
  }

  getCustomPhoto(uid: string): string | null {
    return localStorage.getItem(this.PHOTO_STORAGE_KEY + uid);
  }

  setCustomPhoto(uid: string, dataUrl: string): void {
    localStorage.setItem(this.PHOTO_STORAGE_KEY + uid, dataUrl);
  }

  removeCustomPhoto(uid: string): void {
    localStorage.removeItem(this.PHOTO_STORAGE_KEY + uid);
  }

  async signInWithGoogle(): Promise<firebase.User | null> {
    const cred = await this.afAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    if (cred.user) await this.ensureUserProfile(cred.user);
    return cred.user;
  }

  async signInWithFacebook(): Promise<firebase.User | null> {
    const cred = await this.afAuth.signInWithPopup(new firebase.auth.FacebookAuthProvider());
    if (cred.user) await this.ensureUserProfile(cred.user);
    return cred.user;
  }

  async sendPhoneCode(
    phoneNumber: string,
    recaptchaVerifier: firebase.auth.RecaptchaVerifier,
  ): Promise<firebase.auth.ConfirmationResult> {
    return this.afAuth.signInWithPhoneNumber(phoneNumber, recaptchaVerifier);
  }

  async confirmPhoneCode(
    confirmationResult: firebase.auth.ConfirmationResult,
    code: string,
  ): Promise<firebase.User | null> {
    const cred = await confirmationResult.confirm(code);
    if (cred.user) await this.ensureUserProfile(cred.user);
    return cred.user;
  }

  async signInWithEmail(email: string, password: string): Promise<firebase.User | null> {
    const cred = await this.afAuth.signInWithEmailAndPassword(email, password);
    if (cred.user) await this.ensureUserProfile(cred.user);
    return cred.user;
  }

  async createAccountWithEmail(email: string, password: string, name: string): Promise<firebase.User | null> {
    const cred = await this.afAuth.createUserWithEmailAndPassword(email, password);
    if (cred.user) {
      await cred.user.updateProfile({ displayName: name });
      await this.ensureUserProfile(cred.user);
    }
    return cred.user;
  }

  async sendPasswordReset(email: string): Promise<void> {
    await this.afAuth.sendPasswordResetEmail(email);
  }

  async updateDisplayName(name: string): Promise<void> {
    const user = this.currentUser.value;
    if (!user) return;
    await user.updateProfile({ displayName: name });
    await this.afs.doc(`users/${user.uid}`).set({ name }, { merge: true });
  }

  getCurrentUser(): firebase.User | null {
    return this.currentUser.value;
  }

  async signOut(): Promise<void> {
    await this.afAuth.signOut();
  }

  /** Check Firestore for existing user — create if missing, otherwise patch name/email. */
  private async ensureUserProfile(user: firebase.User): Promise<void> {
    const ref = this.afs.doc<UserProfile>(`users/${user.uid}`);
    const snap = await ref.get().toPromise();

    if (!snap?.exists) {
      await ref.set({
        uid: user.uid,
        name: user.displayName || user.phoneNumber || 'Anonymous',
        email: user.email || '',
        plan: DEFAULT_PLAN,
      });
    } else {
      // Keep plan intact; just refresh identity fields in case they changed
      await ref.set({
        name: user.displayName || user.phoneNumber || snap.data()?.name || 'Anonymous',
        email: user.email || snap.data()?.email || '',
      } as any, { merge: true });
    }
  }
}
