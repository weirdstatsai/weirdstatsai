import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import firebase from 'firebase/compat/app';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  plan: 'free' | 'pro';
  createdAt: string;
  totalCharts: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  readonly profile$: Observable<UserProfile | null>;

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
  ) {
    this.profile$ = this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return of(null);
        return this.firestore.doc<UserProfile>(`users/${user.uid}`).valueChanges().pipe(map(v => v ?? null));
      }),
    );

    this.authService.user$.subscribe(user => {
      if (user) this.ensureProfile(user);
    });
  }

  private async ensureProfile(user: firebase.User): Promise<void> {
    const ref = this.firestore.doc<UserProfile>(`users/${user.uid}`);
    const snap = await ref.get().toPromise();

    if (!snap?.exists) {
      const profile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        plan: 'free',
        createdAt: new Date().toISOString(),
        totalCharts: 0,
      };
      await ref.set(profile);
    } else {
      await ref.update({
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
    }
  }

  async incrementTotalCharts(uid: string): Promise<void> {
    const ref = this.firestore.doc(`users/${uid}`);
    const snap = await ref.get().toPromise();
    const current = (snap?.data() as UserProfile)?.totalCharts ?? 0;
    await ref.update({ totalCharts: current + 1 });
  }
}
