import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

@Component({
  selector: 'app-project-import',
  templateUrl: './project-import.page.html',
  styleUrls: ['./project-import.page.scss'],
})
export class ProjectImportPage implements OnInit {
  projectId = '';
  file?: File;
  analyzing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0];
    input.value = ''; // allow re-picking the same file later
    if (!chosen) return;

    const isPdf = chosen.type === 'application/pdf' || chosen.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      await this.toast('Please choose a PDF file', 'danger');
      return;
    }
    if (chosen.size > MAX_PDF_BYTES) {
      await this.toast('PDF must be under 20 MB', 'danger');
      return;
    }
    this.file = chosen;
  }

  get sizeLabel(): string {
    if (!this.file) return '';
    const mb = this.file.size / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(this.file.size / 1024)} KB`;
  }

  clearFile(): void {
    this.file = undefined;
  }

  async generate(): Promise<void> {
    if (!this.file || this.analyzing) return;
    this.analyzing = true;

    // Future: upload the PDF (Firebase Storage) and trigger the analysis agent
    // that reads it and writes generated graph cards back to this project.
    setTimeout(async () => {
      this.analyzing = false;
      await this.toast('PDF analysis agent is coming soon', 'primary');
      this.close();
    }, 2400);
  }

  close(): void {
    this.router.navigate(['/project', this.projectId]);
  }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 1700, color });
    await t.present();
  }
}
