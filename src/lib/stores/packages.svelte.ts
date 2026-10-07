// Open/close state for the .mosaic import and export dialogs.

import { toast } from 'svelte-sonner';
import { readPackagePreview, type PackagePreview } from '$lib/services/packageService';

class PackageDialogs {
  importPreview = $state<PackagePreview | null>(null);
  /** Pages ticked when the export dialog opens. */
  exportPreselect = $state<'current' | 'all' | null>(null);

  async openImport(path: string) {
    try {
      this.importPreview = await readPackagePreview(path);
    } catch (error) {
      console.error('Could not read package:', error);
      toast.error('Could not open package', { description: error instanceof Error ? error.message : String(error) });
    }
  }

  openExport(preselect: 'current' | 'all') {
    this.exportPreselect = preselect;
  }
}

export const packageDialogs = new PackageDialogs();
