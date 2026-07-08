import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Observable, map } from 'rxjs';
import { Project } from '../models/project.model';
import { StoredStatCard } from '../models/weird-card.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private afs: AngularFirestore) {}

  /** Live stream of the user's projects (stored as an array on their user doc). */
  projects$(uid: string): Observable<Project[]> {
    return this.afs
      .doc<{ projects?: Project[] }>(`users/${uid}`)
      .valueChanges()
      .pipe(map(doc => doc?.projects ?? []));
  }

  /** Create a new project object { project_id, project_name } on the user doc. */
  async create(uid: string, name: string): Promise<Project> {
    const project: Project = {
      project_id: this.afs.createId(),
      project_name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    await this.afs.doc(`users/${uid}`).set(
      { projects: firebase.firestore.FieldValue.arrayUnion(project) },
      { merge: true },
    );
    return project;
  }

  /**
   * Live stream of the stat cards generated inside a project.
   * Single-equality query + client-side filter/sort, matching the profile
   * pattern (avoids a composite Firestore index).
   */
  projectStats$(uid: string, projectId: string): Observable<StoredStatCard[]> {
    return this.afs
      .collection<StoredStatCard>('stats', ref =>
        ref.where('createdBy', '==', uid).limit(300))
      .valueChanges({ idField: 'id' })
      .pipe(map(docs => docs
        .filter(d => d.projectId === projectId && d.data?.title && d.data?.cardType)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))));
  }

  /** One-shot lookup of a single project by id. */
  async get(uid: string, projectId: string): Promise<Project | undefined> {
    const snap = await this.afs.doc<{ projects?: Project[] }>(`users/${uid}`).get().toPromise();
    const list = snap?.data()?.projects ?? [];
    return list.find(p => p.project_id === projectId);
  }
}
