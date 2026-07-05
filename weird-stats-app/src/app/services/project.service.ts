import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Observable, map } from 'rxjs';
import { Project } from '../models/project.model';

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

  /** One-shot lookup of a single project by id. */
  async get(uid: string, projectId: string): Promise<Project | undefined> {
    const snap = await this.afs.doc<{ projects?: Project[] }>(`users/${uid}`).get().toPromise();
    const list = snap?.data()?.projects ?? [];
    return list.find(p => p.project_id === projectId);
  }
}
