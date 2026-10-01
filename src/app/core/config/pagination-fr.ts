import { Service } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Subject } from 'rxjs';

/** Textes de la pagination des tableaux (mat-paginator), en français. */
@Service({ autoProvided: false })
export class PaginationFr implements MatPaginatorIntl {
  readonly changes = new Subject<void>();

  itemsPerPageLabel = 'Éléments par page';
  nextPageLabel = 'Page suivante';
  previousPageLabel = 'Page précédente';
  firstPageLabel = 'Première page';
  lastPageLabel = 'Dernière page';

  getRangeLabel(page: number, taille: number, total: number): string {
    if (total === 0 || taille === 0) {
      return `0 sur ${total}`;
    }
    const debut = page * taille + 1;
    const fin = Math.min((page + 1) * taille, total);
    return `${debut} – ${fin} sur ${total}`;
  }
}
