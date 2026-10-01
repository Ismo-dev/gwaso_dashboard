import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { Editor, Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

/** Couleurs proposées : uniquement celles de la charte (classes définies dans styles.scss). */
export const COULEURS_TEXTE = [
  { classe: 'gw-couleur-terre', libelle: 'Terre cuite' },
  { classe: 'gw-couleur-karite', libelle: 'Brun karité' },
  { classe: 'gw-couleur-cacao', libelle: 'Brun cacao' },
  { classe: 'gw-couleur-vert', libelle: 'Vert' },
];

/**
 * Marque « couleur » : la couleur est enregistrée sous forme de classe (<span class="gw-couleur-terre">),
 * jamais en style libre. Le serveur ne garde que ces classes (voir TexteRiche.java).
 */
const Couleur = Mark.create({
  name: 'couleur',
  addAttributes() {
    return {
      classe: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('class'),
        renderHTML: (attributs: Record<string, unknown>) => ({ class: attributs['classe'] }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element: HTMLElement) =>
          COULEURS_TEXTE.some((c) => element.classList.contains(c.classe)) ? {} : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

let compteur = 0;

/**
 * Champ de texte riche (gras, italique, souligné, listes, couleurs de la charte).
 * S'utilise comme un champ de formulaire normal ; la valeur est du HTML simple.
 *
 * Utilisation :
 *   <app-editeur-riche formControlName="description" libelle="Présentation"
 *                      aide="L'histoire du plat…" [longueurMax]="3000" />
 */
@Component({
  imports: [MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip, NgIcon],
  selector: 'app-editeur-riche',
  styleUrl: './editeur-riche.scss',
  templateUrl: './editeur-riche.html',
})
export class EditeurRiche implements ControlValueAccessor, AfterViewInit, OnDestroy {
  /** Champ de formulaire relié (formControlName) : on s'y déclare comme « value accessor ». */
  private ngControl = inject(NgControl, { self: true, optional: true });
  private destroyRef = inject(DestroyRef);

  readonly libelle = input.required<string>();
  readonly aide = input('');
  readonly obligatoire = input(false);
  /** Longueur maximale du HTML enregistré (limite de la base de données). */
  readonly longueurMax = input<number | null>(null);
  readonly hauteurMin = input('140px');

  private zone = viewChild.required<ElementRef<HTMLDivElement>>('zone');
  private editeur: Editor | null = null;
  private valeurInitiale = '';
  private onChange: (valeur: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly id = `editeur-riche-${++compteur}`;
  protected readonly couleurs = COULEURS_TEXTE;

  /** Incrémenté à chaque changement dans l'éditeur : met à jour l'état des boutons. */
  private version = signal(0);
  protected nbCaracteres = signal(0);
  protected longueurHtml = signal(0);
  protected aLeFocus = signal(false);
  protected desactive = signal(false);
  protected invalide = signal(false);
  protected messageErreur = signal('');

  protected tropLong = computed(() => {
    const max = this.longueurMax();
    return max !== null && this.longueurHtml() > max;
  });

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngAfterViewInit(): void {
    this.editeur = new Editor({
      element: this.zone().nativeElement,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          link: false,
        }),
        Couleur,
      ],
      content: this.valeurInitiale,
      editable: !this.desactive(),
      editorProps: {
        attributes: {
          class: 'contenu',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-labelledby': `${this.id}-libelle`,
          'aria-describedby': `${this.id}-aide`,
        },
      },
      onUpdate: ({ editor }) => {
        this.onChange(editor.isEmpty ? '' : editor.getHTML());
        this.mesurer();
      },
      onTransaction: () => this.version.update((v) => v + 1),
      onFocus: () => this.aLeFocus.set(true),
      onBlur: () => {
        this.aLeFocus.set(false);
        this.onTouched();
      },
    });
    this.mesurer();

    // Affiche les erreurs du champ de formulaire (obligatoire, trop long...)
    const controle = this.ngControl?.control;
    if (controle) {
      controle.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        const afficher = controle.invalid && controle.touched;
        this.invalide.set(afficher);
        this.messageErreur.set(
          !afficher
            ? ''
            : controle.hasError('required')
              ? 'Ce champ est obligatoire.'
              : controle.hasError('maxlength')
                ? 'Le texte est trop long : raccourcissez-le ou retirez de la mise en forme.'
                : 'Ce champ est invalide.',
        );
      });
    }
  }

  ngOnDestroy(): void {
    this.editeur?.destroy();
  }

  // ----- Boutons de la barre d'outils -----

  /** true si la mise en forme est active à l'endroit du curseur. */
  protected actif(nom: string, attributs?: Record<string, unknown>): boolean {
    this.version(); // relit l'état à chaque changement
    return this.editeur?.isActive(nom, attributs) ?? false;
  }

  protected peutAnnuler(): boolean {
    this.version();
    return this.editeur?.can().undo() ?? false;
  }

  protected peutRetablir(): boolean {
    this.version();
    return this.editeur?.can().redo() ?? false;
  }

  basculerGras(): void {
    this.editeur?.chain().focus().toggleBold().run();
  }

  basculerItalique(): void {
    this.editeur?.chain().focus().toggleItalic().run();
  }

  basculerSouligne(): void {
    this.editeur?.chain().focus().toggleUnderline().run();
  }

  basculerListe(): void {
    this.editeur?.chain().focus().toggleBulletList().run();
  }

  basculerListeNumerotee(): void {
    this.editeur?.chain().focus().toggleOrderedList().run();
  }

  appliquerCouleur(classe: string | null): void {
    const chaine = this.editeur?.chain().focus();
    if (classe) {
      chaine?.setMark('couleur', { classe }).run();
    } else {
      chaine?.unsetMark('couleur').run();
    }
  }

  effacerMiseEnForme(): void {
    this.editeur?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  annuler(): void {
    this.editeur?.chain().focus().undo().run();
  }

  retablir(): void {
    this.editeur?.chain().focus().redo().run();
  }

  // ----- ControlValueAccessor : le lien avec le formulaire Angular -----

  writeValue(valeur: string | null): void {
    const html = versHtml(valeur ?? '');
    if (this.editeur) {
      this.editeur.commands.setContent(html, { emitUpdate: false });
      this.mesurer();
    } else {
      this.valeurInitiale = html;
    }
  }

  registerOnChange(fn: (valeur: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.desactive.set(desactive);
    this.editeur?.setEditable(!desactive);
  }

  private mesurer(): void {
    if (!this.editeur) {
      return;
    }
    this.nbCaracteres.set(this.editeur.getText().trim().length);
    this.longueurHtml.set(this.editeur.isEmpty ? 0 : this.editeur.getHTML().length);
  }
}

/** Un ancien texte brut (sans balises) est converti en paragraphes. */
function versHtml(valeur: string): string {
  if (!valeur || /<\/?[a-z][\s\S]*>/i.test(valeur)) {
    return valeur;
  }
  const echappe = valeur.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return echappe
    .split(/\n{2,}/)
    .map((paragraphe) => `<p>${paragraphe.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
