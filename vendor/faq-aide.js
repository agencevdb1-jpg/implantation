/* FAQ contextuelle « ? » — Implantation
   Affiche un bouton flottant (bas droite) et une modale latérale (droite)
   contenant uniquement les instructions de l'étape en cours.
   Inclusion : <script src="faq-aide.js" defer></script> juste avant </body>. */
(function () {
  "use strict";

  /* ---------- contenu de la FAQ, par étape (data-for du panneau) ---------- */
  const FAQ = {
    1: {
      titre: "Étape 1 · Parcelle",
      intro: "Charger le terrain sur lequel la maison sera posée.",
      sections: [
        {
          q: "Comment trouver ma parcelle ?",
          r: [
            "Onglet « Référence cadastrale » : renseignez la commune (nom ou code postal), la section (ex. AX) et le numéro.",
            "Onglet « Adresse » : tapez l'adresse, puis choisissez-la dans la liste.",
            "Cliquez sur « Rechercher la parcelle ». Les mesures, les voisins et le zonage se chargent automatiquement."
          ]
        },
        {
          q: "Mon terrain est formé de plusieurs parcelles ?",
          r: [
            "Saisissez plusieurs numéros séparés par une virgule, ou utilisez « + Ajouter une parcelle » pour les ajouter une à une.",
            "Cliquez ensuite sur « Fusionner en une seule parcelle ». Les parcelles doivent se toucher."
          ]
        },
        {
          q: "Le cadastre n'est pas à jour (division en cours) ?",
          r: [
            "Utilisez « Diviser le terrain… » : tracez une coupe entre deux points du contour, ou parallèlement à un côté (distance ou surface).",
            "Puis choisissez le lot sur lequel implanter la maison."
          ]
        },
        {
          q: "Je n'ai pas la référence, seulement un plan PDF ?",
          r: [
            "Déposez le PDF ou l'image dans « Ou à partir d'un plan cadastral ».",
            "Étalonnez l'échelle (bloc b), puis tracez le contour (bloc c).",
            "Ensuite, à l'étape PLU, indiquez la ville et la zone manuellement."
          ]
        },
        {
          q: "Comment vérifier l'échelle ?",
          r: [
            "L'échelle est lue sur le plan. Pour la contrôler, cliquez « Étalonner sur deux points » puis saisissez une distance réelle connue."
          ]
        }
      ]
    },
    2: {
      titre: "Étape 2 · PLU",
      intro: "Connaître les règles d'urbanisme qui s'appliquent au terrain.",
      sections: [
        {
          q: "Que fait cette étape ?",
          r: [
            "Elle affiche le zonage du PLU et lit le règlement écrit pour proposer emprise au sol, pleine terre, retraits et hauteurs.",
            "Les valeurs sont des propositions : vérifiez-les en suivant le lien vers la page du règlement."
          ]
        },
        {
          q: "Comment appliquer les règles à l'implantation ?",
          r: [
            "Cliquez sur « Appliquer à l'implantation ». Vous pouvez aussi modifier chaque champ de « Règles retenues » à la main."
          ]
        },
        {
          q: "Que signifient les zones hachurées en rouge ?",
          r: [
            "Ce sont les parties de la parcelle où l'on ne peut pas construire (retraits, fin de bande). La zone dégagée est constructible."
          ]
        },
        {
          q: "Le terrain est à cheval sur deux zones ?",
          r: [
            "L'outil l'indique en rouge. Chaque partie suit le règlement de sa zone : lisez les deux."
          ]
        },
        {
          q: "Pourquoi le PLU n'est-il pas trouvé ?",
          r: [
            "Si la commune est couverte par un PLUi, ou si vous êtes sur un plan PDF, consultez le Géoportail de l'Urbanisme ou saisissez la zone à la main."
          ]
        }
      ]
    },
    3: {
      titre: "Étape 3 · Maison",
      intro: "Choisir le modèle, puis son plan.",
      sections: [
        {
          q: "Comment choisir un modèle du catalogue ?",
          r: [
            "Filtrez par famille ou tapez le nom dans « Rechercher ».",
            "Sélectionnez le modèle, choisissez la finition, puis cliquez sur « Choisir ce modèle ».",
            "Les modèles marqués ⚠ ne tiennent pas dans la zone constructible."
          ]
        },
        {
          q: "Garage : comment le régler ?",
          r: [
            "Cochez ou décochez « Avec garage ».",
            "Pour un garage accolé en pignon, cochez l'option, choisissez sa largeur et son côté.",
            "Si la porte n'est pas en bas du plan, réglez « Façade du garage »."
          ]
        },
        {
          q: "Importer un nouveau plan de maison ?",
          r: [
            "Déposez le PDF ou l'image dans « Importer un nouveau plan ». Sur un PDF vectoriel, l'emprise et l'échelle sont détectées.",
            "Vérifiez l'échelle en étalonnant sur une cote, puis enregistrez dans le catalogue (mot de passe administrateur)."
          ]
        },
        {
          q: "Pas de plan ? Créer un rectangle.",
          r: [
            "Dans « Emprise au sol », saisissez la longueur et la largeur en mètres, puis cliquez sur « Créer »."
          ]
        }
      ]
    },
    4: {
      titre: "Étape 4 · Implantation",
      intro: "Poser la maison sur la parcelle et vérifier les distances.",
      sections: [
        {
          q: "Comment déplacer et tourner la maison ?",
          r: [
            "Glissez la maison à la souris, et tournez-la avec la poignée ronde.",
            "Ou utilisez les flèches du pavé, les boutons ↺ ↻ et −90 / +90, ou le clavier : flèches pour déplacer, Q et E pour pivoter, Maj pour aller plus vite."
          ]
        },
        {
          q: "Comment placer la maison à une distance précise d'une limite ?",
          r: [
            "Dans « Distances aux limites », tapez la distance souhaitée puis Entrée."
          ]
        },
        {
          q: "Orienter le garage vers la rue ?",
          r: [
            "Choisissez le côté de la parcelle qui donne sur la rue dans « Garage face à », puis cliquez sur « Orienter »."
          ]
        },
        {
          q: "Que signifient les couleurs des distances ?",
          r: [
            "Vert : conforme au retrait minimal. Rouge : retrait insuffisant. Gris : pas de minimum fixé pour cette limite."
          ]
        },
        {
          q: "Comment exporter le plan ?",
          r: [
            "Choisissez le format (A4 ou A3) et l'échelle, puis cliquez sur « Exporter en PDF ».",
            "Vous pouvez aussi enregistrer le projet dans votre compte, ou le télécharger en .json pour le sauvegarder."
          ]
        }
      ]
    },
    5: {
      titre: "Étape 5 · Chiffrage",
      intro: "Établir le prix de la construction et le total du projet.",
      sections: [
        {
          q: "Comment ajouter une option ?",
          r: [
            "Tapez dans « Rechercher une autre option » puis cliquez sur la ligne, ou utilisez les flèches et Entrée.",
            "Pour retirer une option, cliquez sur ✕ dans « Détail du chiffrage »."
          ]
        },
        {
          q: "Ajouter le prix du terrain ?",
          r: [
            "Saisissez le montant dans « Prix du terrain ». Le total projet se met à jour.",
            "Cochez « Ajouter les frais de notaire estimés » si vous voulez les inclure."
          ]
        },
        {
          q: "Les rangées de parpaings ?",
          r: [
            "Elles sont calculées d'après le dénivelé sous la maison. Utilisez + et − pour corriger, puis « Recalculer » pour revenir au calcul automatique."
          ]
        },
        {
          q: "Exporter la fiche ou la notice ?",
          r: [
            "« Exporter la fiche en PDF » produit la fiche de chiffrage (avec le plan si coché).",
            "« Remplir la notice Équation » complète automatiquement la notice PDF. Vérifiez les champs avant impression."
          ]
        },
        {
          q: "Les montants sont-ils contractuels ?",
          r: [
            "Non : ce sont des tarifs indicatifs du catalogue. Ils ne remplacent pas le devis de l'entreprise."
          ]
        }
      ]
    }
  };

  /* ---------- styles ---------- */
  const css = `
  .faq-fab{position:fixed;right:18px;bottom:18px;z-index:70;width:48px;height:48px;border-radius:50%;
    border:0;background:var(--house,#2446a6);color:#fff;font:700 22px/1 Archivo,Arial,sans-serif;
    box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;display:grid;place-items:center}
  .faq-fab:hover{filter:brightness(1.08)}
  .faq-fab:focus-visible{outline:2px solid var(--house,#2446a6);outline-offset:3px}
  .faq-side{position:fixed;top:0;right:0;bottom:0;z-index:80;width:min(400px,100vw);
    background:var(--panel,#fff);color:var(--ink,#16242c);border-left:1px solid var(--line,#d3d9da);
    box-shadow:-10px 0 30px rgba(0,0,0,.18);display:flex;flex-direction:column;
    transform:translateX(105%);transition:transform .22s ease;font:14px/1.45 Archivo,Arial,sans-serif;
    padding-top:env(safe-area-inset-top,0px)}
  .faq-side.open{transform:translateX(0)}
  .faq-side header{display:flex;align-items:flex-start;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--line,#d3d9da)}
  .faq-side header h3{margin:0;font-size:17px;font-weight:750}
  .faq-side header p{margin:4px 0 0;color:var(--muted,#5d6b73);font-size:13px}
  .faq-side .x{margin-left:auto;border:0;background:transparent;font-size:22px;line-height:1;padding:2px 8px;border-radius:6px;color:var(--muted,#5d6b73);cursor:pointer}
  .faq-side .x:hover{background:var(--field,#f3f5f5)}
  .faq-side .bd{overflow:auto;padding:6px 18px 24px;flex:1 1 auto}
  .faq-side details{border-bottom:1px solid var(--line,#d3d9da);padding:10px 0}
  .faq-side summary{cursor:pointer;font-weight:650;list-style:none}
  .faq-side summary::-webkit-details-marker{display:none}
  .faq-side summary::before{content:"+";display:inline-block;width:18px;color:var(--house,#2446a6);font-weight:700}
  .faq-side details[open] summary::before{content:"−"}
  .faq-side ul{margin:8px 0 2px 18px;padding:0}
  .faq-side li{margin:5px 0}
  .faq-side .foot{padding:10px 18px;border-top:1px solid var(--line,#d3d9da);color:var(--muted,#5d6b73);font-size:12px}
  .faq-veil{position:fixed;inset:0;z-index:75;background:rgba(9,14,18,.25);display:none}
  .faq-veil.on{display:block}
  @media (max-width:860px){ .faq-fab{bottom:12px;right:12px} }
  @media print{ .faq-fab,.faq-side,.faq-veil{display:none!important} }
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- DOM ---------- */
  const fab = document.createElement("button");
  fab.className = "faq-fab";
  fab.type = "button";
  fab.textContent = "?";
  fab.setAttribute("aria-label", "Aide sur cette étape");
  fab.setAttribute("aria-controls", "faq-side");
  fab.setAttribute("aria-expanded", "false");

  const veil = document.createElement("div");
  veil.className = "faq-veil";

  const side = document.createElement("aside");
  side.className = "faq-side";
  side.id = "faq-side";
  side.setAttribute("role", "dialog");
  side.setAttribute("aria-modal", "false");
  side.setAttribute("aria-labelledby", "faq-title");
  side.innerHTML = `
    <header>
      <div><h3 id="faq-title"></h3><p></p></div>
      <button class="x" type="button" aria-label="Fermer l'aide">×</button>
    </header>
    <div class="bd"></div>
    <div class="foot">Besoin d'aide sur autre chose ? Changez d'étape avec le bandeau du haut : l'aide s'adapte.</div>`;

  document.body.append(fab, veil, side);

  const $title = side.querySelector("#faq-title");
  const $intro = side.querySelector("header p");
  const $body = side.querySelector(".bd");
  const $close = side.querySelector(".x");

  /* ---------- étape courante : lue depuis le panneau visible ---------- */
  function currentStep() {
    const sec = document.querySelector(".panel section.on");
    const n = sec ? parseInt(sec.dataset.for, 10) : NaN;
    return FAQ[n] ? n : 1;
  }

  function render() {
    const n = currentStep();
    const f = FAQ[n];
    $title.textContent = f.titre;
    $intro.textContent = f.intro;
    $body.innerHTML = f.sections.map((s, i) =>
      `<details${i === 0 ? " open" : ""}><summary>${esc(s.q)}</summary>` +
      `<ul>${s.r.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>`
    ).join("");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function open() {
    render();
    side.classList.add("open");
    veil.classList.add("on");
    fab.setAttribute("aria-expanded", "true");
    $close.focus();
  }
  function close() {
    side.classList.remove("open");
    veil.classList.remove("on");
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }

  fab.addEventListener("click", () => (side.classList.contains("open") ? close() : open()));
  $close.addEventListener("click", close);
  veil.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && side.classList.contains("open")) close(); });

  /* si l'utilisateur change d'étape pendant que la modale est ouverte, on met à jour le contenu */
  new MutationObserver(() => { if (side.classList.contains("open")) render(); })
    .observe(document.querySelector(".panel"), { attributes: true, subtree: true, attributeFilter: ["class"] });
})();
