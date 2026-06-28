import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export type FeedbackType = 'bug' | 'feature' | 'general';

export interface Feedback {
  uid: string | null;
  message: string;
  type: FeedbackType;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  constructor(private firestore: AngularFirestore) {}

  async submit(uid: string | null, message: string, type: FeedbackType): Promise<void> {
    const data: Feedback = {
      uid,
      message,
      type,
      createdAt: new Date().toISOString(),
    };
    await this.firestore.collection('feedback').add(data);
  }
}
