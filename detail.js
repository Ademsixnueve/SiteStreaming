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
  const fullStars = Math.floor(rating / 2);
  const starsHTML = Array(maxStars).fill(0).map((_, i) => {
    if(i < fullStars){
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="#ffd700" stroke="#ffd700" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    } else {
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
    
    // Charger les détails
    const [details, credits] = await Promise.all([
      tmdb(`/${type}/${itemId}?language=fr-FR`),
      tmdb(`/${type}/${itemId}/credits?language=fr-FR`)
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
        detailPoster.src = `https://image.tmdb.org/t/p/w500${posterPath}`;
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
    
    // Créateur (pour les séries)
    const detailCreator = document.getElementById("detailCreator");
    if(detailCreator){
      if(!isMovie && details.created_by && details.created_by.length > 0){
        detailCreator.textContent = details.created_by.map(c => c.name).join(", ");
      } else {
        detailCreator.textContent = "—";
      }
    }
    
    // Distribution
    const detailCast = document.getElementById("detailCast");
    if(detailCast && credits && credits.cast){
      const castNames = credits.cast.slice(0, 10).map(actor => actor.name).join(", ");
      detailCast.textContent = castNames || "—";
    }
    
    // Image en paysage pour la section "À propos"
    const detailAboutVideo = document.querySelector(".detail-about-video");
    if(detailAboutVideo){
      const placeholder = detailAboutVideo.querySelector(".detail-about-video-placeholder");
      if(placeholder && backdropPath){
        placeholder.innerHTML = `
          <img src="https://image.tmdb.org/t/p/w780${backdropPath}" alt="${title}">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; color: rgba(255, 255, 255, 0.9);">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
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
    
  } catch(e){
    console.error("Erreur lors du chargement des détails:", e);
  }
}

/* ========================================
   INITIALISATION
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadDetails();
});

