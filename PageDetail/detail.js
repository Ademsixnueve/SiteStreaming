/* ========================================
   CONFIGURATION
   ======================================== */
const API_KEY = "a9d7c117e25b766c166815d45301a888";

/* ========================================
   ÉLÉMENTS DOM
   ======================================== */
const $ = id => document.getElementById(id);

/* ========================================
   API TMDB - Helpers
   ======================================== */
async function tmdb(endpoint){
  const url = `https://api.themoviedb.org/3${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if(!res.ok) throw new Error(data.status_message || "TMDB error");
  return data;
}

/* ========================================
   GESTION DES GENRES
   ======================================== */
let movieGenreMap = null;
let tvGenreMap = null;

async function ensureGenreMaps(){
  if(!movieGenreMap || !tvGenreMap){
    const [movies, tv] = await Promise.all([
      tmdb(`/genre/movie/list?language=fr-FR`),
      tmdb(`/genre/tv/list?language=fr-FR`)
    ]);
    movieGenreMap = new Map(movies.genres.map(g => [g.id, g.name]));
    tvGenreMap = new Map(tv.genres.map(g => [g.id, g.name]));
  }
}

/* ========================================
   FONCTIONS UTILITAIRES
   ======================================== */
// Fonction pour générer les étoiles
function generateStars(rating, maxStars = 5){
  // Convertir la note de 0-10 à 0-5 étoiles
  // S'assurer que rating est entre 0 et 10 et est un nombre
  const numRating = parseFloat(rating) || 0;
  const normalizedRating = Math.max(0, Math.min(10, numRating));
  // Convertir en nombre d'étoiles (0-5)
  // Exemples:
  // - 6.6/10 = 0.66 * 5 = 3.3 → 3 étoiles pleines
  // - 8.0/10 = 0.8 * 5 = 4.0 → 4 étoiles pleines
  // - 10.0/10 = 1.0 * 5 = 5.0 → 5 étoiles pleines
  const starRating = (normalizedRating / 10) * maxStars;
  const fullStars = Math.floor(starRating);
  
  const starsHTML = Array(maxStars).fill(0).map((_, i) => {
    // Si l'index est inférieur au nombre d'étoiles pleines, afficher une étoile pleine
    if(i < fullStars){
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="#ffd700" stroke="#ffd700" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    } else {
      // Sinon, afficher une étoile vide
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd700" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
  }).join("");
  return starsHTML;
}

// Fonction pour générer les étoiles interactives (contour uniquement)
function generateStarsInput(){
  return Array(5).fill(0).map((_, i) => {
    return `<svg class="star-input" data-star="${i + 1}" width="24" height="24" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1.5"/></svg>`;
  }).join("");
}

// Variable globale pour stocker le rating actuel
let currentStarRating = 0;

// Fonction pour gérer l'interactivité des étoiles
function setupStarsInteraction(){
  const starsContainer = document.getElementById('detailStarsInput');
  if(!starsContainer) {
    console.error('Container not found');
    return;
  }
  
  // Attendre un peu pour s'assurer que les étoiles sont dans le DOM
  setTimeout(() => {
    const stars = Array.from(starsContainer.querySelectorAll('svg.star-input'));
    console.log('Stars found:', stars.length);
    console.log('Stars container:', starsContainer);
    console.log('Stars HTML:', starsContainer.innerHTML.substring(0, 200));
    
    if(stars.length === 0) {
      console.error('No stars found in container');
      console.error('Container HTML:', starsContainer.innerHTML);
      return;
    }
    
    // Fonction pour mettre à jour l'affichage des étoiles (contour uniquement)
    function updateStars(hoverIndex = 0){
      // Si hoverIndex est 0, utiliser currentStarRating (rating sélectionné)
      const ratingToUse = hoverIndex > 0 ? hoverIndex : currentStarRating;
      console.log('updateStars called - hoverIndex:', hoverIndex, 'currentStarRating:', currentStarRating, 'ratingToUse:', ratingToUse);
      
      stars.forEach((star, index) => {
        const starNum = index + 1;
        const shouldFill = starNum <= ratingToUse;
        const polygon = star.querySelector('polygon');
        
        if(polygon){
          // Toujours pas de remplissage, seulement le contour change de couleur
          if(shouldFill){
            // Étoile "active" : contour jaune, pas de remplissage
            polygon.setAttribute('fill', 'none');
            polygon.setAttribute('stroke', '#ffd700');
            polygon.setAttribute('stroke-width', '1.5');
            polygon.style.fill = 'none';
            polygon.style.stroke = '#ffd700';
            polygon.style.strokeWidth = '1.5px';
          } else {
            // Étoile vide : contour gris clair, pas de remplissage
            polygon.setAttribute('fill', 'none');
            polygon.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
            polygon.setAttribute('stroke-width', '1.5');
            polygon.style.fill = 'none';
            polygon.style.stroke = 'rgba(255, 255, 255, 0.3)';
            polygon.style.strokeWidth = '1.5px';
          }
        }
      });
    }
    
    // Initialiser toutes les étoiles comme vides au départ
    updateStars(0);
    
    // Ajouter les event listeners directement sur chaque étoile ET sur le polygon
    stars.forEach((star, index) => {
      const starNum = index + 1;
      const polygon = star.querySelector('polygon');
      
      // Fonction pour gérer le hover
      const handleMouseover = (e) => {
        e.stopPropagation();
        updateStars(starNum);
      };
      
      // Fonction pour gérer le clic
      const handleClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        currentStarRating = starNum;
        console.log('Rating set to:', starNum, 'currentStarRating:', currentStarRating);
        // Après le clic, afficher les étoiles selon le rating sélectionné
        updateStars(0); // hoverIndex = 0, donc utilise currentStarRating
      };
      
      // Ajouter les listeners sur le SVG
      star.addEventListener('mouseover', handleMouseover);
      star.addEventListener('click', handleClick);
      
      // Ajouter aussi sur le polygon pour plus de fiabilité
      if(polygon){
        polygon.addEventListener('mouseover', handleMouseover);
        polygon.addEventListener('click', handleClick);
      }
    });
    
    // Quand on quitte le conteneur, revenir au rating actuel
    starsContainer.addEventListener('mouseleave', () => {
      console.log('Mouse leave, currentStarRating:', currentStarRating);
      updateStars(0); // hoverIndex = 0, donc utilise currentStarRating
    });
  }, 100);
}

/* ========================================
   CHARGEMENT DES DÉTAILS
   ======================================== */
async function loadDetails(){
  // Récupérer l'ID et le type depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');
  const type = urlParams.get('type') || 'movie';
  
  if(!itemId){
    console.error("ID manquant dans l'URL");
    return;
  }
  
  try {
    await ensureGenreMaps();
    
    // Charger les détails, crédits et vidéos
    // Charger les vidéos sans filtre de langue pour avoir plus de résultats
    const [details, credits, videos, videosAll] = await Promise.all([
      tmdb(`/${type}/${itemId}?language=fr-FR`),
      tmdb(`/${type}/${itemId}/credits?language=fr-FR`),
      tmdb(`/${type}/${itemId}/videos?language=fr-FR`),
      tmdb(`/${type}/${itemId}/videos`) // Sans langue pour avoir toutes les vidéos
    ]);
    
    const isMovie = type === "movie";
    const title = isMovie ? (details.title || details.original_title) : (details.name || details.original_name);
    const posterPath = details.poster_path;
    const backdropPath = details.backdrop_path || details.poster_path;
    const rating = details.vote_average || 0;
    const overview = details.overview || "Aucune description disponible.";
    
    // Mettre à jour le fond avec l'affiche en flou
    const detailBgImg = document.getElementById("detailBackgroundImage");
    if(detailBgImg){
      const imageUrl = backdropPath 
        ? `https://image.tmdb.org/t/p/original${backdropPath}`
        : (posterPath ? `https://image.tmdb.org/t/p/w1280${posterPath}` : null);
      
      if(imageUrl){
        detailBgImg.src = imageUrl;
        detailBgImg.style.display = "block";
      }
    }
    
    // Mettre à jour le poster
    const detailPoster = document.getElementById("detailPoster");
    if(detailPoster){
      if(posterPath){
        // Utiliser w780 pour une meilleure qualité du poster
        detailPoster.src = `https://image.tmdb.org/t/p/w780${posterPath}`;
        detailPoster.alt = title;
        detailPoster.style.display = "block";
      } else {
        detailPoster.style.display = "none";
      }
    }
    
    // Titre et type
    const detailTitle = document.getElementById("detailTitle");
    if(detailTitle) detailTitle.textContent = title;
    
    const detailType = document.getElementById("detailType");
    if(detailType) detailType.textContent = isMovie ? "Film" : "Série";
    
    // Note
    const detailRating = document.getElementById("detailRating");
    if(detailRating) detailRating.textContent = rating.toFixed(1);
    
    const detailStars = document.getElementById("detailStars");
    if(detailStars) detailStars.innerHTML = generateStars(rating);
    
    const detailRatingBadge = document.getElementById("detailRatingBadge");
    if(detailRatingBadge) detailRatingBadge.textContent = `${Math.round(rating)}/10`;
    
    // Durée
    const detailDuration = document.getElementById("detailDuration");
    if(detailDuration){
      if(isMovie && details.runtime){
        const hours = Math.floor(details.runtime / 60);
        const minutes = details.runtime % 60;
        detailDuration.textContent = `${hours}h ${minutes}min - ${details.production_countries?.[0]?.name || "—"}`;
      } else if(!isMovie){
        const seasons = details.number_of_seasons || 0;
        const episodes = details.number_of_episodes || 0;
        const country = details.production_countries?.[0]?.name || "—";
        detailDuration.textContent = `${seasons} saison${seasons > 1 ? "s" : ""} • ${episodes} ép. - ${country}`;
      } else {
        detailDuration.textContent = "—";
      }
    }
    
    // Genres
    const detailGenres = document.getElementById("detailGenres");
    if(detailGenres){
      const genreMap = isMovie ? movieGenreMap : tvGenreMap;
      const genres = (details.genres || []).slice(0, 5).map(g => {
        const genreName = genreMap.get(g.id) || g.name;
        return `<span class="detail-genre-tag">${genreName}</span>`;
      }).join("");
      detailGenres.innerHTML = genres || "<span class='detail-genre-tag'>—</span>";
    }
    
    // Synopsis
    const detailSynopsis = document.getElementById("detailSynopsis");
    if(detailSynopsis) detailSynopsis.textContent = overview;
    
    // Section "À propos"
    const detailAboutSummary = document.getElementById("detailAboutSummary");
    if(detailAboutSummary) detailAboutSummary.textContent = overview;
    
    // Réalisateur
    const detailCreator = document.getElementById("detailCreator");
    if(detailCreator){
      // Trouver le h3 dans la même section que detailCreator
      const creatorSection = detailCreator.closest('.detail-about-section');
      const creatorTitle = creatorSection ? creatorSection.querySelector('h3') : null;
      
      // Toujours afficher "Réalisateur" (pour films et séries)
      if(creatorTitle){
        creatorTitle.textContent = "Réalisateur";
      }
      
      // Pour les films et séries : afficher tous les réalisateurs depuis credits.crew
      if(credits && credits.crew){
        const directors = credits.crew
          .filter(person => person.job === "Director")
          .map(person => person.name);
        if(directors.length > 0){
          detailCreator.textContent = directors.join(", ");
        } else {
          // Si pas de réalisateurs, pour les séries afficher les créateurs en fallback
          if(!isMovie && details.created_by && details.created_by.length > 0){
            detailCreator.textContent = details.created_by.map(c => c.name).join(", ");
          } else {
            detailCreator.textContent = "—";
          }
        }
      } else {
        // Si pas de credits.crew, pour les séries afficher les créateurs en fallback
        if(!isMovie && details.created_by && details.created_by.length > 0){
          detailCreator.textContent = details.created_by.map(c => c.name).join(", ");
        } else {
          detailCreator.textContent = "—";
        }
      }
    }
    
    // Distribution
    const detailCast = document.getElementById("detailCast");
    if(detailCast && credits && credits.cast){
      const castNames = credits.cast.slice(0, 10).map(actor => actor.name).join(", ");
      detailCast.textContent = castNames || "—";
    }
    
    // Bande annonce pour la section "À propos"
    const detailAboutVideo = document.querySelector(".detail-about-video");
    if(detailAboutVideo){
      const placeholder = detailAboutVideo.querySelector(".detail-about-video-placeholder");
      
      // Chercher une bande annonce dans les vidéos (plusieurs types acceptés)
      let trailerKey = null;
      
      // Combiner les vidéos des deux sources (avec et sans langue)
      const allVideos = [];
      if(videos && videos.results && videos.results.length > 0){
        allVideos.push(...videos.results);
      }
      if(videosAll && videosAll.results && videosAll.results.length > 0){
        // Ajouter les vidéos qui ne sont pas déjà présentes
        const existingKeys = new Set(allVideos.map(v => v.key));
        allVideos.push(...videosAll.results.filter(v => !existingKeys.has(v.key)));
      }
      
      if(allVideos.length > 0){
        console.log("Vidéos trouvées:", allVideos.length, "vidéos");
        
        // Types de vidéos acceptés, par ordre de priorité
        const videoTypes = ["Trailer", "Teaser", "Clip", "Featurette", "Behind the Scenes"];
        
        // Chercher dans l'ordre de priorité
        for(const videoType of videoTypes){
          // D'abord chercher en français
          let video = allVideos.find(v => 
            v.type === videoType && v.iso_639_1 === "fr" && v.site === "YouTube"
          );
          
          // Sinon en anglais
          if(!video){
            video = allVideos.find(v => 
              v.type === videoType && (v.iso_639_1 === "en" || !v.iso_639_1) && v.site === "YouTube"
            );
          }
          
          // Sinon n'importe quelle langue mais YouTube
          if(!video){
            video = allVideos.find(v => 
              v.type === videoType && v.site === "YouTube"
            );
          }
          
          if(video && video.key){
            trailerKey = video.key;
            console.log(`Bande annonce trouvée (${videoType}):`, trailerKey);
            break;
          }
        }
        
        if(!trailerKey){
          console.log("Aucune bande annonce YouTube trouvée");
        }
      } else {
        console.log("Aucune vidéo disponible");
      }
      
      if(placeholder){
        if(trailerKey && backdropPath){
          // Afficher la vidéo YouTube avec thumbnail cliquable
          placeholder.innerHTML = `
            <div class="video-thumbnail" style="width: 100%; height: 100%; position: relative; cursor: pointer; z-index: 1;">
              <img src="https://image.tmdb.org/t/p/w780${backdropPath}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
              <div class="video-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 2;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="color: rgba(255, 255, 255, 0.95); filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            <iframe class="youtube-trailer" 
              style="display: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; border: none; z-index: 10;" 
              src="" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
            </iframe>
          `;
          
          // Gérer le clic pour afficher la vidéo
          setTimeout(() => {
            const thumbnail = placeholder.querySelector('.video-thumbnail');
            const iframe = placeholder.querySelector('.youtube-trailer');
            
            if(thumbnail && iframe){
              thumbnail.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Clic sur la vidéo, chargement de:", trailerKey);
                thumbnail.style.display = 'none';
                iframe.style.display = 'block';
                iframe.src = `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`;
              });
            } else {
              console.error("Éléments vidéo non trouvés:", {thumbnail, iframe});
            }
          }, 100);
        } else if(backdropPath){
          // Fallback: afficher juste l'image si pas de bande annonce
          placeholder.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w780${backdropPath}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; color: rgba(255, 255, 255, 0.9); pointer-events: none;">
              <path d="M8 5v14l11-7z"/>
            </svg>
          `;
        }
      }
    }
    
    // Étoiles interactives
    const detailStarsInput = document.getElementById("detailStarsInput");
    if(detailStarsInput){
      detailStarsInput.innerHTML = generateStarsInput();
      // Réinitialiser le rating
      currentStarRating = 0;
      // Configurer l'interactivité après avoir ajouté les étoiles
      console.log('Setting up stars interaction...');
      setupStarsInteraction();
    } else {
      console.error('detailStarsInput element not found');
    }
    
    // Mettre à jour le titre de la page
    document.title = `${title} - STREAMFLIX`;
    
    // Charger les films de saga ou similaires
    await loadSimilarOrCollection(itemId, type, details);
    
  } catch(e){
    console.error("Erreur lors du chargement des détails:", e);
  }
}

/* ========================================
   CHARGEMENT DES FILMS DE SAGA OU SIMILAIRES
   ======================================== */
function createSimilarTile({imgUrl, posterUrl, title, year, isMovie, itemId}){
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.setAttribute("data-id", itemId);
  tile.setAttribute("data-type", isMovie ? "movie" : "tv");
  tile.style.cursor = "pointer";
  
  // Créer l'élément img avec gestionnaire d'erreur
  const img = document.createElement("img");
  img.src = imgUrl;
  img.alt = title;
  img.loading = "lazy";
  img.decoding = "async";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  
  // Gestionnaire d'erreur pour essayer d'autres sources
  img.onerror = function(){
    // Si l'image principale (backdrop) ne charge pas, essayer le poster
    if(posterUrl && this.src !== posterUrl){
      this.src = posterUrl;
    } else {
      // Si le poster ne fonctionne pas non plus, utiliser une image placeholder
      this.onerror = null; // Empêcher les boucles infinies
      this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Crect fill='%23151b2e' width='400' height='225'/%3E%3Ctext fill='%23666' font-family='Arial' font-size='18' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EAffiche indisponible%3C/text%3E%3C/svg%3E";
      this.style.opacity = "0.5";
    }
  };
  
  tile.innerHTML = `
    <span class="badge-type">${isMovie ? "Film" : "Série"}</span>
    <div class="info">
      <div class="title">${title}</div>
      <div class="meta">
        <span>${year || '—'}</span>
      </div>
    </div>
  `;
  
  // Insérer l'image avant le div.info
  const infoDiv = tile.querySelector('.info');
  tile.insertBefore(img, infoDiv);
  
  // Ajouter l'event listener pour ouvrir la page de détails
  tile.addEventListener("click", () => {
    window.location.href = `detail.html?id=${itemId}&type=${isMovie ? "movie" : "tv"}`;
  });
  
  return tile;
}

async function loadSimilarOrCollection(itemId, type, details){
  try {
    const similarRow = document.getElementById("similarMoviesRow");
    const similarTitle = document.getElementById("similarSectionTitle");
    
    if(!similarRow || !similarTitle) return;
    
    similarRow.innerHTML = "";
    
    const isMovie = type === "movie";
    let items = [];
    let sectionTitle = "Films de la saga";
    
    // Pour les films uniquement, vérifier si le film fait partie d'une collection/saga
    if(isMovie && details.belongs_to_collection && details.belongs_to_collection.id){
      try {
        const collectionData = await tmdb(`/collection/${details.belongs_to_collection.id}?language=fr-FR`);
        
        if(collectionData && collectionData.parts && collectionData.parts.length > 1){
          // Exclure le film actuel de la liste
          items = collectionData.parts
            .filter(part => part.id !== parseInt(itemId))
            .map(part => ({
              ...part,
              isMovie: true,
              title: part.title,
              release_date: part.release_date
            }));
          
          sectionTitle = collectionData.name || "Films de la saga";
        }
      } catch(e){
        console.error("Erreur lors du chargement de la collection:", e);
      }
    }
    
    // Afficher la section seulement s'il y a des résultats de saga
    if(items.length > 0){
      similarTitle.textContent = sectionTitle;
      
      // Trier par date de sortie (du plus récent au plus ancien)
      items.sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || 0);
        const dateB = new Date(b.release_date || b.first_air_date || 0);
        return dateB - dateA;
      });
      
      for(const item of items){
        if(!item.poster_path && !item.backdrop_path) continue;
        
        const title = item.title || item.name || "";
        const year = yearOf(item.release_date || item.first_air_date);
        // Prioriser backdrop_path pour les affiches en paysage
        const imagePath = item.backdrop_path || item.poster_path;
        const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
        
        // Créer une URL de fallback avec le poster
        const posterPath = item.poster_path || item.backdrop_path;
        const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
        
        similarRow.appendChild(createSimilarTile({
          imgUrl,
          posterUrl,
          title,
          year,
          isMovie: item.isMovie !== undefined ? item.isMovie : isMovie,
          itemId: item.id
        }));
      }
      
      // Ajouter les boutons de scroll si nécessaire
      const similarSection = similarRow.closest('.detail-similar-section');
      if(similarSection && !similarSection.querySelector('.scroll-btn')){
        const leftBtn = document.createElement('button');
        leftBtn.className = 'scroll-btn left';
        leftBtn.setAttribute('aria-label', 'Précédent');
        leftBtn.setAttribute('data-target', 'similarMoviesRow');
        leftBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        
        const rightBtn = document.createElement('button');
        rightBtn.className = 'scroll-btn right';
        rightBtn.setAttribute('aria-label', 'Suivant');
        rightBtn.setAttribute('data-target', 'similarMoviesRow');
        rightBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        
        similarSection.insertBefore(leftBtn, similarRow);
        similarSection.appendChild(rightBtn);
        
        // Initialiser les boutons de scroll
        setTimeout(() => {
          updateSimilarScrollButtons(similarRow);
        }, 100);
      }
    } else {
      // Cacher la section si pas de résultats
      similarRow.closest('.detail-similar-section').style.display = 'none';
    }
    
  } catch(e){
    console.error("Erreur lors du chargement des films de saga ou similaires:", e);
  }
}

function updateSimilarScrollButtons(row){
  if(!row) return;
  
  const containerId = row.id;
  const leftBtn = document.querySelector(`.scroll-btn.left[data-target="${containerId}"]`);
  const rightBtn = document.querySelector(`.scroll-btn.right[data-target="${containerId}"]`);
  
  if(!leftBtn || !rightBtn) return;
  
  const isAtStart = row.scrollLeft <= 5;
  const isAtEnd = row.scrollWidth - row.clientWidth <= row.scrollLeft + 5;
  
  leftBtn.classList.toggle('hidden', isAtStart);
  rightBtn.classList.toggle('hidden', isAtEnd);
  
  // Ajouter les event listeners pour le scroll
  row.addEventListener('scroll', () => {
    updateSimilarScrollButtons(row);
  });
  
  // Ajouter les event listeners pour les boutons
  leftBtn.addEventListener('click', () => {
    row.scrollBy({ left: -row.clientWidth * 0.9, behavior: 'smooth' });
  });
  
  rightBtn.addEventListener('click', () => {
    row.scrollBy({ left: row.clientWidth * 0.9, behavior: 'smooth' });
  });
}

/* ========================================
   RECHERCHE - Suggestions en temps réel
   ======================================== */
let searchSuggestionsTimeout = null;

function yearOf(date){
  return date ? new Date(date).getFullYear() : "—";
}

async function searchSuggestions(query){
  if(!query || query.trim().length < 2){
    hideSuggestions();
    return;
  }
  
  try {
    const searchData = await tmdb(`/search/multi?language=fr-FR&query=${encodeURIComponent(query.trim())}`);
    
    if(!searchData.results || searchData.results.length === 0){
      hideSuggestions();
      return;
    }
    
    // Filtrer les résultats (films et séries uniquement)
    let validResults = searchData.results
      .filter(item => 
        (item.media_type === "movie" || item.media_type === "tv") && 
        (item.poster_path || item.backdrop_path)
      );
    
    if(validResults.length === 0){
      hideSuggestions();
      return;
    }
    
    // Trier par popularité/notoriété pour mettre les plus connus en premier
    validResults.sort((a, b) => {
      // Score de popularité (principal facteur)
      const aPopularity = a.popularity || 0;
      const bPopularity = b.popularity || 0;
      
      // Score de vote (films/séries avec beaucoup de votes et bonne note)
      const aVote = (a.vote_average || 0) * (a.vote_count || 0);
      const bVote = (b.vote_average || 0) * (b.vote_count || 0);
      
      // Calculer un score combiné (popularité * 2 + vote score / 100)
      const aScore = aPopularity * 2 + (aVote / 100);
      const bScore = bPopularity * 2 + (bVote / 100);
      
      return bScore - aScore;
    });
    
    // Limiter à 5 résultats après le tri
    validResults = validResults.slice(0, 5);
    
    displaySuggestions(validResults);
  } catch(e){
    console.error("Erreur lors de la recherche de suggestions:", e);
    hideSuggestions();
  }
}

function displaySuggestions(results){
  const suggestionsContainer = document.getElementById("searchSuggestions");
  if(!suggestionsContainer) return;
  
  suggestionsContainer.innerHTML = "";
  
  results.forEach(item => {
    const isMovie = item.media_type === "movie";
    const title = isMovie ? (item.title || item.original_title) : (item.name || item.original_name);
    const imagePath = item.poster_path || item.backdrop_path;
    const imgUrl = imagePath ? `https://image.tmdb.org/t/p/w92${imagePath}` : '';
    const year = yearOf(item.release_date || item.first_air_date);
    
    const suggestionItem = document.createElement("div");
    suggestionItem.className = "search-suggestion-item";
    suggestionItem.innerHTML = `
      ${imgUrl ? `<img src="${imgUrl}" alt="${title}" loading="lazy">` : '<div class="suggestion-placeholder"></div>'}
      <div class="suggestion-info">
        <div class="suggestion-title">${title}</div>
        <div class="suggestion-meta">
          <span class="suggestion-type">${isMovie ? "Film" : "Série"}</span>
          ${year !== "—" ? `<span>•</span><span>${year}</span>` : ''}
        </div>
      </div>
    `;
    
    suggestionItem.addEventListener("click", () => {
      window.location.href = `detail.html?id=${item.id}&type=${isMovie ? "movie" : "tv"}`;
    });
    
    suggestionsContainer.appendChild(suggestionItem);
  });
  
  suggestionsContainer.style.display = "block";
}

function hideSuggestions(){
  const suggestionsContainer = document.getElementById("searchSuggestions");
  if(suggestionsContainer){
    suggestionsContainer.style.display = "none";
    suggestionsContainer.innerHTML = "";
  }
}

/* ========================================
   INITIALISATION
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadDetails();
  
  // Menu hamburger pour mobile
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  
  if(menuToggle && navLinks){
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });
    
    // Fermer le menu quand on clique sur un lien
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
    
    // Fermer le menu quand on clique en dehors
    document.addEventListener('click', (e) => {
      if(!menuToggle.contains(e.target) && !navLinks.contains(e.target)){
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });
  }
});

