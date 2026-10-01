import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AValiderService } from '../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { messageErreur } from '../../../core/utils/erreurs';
import { VideoResponse } from '../models/video.model';
import { VideoService } from './video.service';

/**
 * Décisions de modération d'une vidéo, avec leur confirmation et leur message.
 * Partagées par la liste, la fiche et le fil : le comportement est identique partout.
 * Chaque méthode renvoie true si l'action a été faite (false si annulée ou en erreur).
 */
@Service()
export class ModerationVideo {
  private videoService = inject(VideoService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);

  async publier(video: VideoResponse): Promise<boolean> {
    const confirme = await this.confirmation.demander({
      titre: `Publier « ${video.titre} » ?`,
      message: 'La vidéo sera visible par toute la communauté Gwaso.',
      texteConfirmer: 'Publier la vidéo',
    });
    return (
      confirme &&
      this.executer(
        () => firstValueFrom(this.videoService.valider(video.id)),
        `« ${video.titre} » est publiée.`,
        "La vidéo n'a pas pu être publiée.",
      )
    );
  }

  async refuser(video: VideoResponse): Promise<boolean> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Refuser « ${video.titre} » ?`,
      message: "La vidéo ne sera pas publiée. L'auteur pourra la corriger et la proposer à nouveau.",
      libelle: 'Motif du refus',
      aide: "Ce message sera montré à l'auteur, ex. « Ce n'est pas une vidéo de cuisine ».",
      texteConfirmer: 'Refuser la vidéo',
    });
    return (
      !!motif &&
      this.executer(
        () => firstValueFrom(this.videoService.rejeter(video.id, motif)),
        `« ${video.titre} » est refusée. L'auteur verra votre motif.`,
        "La vidéo n'a pas pu être refusée.",
      )
    );
  }

  async desactiver(video: VideoResponse): Promise<boolean> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Retirer « ${video.titre} » de la communauté ?`,
      message: 'La vidéo ne sera plus visible. Vous pourrez la remettre en ligne plus tard.',
      libelle: 'Motif du retrait',
      aide: "Ce message sera montré à l'auteur.",
      texteConfirmer: 'Retirer la vidéo',
    });
    return (
      !!motif &&
      this.executer(
        () => firstValueFrom(this.videoService.desactiver(video.id, motif)),
        `« ${video.titre} » n'est plus visible.`,
        "La vidéo n'a pas pu être retirée.",
      )
    );
  }

  async reactiver(video: VideoResponse): Promise<boolean> {
    const confirme = await this.confirmation.demander({
      titre: `Remettre « ${video.titre} » en ligne ?`,
      message: 'La vidéo sera de nouveau visible par toute la communauté.',
      texteConfirmer: 'Remettre en ligne',
    });
    return (
      confirme &&
      this.executer(
        () => firstValueFrom(this.videoService.reactiver(video.id)),
        `« ${video.titre} » est de nouveau en ligne.`,
        "La vidéo n'a pas pu être remise en ligne.",
      )
    );
  }

  async supprimer(video: VideoResponse): Promise<boolean> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer « ${video.titre} » ?`,
      message:
        "La vidéo disparaîtra de Gwaso, pour tout le monde, y compris son auteur. Pour la cacher seulement, utilisez plutôt « Retirer ».",
      texteConfirmer: 'Supprimer définitivement',
      danger: true,
    });
    return (
      confirme &&
      this.executer(
        () => firstValueFrom(this.videoService.supprimer(video.id)),
        `« ${video.titre} » est supprimée.`,
        "La vidéo n'a pas pu être supprimée.",
      )
    );
  }

  private async executer(
    appel: () => Promise<unknown>,
    succes: string,
    echec: string,
  ): Promise<boolean> {
    try {
      await appel();
      this.notification.succes(succes);
      this.aValider.rafraichir();
      return true;
    } catch (erreur) {
      this.notification.erreur(messageErreur(erreur, echec));
      return false;
    }
  }
}
