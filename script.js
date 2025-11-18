/* ========================================
   CONFIGURATION
   ======================================== */
const API_KEY = "a9d7c117e25b766c166815d45301a888";
const SLIDE_DELAY = 3000;

// Films à afficher dans le hero (modifiez cette liste pour changer les films)
const HERO_TITLES = [
  "Breaking Bad",
  "Fight Club",
  "F1",
  "Snowfall",
  "Oppenheimer"
];

/* ========================================
   ÉLÉMENTS DOM
   ======================================== */
const $ = id => document.getElementById(id);

const titleEl = $("title");
const genreEl = $("genre");
const descEl = $("desc");
const ratingEl = $("rating");
const runtimeEl = $("runtime");
const yearEl = $("year");
const heroBg = $("heroBackground");

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

function yearOf(date){
  return date ? new Date(date).getFullYear() : "—";
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
   HERO SECTION - Gestion du carousel
   ======================================== */
let heroItems = [];
let currentHeroIndex = 0;

async function fetchItemData(title){
  await ensureGenreMaps();
  const data = await tmdb(`/search/multi?language=fr-FR&query=${encodeURIComponent(title)}`);
  
  if(!data.results?.length) return null;

  const pick = data.results.find(x =>
    (x.media_type === "movie" || x.media_type === "tv") && (x.backdrop_path || x.poster_path)
  );
  
  if(!pick) return null;

  const isMovie = pick.media_type === "movie";
  const name = isMovie ? (pick.title || pick.original_title) : (pick.name || pick.original_name);
  const imgPath = pick.backdrop_path || pick.poster_path;

  const gmap = isMovie ? movieGenreMap : tvGenreMap;
  const genres = (pick.genre_ids || [])
    .map(id => gmap.get(id))
    .filter(Boolean)
    .join(" • ") || (isMovie ? "Film" : "Série");

  let runtime = "⏱ —";
  let year = "📅 —";
  
  try{
    const details = await tmdb(`/${isMovie ? "movie" : "tv"}/${pick.id}?language=fr-FR`);
    
    if(isMovie && details.runtime){
      runtime = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
      if(details.release_date){
        year = `📅 ${new Date(details.release_date).getFullYear()}`;
      }
    } else if(!isMovie){
      runtime = `⏱ ${details.number_of_seasons} saisons • ${details.number_of_episodes} épisodes`;
      if(details.first_air_date){
        year = `📅 ${new Date(details.first_air_date).getFullYear()}`;
      }
    }
  } catch(e){
    // Ignore les erreurs de détails
  }

  return {
    img: `https://image.tmdb.org/t/p/original${imgPath}`,
    title: name,
    genre: genres,
    desc: pick.overview || "Aucune description disponible.",
    rating: pick.vote_average ? `⭐ ${pick.vote_average.toFixed(1)}/10` : "⭐ N/A",
    runtime,
    year,
    itemId: pick.id,
    isMovie
  };
}

function updateSlide(slideData){
  // Précharger l'image pour éviter les reflows
  const img = new Image();
  img.onload = () => {
    heroBg.style.backgroundImage = `url('${slideData.img}')`;
  };
  img.src = slideData.img;
  
  // Mettre à jour le texte sans causer de reflow
  titleEl.textContent = slideData.title;
  genreEl.textContent = slideData.genre;
  descEl.textContent = slideData.desc;
  ratingEl.textContent = slideData.rating;
  runtimeEl.textContent = slideData.runtime;
  yearEl.textContent = slideData.year;
}

async function initHero(){
  try {
    const items = (await Promise.all(HERO_TITLES.map(t => fetchItemData(t)))).filter(Boolean);
    
    if(items.length === 0){
      console.warn("Aucun film trouvé pour le hero");
      return;
    }

    // Stocker les items globalement pour le bouton CTA
    heroItems = items;

    const hero = document.querySelector(".hero");
    if (!hero) throw new Error("Conteneur .hero introuvable");
    
    const progressBar = document.getElementById("heroProgress");
    const progressSegments = progressBar ? progressBar.querySelectorAll('.progress-segment') : [];
    
    if (!progressBar || progressSegments.length === 0) {
      console.warn("Barre de progression hero introuvable");
    }

    let currentIndex = 0;
    currentHeroIndex = 0;
    let progressInterval = null;
    let slideStartTime = Date.now();
    let autoSlideInterval = null;

    function updateHeroProgress(){
      if(progressSegments.length === 0) return;
      
      const elapsed = Date.now() - slideStartTime;
      const progress = Math.min(100, (elapsed / SLIDE_DELAY) * 100);
      
      // Chaque segment représente une affiche
      // Le segment actif correspond à l'affiche actuelle
      const currentSegmentIndex = currentIndex % progressSegments.length;
      
      // Mettre à jour tous les segments
      progressSegments.forEach((segment, index) => {
        if(index === currentIndex){
          // Le segment actif se remplit progressivement et est plus long (rouge)
          segment.classList.add('active');
          segment.style.setProperty('--progress', `${progress}%`);
        } else {
          // Tous les autres segments redeviennent gris (vides)
          segment.classList.remove('active');
          segment.classList.remove('filled');
          segment.style.setProperty('--progress', '0%');
        }
      });
    }

    async function showSlide(idx){
      // S'assurer que l'index est valide
      if(idx < 0 || idx >= items.length) return;
      
      // Arrêter tous les timers pour repartir de zéro
      if(progressInterval){
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if(autoSlideInterval){
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
      
      currentIndex = idx;
      currentHeroIndex = idx;
      
      // Réinitialiser tous les segments à 0%
      progressSegments.forEach((segment) => {
        segment.classList.remove('active');
        segment.classList.remove('filled');
        segment.style.setProperty('--progress', '0%');
      });
      
      // Réinitialiser le temps de départ pour la nouvelle barre de progression
      slideStartTime = Date.now();
      
      // Sauvegarder la position de scroll actuelle
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      
      // Fade out
      hero.classList.add("is-hidden");
      
      // Attendre la fin du fade out
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mettre à jour le contenu
      updateSlide(items[idx]);
      
      // Restaurer immédiatement la position de scroll
      window.scrollTo({
        top: scrollY,
        left: scrollX,
        behavior: 'auto'
      });
      
      // Fade in
      requestAnimationFrame(() => {
        hero.classList.remove("is-hidden");
        
        // Vérifier et restaurer la position après le render
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || window.pageYOffset;
          if(Math.abs(currentScrollY - scrollY) > 5){
            window.scrollTo({
              top: scrollY,
              left: scrollX,
              behavior: 'auto'
            });
          }
        });
      });
      
      // Mettre à jour la barre de progression toutes les 16ms (60fps) pour une transition ultra fluide
      progressInterval = setInterval(updateHeroProgress, 16);
      
      // Redémarrer le timer de changement automatique avec un nouveau cycle
      autoSlideInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % items.length;
        showSlide(currentIndex);
      }, SLIDE_DELAY);
    }

    // Rendre les segments cliquables pour naviguer vers un slide spécifique
    if(progressBar && progressSegments.length > 0){
      progressSegments.forEach((segment, segmentIndex) => {
        // Rendre le segment cliquable
        segment.style.cursor = 'pointer';
        
        segment.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Calculer l'index du slide à afficher
          // Si on a plus de segments que d'items, on limite à items.length
          // Sinon on utilise directement l'index du segment
          const targetIndex = Math.min(segmentIndex, items.length - 1);
          
          // Changer vers le slide sélectionné
          showSlide(targetIndex);
        });
      });
    }

    // Afficher le premier slide (le timer automatique sera lancé par showSlide)
    await showSlide(currentIndex);
    
  } catch (e) {
    console.error("Erreur lors de l'initialisation du hero:", e);
  }
}

/* ========================================
   TUILES DE FILMS/SÉRIES
   ======================================== */
function createTile({imgUrl, title, year, isMovie, runtimeText, typeLabel, adult = false, itemId, posterUrl = null}){
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
    <span class="badge-type">${typeLabel}</span>
    ${adult ? '<span class="badge-adult">18+</span>' : ''}
    <div class="info">
      <div class="title">${title}</div>
      <div class="meta">
        <span>${runtimeText}</span>
        <span>•</span>
        <span>${year || '—'}</span>
      </div>
    </div>
  `;
  
  // Insérer l'image avant le div.info
  const infoDiv = tile.querySelector('.info');
  tile.insertBefore(img, infoDiv);
  
  // Ajouter l'event listener pour ouvrir la page de détails
  tile.addEventListener("click", () => {
    window.location.href = `PageDetail/detail.html?id=${itemId}&type=${isMovie ? "movie" : "tv"}`;
  });
  
  return tile;
}

/* ========================================
   TUILES TOP 10 (Style Netflix)
   ======================================== */
function createTop10Tile({imgUrl, title, year, isMovie, runtimeText, typeLabel, adult = false, itemId, rank, posterUrl = null}){
  const tile = document.createElement("div");
  tile.className = "tile top10-tile";
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
    // Si l'image principale (poster) ne charge pas, utiliser une image placeholder
    this.onerror = null; // Empêcher les boucles infinies
    this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect fill='%23151b2e' width='300' height='450'/%3E%3Ctext fill='%23666' font-family='Arial' font-size='16' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EAffiche indisponible%3C/text%3E%3C/svg%3E";
    this.style.opacity = "0.5";
  };
  
  tile.innerHTML = `
    <span class="top10-rank" data-rank="${rank}">
      <span class="top10-rank-shadow">${rank}</span>
      <span class="top10-rank-text">${rank}</span>
    </span>
    ${adult ? '<span class="badge-adult">18+</span>' : ''}
    <div class="info">
      <div class="title">${title}</div>
      <div class="meta">
        <span>${runtimeText}</span>
        <span>•</span>
        <span>${year || '—'}</span>
      </div>
    </div>
  `;
  
  // Insérer l'image avant le div.info
  const infoDiv = tile.querySelector('.info');
  tile.insertBefore(img, infoDiv);
  
  // Ajouter l'event listener pour ouvrir la page de détails
  tile.addEventListener("click", () => {
    window.location.href = `PageDetail/detail.html?id=${itemId}&type=${isMovie ? "movie" : "tv"}`;
  });
  
  return tile;
}

/* ========================================
   CHARGEMENT DES FILMS/SÉRIES POPULAIRES
   ======================================== */
async function loadPopular(type, containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Charger les populaires et les dernières sorties (films/séries américains et européens)
    const isMovie = type === "movie";
    
    // Pays autorisés (US et Europe uniquement)
    const allowedCountries = ["US", "GB", "FR", "DE", "IT", "ES", "NL", "BE", "CH", "AT", "SE", "NO", "DK", "FI", "PL", "CZ", "IE", "PT", "GR", "LU", "IS", "EE", "LV", "LT", "SK", "SI", "HR", "HU", "RO", "BG"];
    
    // Pays asiatiques à exclure explicitement
    const asianCountries = ["CN", "JP", "KR", "IN", "TH", "VN", "PH", "ID", "MY", "SG", "TW", "HK", "BD", "PK", "LK", "MM", "KH", "LA", "MN", "NP"];
    
    const endpoints = isMovie 
      ? [
          // Films très populaires et connus
          `/${type}/popular?language=fr-FR&region=US&page=1`,
          `/${type}/popular?language=fr-FR&region=US&page=2`,
          `/${type}/top_rated?language=fr-FR&region=US&page=1`,
          // Films récemment sortis
          `/${type}/now_playing?language=fr-FR&region=US&page=1`,
          `/${type}/now_playing?language=fr-FR&region=US&page=2`,
          `/${type}/upcoming?language=fr-FR&region=US&page=1`,
          // Films populaires d'autres régions européennes
          `/${type}/popular?language=fr-FR&region=GB&page=1`,
          `/${type}/popular?language=fr-FR&region=FR&page=1`
        ]
      : [
          `/${type}/popular?language=fr-FR&page=1`,
          `/${type}/on_the_air?language=fr-FR&page=1`,
          `/${type}/popular?language=fr-FR&page=2`
        ];

    // Charger toutes les données
    const allData = await Promise.all(endpoints.map(endpoint => tmdb(endpoint).catch(e => ({ results: [] }))));
    
    // Combiner tous les résultats
    const allItems = [];
    const seenIds = new Set();
    
    for(const data of allData){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push(item);
        }
      }
    }

    // Pour les films, trier en privilégiant les films bien connus (classiques inclus)
    if(isMovie){
      // Filtrer les films de 2000 à 2025
      const minYear = 2000;
      const maxYear = 2025;
      const filteredByYear = allItems.filter(item => {
        const date = new Date(item.release_date || 0);
        const year = date.getFullYear();
        return year >= minYear && year <= maxYear;
      });
      
      // Films classiques très connus à privilégier
      const classicKeywords = ['oppenheimer', 'dune', 'spiderman', 'spider-man', 'dark knight', 'inception', 'matrix', 'avengers', 'iron man', 'captain america', 'thor', 'guardians', 'deadpool', 'wolverine', 'x-men'];
      
      filteredByYear.sort((a, b) => {
        // Score de popularité (priorité principale)
        const aPopularity = a.popularity || 0;
        const bPopularity = b.popularity || 0;
        
        // Score de vote (films bien notés avec beaucoup de votes)
        const aVote = (a.vote_average || 0) * (a.vote_count || 0);
        const bVote = (b.vote_average || 0) * (b.vote_count || 0);
        
        // Vérifier les dates
        const aDate = new Date(a.release_date || 0);
        const bDate = new Date(b.release_date || 0);
        const aYear = aDate.getFullYear();
        const bYear = bDate.getFullYear();
        
        // Vérifier si c'est un classique
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        const aIsClassic = classicKeywords.some(keyword => aTitle.includes(keyword));
        const bIsClassic = classicKeywords.some(keyword => bTitle.includes(keyword));
        
        // Films de 2025 (pas de bonus)
        const aIs2025 = aYear === 2025;
        const bIs2025 = bYear === 2025;
        
        // Calculer un score combiné
        let aScore = aPopularity * 2 + aVote / 100;
        let bScore = bPopularity * 2 + bVote / 100;
        
        // Bonus important pour les classiques très connus
        if(aIsClassic && aPopularity > 100) aScore *= 1.3;
        if(bIsClassic && bPopularity > 100) bScore *= 1.3;
        
        // Bonus modéré pour les classiques
        if(aIsClassic && aPopularity > 50) aScore *= 1.15;
        if(bIsClassic && bPopularity > 50) bScore *= 1.15;
        
        // Pas de bonus pour 2025 (ils sont déjà inclus mais pas privilégiés)
        // Les films de 2025 gardent leur score normal
        
        return bScore - aScore;
      });
      
      // Remplacer allItems par la version filtrée
      allItems.length = 0;
      allItems.push(...filteredByYear);
    } else {
      // Pour les séries, trier par popularité
      allItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }

    // Filtrer strictement par pays de production (récupérer les détails pour tous)
    const filteredItems = [];
    
    for(const item of allItems){
      try{
        const details = await tmdb(`/${isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        // Récupérer tous les pays de production
        const productionCountries = details.production_countries || [];
        const originCountry = details.origin_country || [];
        const countries = [
          ...originCountry,
          ...productionCountries.map(c => c.iso_3166_1)
        ];
        
        // Vérifier qu'au moins un pays autorisé est présent
        const hasAllowedCountry = countries.some(country => allowedCountries.includes(country));
        
        // Vérifier qu'aucun pays asiatique n'est présent
        const hasAsianCountry = countries.some(country => asianCountries.includes(country));
        
        // Inclure seulement si : a un pays autorisé ET n'a pas de pays asiatique
        if(hasAllowedCountry && !hasAsianCountry && countries.length > 0){
          filteredItems.push({...item, details});
        }
      } catch(e){
        // Si erreur, ignorer cet élément
        continue;
      }
      
      // Limiter à 20 éléments
      if(filteredItems.length >= 20) break;
    }

    const items = filteredItems;

    for(const item of items){
      // Prioriser backdrop_path pour les affiches en paysage (format 16:9)
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      // Utiliser w1920 pour une meilleure qualité en paysage
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;

      // Utiliser les détails déjà récupérés
      const details = item.details || {};
      
      let runtimeText = "⏱ —";
      
      if(isMovie && details.runtime){
        runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
      } else if(!isMovie){
        const seasons = details.number_of_seasons ?? "?";
        const episodes = details.number_of_episodes ?? "?";
        runtimeText = `${seasons} saison${seasons > 1 ? "s" : ""} • ${episodes} ép.`;
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie,
        runtimeText,
        typeLabel: isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error(`Erreur lors du chargement des ${type} populaires:`, e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DU TOP 10 FRANCE (Films les plus regardés)
   ======================================== */
async function loadTop10France(excludedIds = new Set()){
  try {
    const container = document.getElementById("top10FranceRow");
    
    if(!container){
      console.warn("Container #top10FranceRow introuvable");
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();
    
    // Charger les films les plus regardés (comme Netflix)
    // Utiliser plusieurs sources pour avoir les VRAIS films populaires
    const [trendingWeek, trendingDay, popularData1, popularData2, popularData3, popularData4, nowPlaying1, nowPlaying2, topRated1, topRated2] = await Promise.all([
      tmdb(`/trending/movie/week?language=fr-FR`).catch(e => ({ results: [] })),
      tmdb(`/trending/movie/day?language=fr-FR`).catch(e => ({ results: [] })),
      tmdb(`/movie/popular?language=fr-FR&region=US&page=1`).catch(e => ({ results: [] })),
      tmdb(`/movie/popular?language=fr-FR&region=US&page=2`).catch(e => ({ results: [] })),
      tmdb(`/movie/popular?language=fr-FR&region=US&page=3`).catch(e => ({ results: [] })),
      tmdb(`/movie/popular?language=fr-FR&region=US&page=4`).catch(e => ({ results: [] })),
      tmdb(`/movie/now_playing?language=fr-FR&region=US&page=1`).catch(e => ({ results: [] })),
      tmdb(`/movie/now_playing?language=fr-FR&region=US&page=2`).catch(e => ({ results: [] })),
      tmdb(`/movie/top_rated?language=fr-FR&region=US&page=1`).catch(e => ({ results: [] })),
      tmdb(`/movie/top_rated?language=fr-FR&region=US&page=2`).catch(e => ({ results: [] }))
    ]);
    
    // Combiner tous les résultats
    const allMovies = [];
    const seenIds = new Set();
    
    for(const data of [trendingWeek, trendingDay, popularData1, popularData2, popularData3, popularData4, nowPlaying1, nowPlaying2, topRated1, topRated2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && item.poster_path){
          seenIds.add(item.id);
          allMovies.push(item);
        }
      }
    }
    
    // Filtrer pour garder uniquement les films vraiment populaires
    // Minimum 2000 votes ET popularité > 50 OU vote_average > 7.0
    // ET année >= 1999
    const popularMovies = allMovies.filter(item => {
      const voteCount = item.vote_count || 0;
      const popularity = item.popularity || 0;
      const voteAvg = item.vote_average || 0;
      
      // Vérifier l'année (minimum 1999)
      const releaseDate = item.release_date || "";
      const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;
      if(year < 1999) return false;
      
      // Films vraiment populaires : beaucoup de votes ET (bonne popularité OU bonne note)
      return voteCount >= 2000 && (popularity > 50 || voteAvg > 7.0);
    });
    
    // Trier par score combiné pour avoir les VRAIS films les plus regardés
    popularMovies.sort((a, b) => {
      // Score = (popularité * 3) + (vote_average * vote_count / 100) + (vote_count / 50)
      // Cela privilégie les films avec beaucoup de votes ET une bonne note
      const scoreA = (a.popularity || 0) * 3 + 
                     ((a.vote_average || 0) * (a.vote_count || 0) / 100) + 
                     ((a.vote_count || 0) / 50);
      const scoreB = (b.popularity || 0) * 3 + 
                     ((b.vote_average || 0) * (b.vote_count || 0) / 100) + 
                     ((b.vote_count || 0) / 50);
      return scoreB - scoreA;
    });
    
    // Prendre les 10 premiers films les plus regardés
    const top10Movies = popularMovies.slice(0, 10);
    
    console.log(`Top 10 Films les plus regardés: ${top10Movies.length} films trouvés`);
    
    for(let i = 0; i < top10Movies.length; i++){
      const item = top10Movies[i];
      
      // Utiliser poster_path pour les affiches en portrait
      const posterPath = item.poster_path;
      if(!posterPath) continue;
      
      const title = item.title || "";
      const year = yearOf(item.release_date);
      // Utiliser w500 pour les posters en portrait
      const imgUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/movie/${item.id}?language=fr-FR`);
        
        if(details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }
      
      container.appendChild(createTop10Tile({
        imgUrl,
        title,
        year,
        isMovie: true,
        runtimeText,
        typeLabel: "Film",
        adult: !!item.adult,
        itemId: item.id,
        rank: i + 1
      }));
      
      usedIds.add(item.id);
    }
    
    // Mettre à jour les boutons de scroll et positionner les flèches
    setTimeout(() => {
      updateScrollButtons(container, "top10FranceRow");
      positionTop10ScrollButtons();
    }, 100);
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement du Top 10 France:", e);
    return new Set();
  }
}

async function loadTop10Series(excludedIds = new Set()){
  try {
    const container = document.getElementById("top10SeriesRow");
    
    if(!container){
      console.warn("Container #top10SeriesRow introuvable");
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();
    
    // Charger les séries les plus regardées (comme Netflix)
    // Utiliser plusieurs sources pour avoir les VRAIES séries populaires
    const [trendingWeek, trendingDay, popularData1, popularData2, popularData3, popularData4, onTheAir1, onTheAir2, topRated1, topRated2] = await Promise.all([
      tmdb(`/trending/tv/week?language=fr-FR`).catch(e => ({ results: [] })),
      tmdb(`/trending/tv/day?language=fr-FR`).catch(e => ({ results: [] })),
      tmdb(`/tv/popular?language=fr-FR&page=1`).catch(e => ({ results: [] })),
      tmdb(`/tv/popular?language=fr-FR&page=2`).catch(e => ({ results: [] })),
      tmdb(`/tv/popular?language=fr-FR&page=3`).catch(e => ({ results: [] })),
      tmdb(`/tv/popular?language=fr-FR&page=4`).catch(e => ({ results: [] })),
      tmdb(`/tv/on_the_air?language=fr-FR&page=1`).catch(e => ({ results: [] })),
      tmdb(`/tv/on_the_air?language=fr-FR&page=2`).catch(e => ({ results: [] })),
      tmdb(`/tv/top_rated?language=fr-FR&page=1`).catch(e => ({ results: [] })),
      tmdb(`/tv/top_rated?language=fr-FR&page=2`).catch(e => ({ results: [] }))
    ]);
    
    // Combiner tous les résultats
    const allSeries = [];
    const seenIds = new Set();
    
    for(const data of [trendingWeek, trendingDay, popularData1, popularData2, popularData3, popularData4, onTheAir1, onTheAir2, topRated1, topRated2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && item.poster_path){
          seenIds.add(item.id);
          allSeries.push(item);
        }
      }
    }
    
    // Filtrer pour garder uniquement les séries vraiment populaires
    // Minimum 1000 votes ET popularité > 50 OU vote_average > 7.0
    // ET année >= 1999
    const popularSeries = allSeries.filter(item => {
      const voteCount = item.vote_count || 0;
      const popularity = item.popularity || 0;
      const voteAvg = item.vote_average || 0;
      
      // Vérifier l'année (minimum 1999)
      const releaseDate = item.first_air_date || "";
      const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;
      if(year < 1999) return false;
      
      // Séries vraiment populaires : beaucoup de votes ET (bonne popularité OU bonne note)
      return voteCount >= 1000 && (popularity > 50 || voteAvg > 7.0);
    });
    
    // Trier par score combiné pour avoir les VRAIES séries les plus regardées
    popularSeries.sort((a, b) => {
      // Score = (popularité * 3) + (vote_average * vote_count / 100) + (vote_count / 50)
      // Cela privilégie les séries avec beaucoup de votes ET une bonne note
      const scoreA = (a.popularity || 0) * 3 + 
                     ((a.vote_average || 0) * (a.vote_count || 0) / 100) + 
                     ((a.vote_count || 0) / 50);
      const scoreB = (b.popularity || 0) * 3 + 
                     ((b.vote_average || 0) * (b.vote_count || 0) / 100) + 
                     ((b.vote_count || 0) / 50);
      return scoreB - scoreA;
    });
    
    // Prendre les 10 premières séries les plus regardées
    const top10Series = popularSeries.slice(0, 10);
    
    console.log(`Top 10 Séries les plus regardées: ${top10Series.length} séries trouvées`);
    
    for(let i = 0; i < top10Series.length; i++){
      const item = top10Series[i];
      
      // Utiliser poster_path pour les affiches en portrait
      const posterPath = item.poster_path;
      if(!posterPath) continue;
      
      const title = item.name || "";
      const year = yearOf(item.first_air_date);
      // Utiliser w500 pour les posters en portrait
      const imgUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/tv/${item.id}?language=fr-FR`);
        
        if(details.number_of_seasons && details.number_of_episodes){
          runtimeText = `⏱ ${details.number_of_seasons} saisons • ${details.number_of_episodes} épisodes`;
        }
      } catch(e){
        // Ignore les erreurs
      }
      
      container.appendChild(createTop10Tile({
        imgUrl,
        title,
        year,
        isMovie: false,
        runtimeText,
        typeLabel: "Série",
        adult: !!item.adult,
        itemId: item.id,
        rank: i + 1
      }));
      
      usedIds.add(item.id);
    }
    
    // Mettre à jour les boutons de scroll et positionner les flèches
    setTimeout(() => {
      updateScrollButtons(container, "top10SeriesRow");
      positionTop10ScrollButtons();
    }, 100);
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement du Top 10 Séries:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES FILMS ET SÉRIES D'HORREUR
   ======================================== */
async function loadHorror(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Pays autorisés (US et Europe uniquement)
    const allowedCountries = ["US", "GB", "FR", "DE", "IT", "ES", "NL", "BE", "CH", "AT", "SE", "NO", "DK", "FI", "PL", "CZ", "IE", "PT", "GR", "LU", "IS", "EE", "LV", "LT", "SK", "SI", "HR", "HU", "RO", "BG"];
    const asianCountries = ["CN", "JP", "KR", "IN", "TH", "VN", "PH", "ID", "MY", "SG", "TW", "HK", "BD", "PK", "LK", "MM", "KH", "LA", "MN", "NP"];

    // Charger films et séries en parallèle - Prendre plusieurs pages
    const [moviesData1, moviesData2, seriesData1, seriesData2] = await Promise.all([
      tmdb(`/discover/movie?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] }))
    ]);

    // Préparer les listes
    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: true});
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Filtrer par année pour les films (2000-2025)
    const filteredByYear = allItems.filter(item => {
      if(item.isMovie){
        const date = new Date(item.release_date || 0);
        const year = date.getFullYear();
        return year >= 2000 && year <= 2025;
      }
      return true; // Garder toutes les séries
    });

    // Filtrer par pays de production
    const filteredItems = [];
    
    for(const item of filteredByYear){
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        const productionCountries = details.production_countries || [];
        const originCountry = details.origin_country || [];
        const countries = [
          ...originCountry,
          ...productionCountries.map(c => c.iso_3166_1)
        ];
        
        const hasAllowedCountry = countries.some(country => allowedCountries.includes(country));
        const hasAsianCountry = countries.some(country => asianCountries.includes(country));
        
        if(hasAllowedCountry && !hasAsianCountry && countries.length > 0){
          filteredItems.push({...item, details});
        }
      } catch(e){
        continue;
      }
      
      if(filteredItems.length >= 40) break;
    }

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 40)){
      // Prioriser backdrop_path pour les affiches en paysage (format 16:9)
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      // Utiliser w1920 pour une meilleure qualité en paysage
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;

      // Utiliser les détails déjà récupérés
      const details = item.details || {};
      
      let runtimeText = "⏱ —";
      
      if(item.isMovie && details.runtime){
        runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
      } else if(!item.isMovie){
        if(details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des films et séries d'horreur:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES FILMS ET SÉRIES ROMANTIQUES
   ======================================== */
async function loadRomance(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Pays autorisés (US et Europe uniquement)
    const allowedCountries = ["US", "GB", "FR", "DE", "IT", "ES", "NL", "BE", "CH", "AT", "SE", "NO", "DK", "FI", "PL", "CZ", "IE", "PT", "GR", "LU", "IS", "EE", "LV", "LT", "SK", "SI", "HR", "HU", "RO", "BG"];
    const asianCountries = ["CN", "JP", "KR", "IN", "TH", "VN", "PH", "ID", "MY", "SG", "TW", "HK", "BD", "PK", "LK", "MM", "KH", "LA", "MN", "NP"];

    // Charger films et séries en parallèle - Prendre plusieurs pages
    const [moviesData1, moviesData2, seriesData1, seriesData2] = await Promise.all([
      tmdb(`/discover/movie?with_genres=10749&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=10749&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10749&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10749&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] }))
    ]);

    // Préparer les listes
    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: true});
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Filtrer par année pour les films (2000-2025)
    const filteredByYear = allItems.filter(item => {
      if(item.isMovie){
        const date = new Date(item.release_date || 0);
        const year = date.getFullYear();
        return year >= 2000 && year <= 2025;
      }
      return true; // Garder toutes les séries
    });

    // Filtrer par pays de production
    const filteredItems = [];
    
    for(const item of filteredByYear){
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        const productionCountries = details.production_countries || [];
        const originCountry = details.origin_country || [];
        const countries = [
          ...originCountry,
          ...productionCountries.map(c => c.iso_3166_1)
        ];
        
        const hasAllowedCountry = countries.some(country => allowedCountries.includes(country));
        const hasAsianCountry = countries.some(country => asianCountries.includes(country));
        
        if(hasAllowedCountry && !hasAsianCountry && countries.length > 0){
          filteredItems.push({...item, details});
        }
      } catch(e){
        continue;
      }
      
      if(filteredItems.length >= 20) break;
    }

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 20)){
      // Prioriser backdrop_path pour les affiches en paysage (format 16:9)
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      // Utiliser w1920 pour une meilleure qualité en paysage
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;

      // Utiliser les détails déjà récupérés
      const details = item.details || {};
      
      let runtimeText = "⏱ —";
      
      if(item.isMovie && details.runtime){
        runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
      } else if(!item.isMovie){
        if(details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des films et séries romantiques:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES ANIMES
   ======================================== */
async function loadAnime(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Rechercher des animes populaires (genre animation + origine JP)
    // Chercher aussi directement des titres populaires
    const animeTitles = ["One Piece", "Naruto", "Dragon Ball", "Attack on Titan", "Demon Slayer", 
                         "Death Note", "Fullmetal Alchemist", "My Hero Academia", "Jujutsu Kaisen", 
                         "Spirited Away", "Your Name", "Studio Ghibli"];
    
    // Charger séries animées avec genre animation et origine JP
    const [seriesData1, seriesData2, seriesData3, seriesData4] = await Promise.all([
      tmdb(`/discover/tv?with_genres=16&with_origin_country=JP&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=16&with_origin_country=JP&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=16&with_origin_country=JP&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=16&with_origin_country=JP&language=fr-FR&sort_by=popularity.desc&page=4`).catch(e => ({ results: [] }))
    ]);

    // Chercher des titres spécifiques
    const searchPromises = animeTitles.slice(0, 6).map(title => 
      tmdb(`/search/tv?query=${encodeURIComponent(title)}&language=fr-FR`).catch(e => ({ results: [] }))
    );
    const searchResults = await Promise.all(searchPromises);

    const allItems = [];
    const seenIds = new Set();
    
    // Ajouter les résultats de discover
    for(const data of [seriesData1, seriesData2, seriesData3, seriesData4]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }
    
    // Ajouter les résultats de recherche
    for(const data of searchResults){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Trier par popularité
    allItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of allItems.slice(0, 40)){
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.name || "";
      const year = yearOf(item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/tv/${item.id}?language=fr-FR`);
        
        if(details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: false,
        runtimeText,
        typeLabel: "Anime",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des animes:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES FILMS D'ACTION & THRILLER
   ======================================== */
async function loadAction(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Charger films et séries (genre Action 28 et Thriller 53) - Plus de pages pour avoir plus de choix
    const [moviesData1, moviesData2, moviesData3, moviesData4, seriesData1, seriesData2, seriesData3] = await Promise.all([
      tmdb(`/discover/movie?with_genres=28,53&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=28,53&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=28,53&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=28,53&language=fr-FR&sort_by=popularity.desc&page=4`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10759,80&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10759,80&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10759,80&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] }))
    ]);

    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2, moviesData3, moviesData4]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: true});
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2, seriesData3]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Filtrer par année (2000-2025) et popularité minimale
    const filteredItems = allItems.filter(item => {
      const date = new Date(item.release_date || item.first_air_date || 0);
      const year = date.getFullYear();
      const isRecent = year >= 2000 && year <= 2025;
      const isPopular = (item.popularity || 0) >= 20 || (item.vote_count || 0) >= 100;
      return isRecent && isPopular;
    });

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 40)){
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        if(item.isMovie && details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        } else if(!item.isMovie && details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des films d'action et thriller:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES COMÉDIES
   ======================================== */
async function loadComedy(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Charger films et séries (genre Comédie 35) - Plus de pages pour avoir plus de choix
    const [moviesData1, moviesData2, moviesData3, moviesData4, seriesData1, seriesData2, seriesData3] = await Promise.all([
      tmdb(`/discover/movie?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=4`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=35&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] }))
    ]);

    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2, moviesData3, moviesData4]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: true});
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2, seriesData3]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Filtrer par année (2000-2025) et popularité minimale
    const filteredItems = allItems.filter(item => {
      const date = new Date(item.release_date || item.first_air_date || 0);
      const year = date.getFullYear();
      const isRecent = year >= 2000 && year <= 2025;
      const isPopular = (item.popularity || 0) >= 20 || (item.vote_count || 0) >= 100;
      return isRecent && isPopular;
    });

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 40)){
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        if(item.isMovie && details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        } else if(!item.isMovie && details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
    }
  } catch(e){
    console.error("Erreur lors du chargement des comédies:", e);
  }
}

/* ========================================
   CHARGEMENT DES FILMS DE SCIENCE-FICTION
   ======================================== */
async function loadSciFi(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Charger films et séries (genre Science-Fiction 878) - Plus de pages pour avoir plus de choix
    const [moviesData1, moviesData2, moviesData3, moviesData4, seriesData1, seriesData2, seriesData3] = await Promise.all([
      tmdb(`/discover/movie?with_genres=878&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=878&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=878&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=878&language=fr-FR&sort_by=popularity.desc&page=4`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10765&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10765&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=10765&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] }))
    ]);

    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2, moviesData3, moviesData4]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: true});
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2, seriesData3]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Filtrer par année (2000-2025) et popularité minimale
    const filteredItems = allItems.filter(item => {
      const date = new Date(item.release_date || item.first_air_date || 0);
      const year = date.getFullYear();
      const isRecent = year >= 2000 && year <= 2025;
      const isPopular = (item.popularity || 0) >= 20 || (item.vote_count || 0) >= 100;
      return isRecent && isPopular;
    });

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 40)){
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        if(item.isMovie && details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        } else if(!item.isMovie && details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des films de science-fiction:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES DOCUMENTAIRES
   ======================================== */
async function loadDocumentary(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Charger films et séries (genre Documentaire 99)
    const [moviesData1, moviesData2, seriesData1, seriesData2] = await Promise.all([
      tmdb(`/discover/movie?with_genres=99&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=99&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=99&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=99&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] }))
    ]);

    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: true});
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          seenIds.add(item.id);
          allItems.push({...item, isMovie: false});
        }
      }
    }

    // Filtrer par année (2000-2025)
    const filteredItems = allItems.filter(item => {
      const date = new Date(item.release_date || item.first_air_date || 0);
      const year = date.getFullYear();
      return year >= 2000 && year <= 2025;
    });

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 40)){
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        if(item.isMovie && details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        } else if(!item.isMovie && details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      
      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Documentaire" : "Documentaire",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des documentaires:", e);
    return new Set();
  }
}

/* ========================================
   CHARGEMENT DES FILMS D'ANIMATION
   ======================================== */
async function loadAnimation(containerId, excludedIds = new Set()){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return new Set();
    }
    
    container.innerHTML = "";
    
    const usedIds = new Set();

    // Charger films et séries (genre Animation 16) - Exclure les animes japonais (qui sont déjà dans la catégorie Anime)
    const [moviesData1, moviesData2, moviesData3, moviesData4, seriesData1, seriesData2, seriesData3] = await Promise.all([
      tmdb(`/discover/movie?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] })),
      tmdb(`/discover/movie?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=4`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=1`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=2`).catch(e => ({ results: [] })),
      tmdb(`/discover/tv?with_genres=16&language=fr-FR&sort_by=popularity.desc&page=3`).catch(e => ({ results: [] }))
    ]);

    const allItems = [];
    const seenIds = new Set();
    
    for(const data of [moviesData1, moviesData2, moviesData3, moviesData4]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          // Exclure les films d'animation japonais (pour éviter doublon avec Anime)
          const productionCountries = item.production_countries || [];
          const originCountry = item.origin_country || [];
          const countries = [...originCountry, ...productionCountries.map(c => c.iso_3166_1 || c)];
          if(!countries.includes('JP')){
            seenIds.add(item.id);
            allItems.push({...item, isMovie: true});
          }
        }
      }
    }
    
    for(const data of [seriesData1, seriesData2, seriesData3]){
      for(const item of data.results || []){
        if(!seenIds.has(item.id) && !excludedIds.has(item.id) && (item.poster_path || item.backdrop_path)){
          // Exclure les séries d'animation japonaises (pour éviter doublon avec Anime)
          const originCountry = item.origin_country || [];
          const productionCountries = item.production_countries || [];
          const countries = [...originCountry, ...productionCountries.map(c => c.iso_3166_1 || c)];
          if(!countries.includes('JP')){
            seenIds.add(item.id);
            allItems.push({...item, isMovie: false});
          }
        }
      }
    }

    // Filtrer par année (2000-2025) et popularité minimale
    const filteredItems = allItems.filter(item => {
      const date = new Date(item.release_date || item.first_air_date || 0);
      const year = date.getFullYear();
      const isRecent = year >= 2000 && year <= 2025;
      const isPopular = (item.popularity || 0) >= 15 || (item.vote_count || 0) >= 100;
      return isRecent && isPopular;
    });

    // Trier par popularité
    filteredItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    for(const item of filteredItems.slice(0, 40)){
      const imagePath = item.backdrop_path || item.poster_path;
      if(!imagePath) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w1920${imagePath}`;
      
      // Créer une URL de fallback avec le poster
      const posterPath = item.poster_path || item.backdrop_path;
      const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      
      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/${item.isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        if(item.isMovie && details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        } else if(!item.isMovie && details.episode_run_time && details.episode_run_time.length > 0){
          runtimeText = `⏱ ${details.episode_run_time[0]}min`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
        posterUrl,
        title,
        year,
        isMovie: item.isMovie,
        runtimeText,
        typeLabel: item.isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
      
      usedIds.add(item.id);
    }
    
    return usedIds;
  } catch(e){
    console.error("Erreur lors du chargement des films d'animation:", e);
    return new Set();
  }
}

/* ========================================
   POSITIONNEMENT DES FLÈCHES TOP 10
   ======================================== */
function positionTop10ScrollButtons(){
  // Gérer les flèches pour Top 10 Films
  const top10MoviesRow = document.getElementById("top10FranceRow");
  const top10MoviesSection = top10MoviesRow ? top10MoviesRow.closest(".top10-section") : null;
  
  if(top10MoviesRow && top10MoviesSection){
    const rowRect = top10MoviesRow.getBoundingClientRect();
    const sectionRect = top10MoviesSection.getBoundingClientRect();
    
    // Calculer le centre vertical de la row par rapport à la section
    const rowTop = rowRect.top - sectionRect.top;
    const rowCenter = rowTop + (rowRect.height / 2);
    
    // Ajuster légèrement vers le haut (monter un peu)
    const adjustedCenter = rowCenter - 15;
    
    // Positionner les flèches
    const leftBtn = top10MoviesSection.querySelector('.scroll-btn.left[data-target="top10FranceRow"]');
    const rightBtn = top10MoviesSection.querySelector('.scroll-btn.right[data-target="top10FranceRow"]');
    
    if(leftBtn){
      leftBtn.style.top = `${adjustedCenter}px`;
      leftBtn.style.transform = 'translateY(-50%)';
    }
    
    if(rightBtn){
      rightBtn.style.top = `${adjustedCenter}px`;
      rightBtn.style.transform = 'translateY(-50%)';
    }
  }
  
  // Gérer les flèches pour Top 10 Séries
  const top10SeriesRow = document.getElementById("top10SeriesRow");
  const top10SeriesSection = top10SeriesRow ? top10SeriesRow.closest(".top10-section") : null;
  
  if(top10SeriesRow && top10SeriesSection){
    const rowRect = top10SeriesRow.getBoundingClientRect();
    const sectionRect = top10SeriesSection.getBoundingClientRect();
    
    // Calculer le centre vertical de la row par rapport à la section
    const rowTop = rowRect.top - sectionRect.top;
    const rowCenter = rowTop + (rowRect.height / 2);
    
    // Ajuster légèrement vers le haut (monter un peu)
    const adjustedCenter = rowCenter - 15;
    
    // Positionner les flèches
    const leftBtn = top10SeriesSection.querySelector('.scroll-btn.left[data-target="top10SeriesRow"]');
    const rightBtn = top10SeriesSection.querySelector('.scroll-btn.right[data-target="top10SeriesRow"]');
    
    if(leftBtn){
      leftBtn.style.top = `${adjustedCenter}px`;
      leftBtn.style.transform = 'translateY(-50%)';
    }
    
    if(rightBtn){
      rightBtn.style.top = `${adjustedCenter}px`;
      rightBtn.style.transform = 'translateY(-50%)';
    }
  }
}

/* ========================================
   BOUTONS DE SCROLL
   ======================================== */
// Suivi des sections qui ont été scrollées vers la droite au moins une fois
const hasScrolledRight = {};

function updateScrollButtons(row, containerId){
  const leftBtn = document.querySelector(`.scroll-btn.left[data-target="${containerId}"]`);
  const rightBtn = document.querySelector(`.scroll-btn.right[data-target="${containerId}"]`);
  
  if(!row || !leftBtn || !rightBtn) return;
  
  const isAtStart = row.scrollLeft <= 5;
  const isAtEnd = row.scrollLeft >= row.scrollWidth - row.clientWidth - 5;
  
  // La flèche de gauche n'apparaît que si on a scrollé vers la droite
  if(isAtStart){
    leftBtn.classList.add('hidden');
  } else {
    leftBtn.classList.remove('hidden');
    hasScrolledRight[containerId] = true;
  }
  
  // La flèche de droite s'active dès qu'il y a un mouvement vers la droite
  if(isAtEnd){
    rightBtn.classList.add('hidden');
  } else {
    rightBtn.classList.remove('hidden');
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.scroll-btn');
  if(!btn || btn.classList.contains('hidden')) return;
  
  const row = $(btn.dataset.target);
  if(!row) return;
  
  const direction = btn.classList.contains('left') ? -1 : 1;
  
  row.scrollBy({
    left: direction * Math.round(row.clientWidth * 0.9),
    behavior: 'smooth'
  });
  
  // Mettre à jour les boutons après le scroll
  setTimeout(() => {
    updateScrollButtons(row, btn.dataset.target);
  }, 100);
});

// Effet de clic sur la barre de recherche
document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.querySelector('.search-bar');
  const searchInput = document.getElementById('searchInput');
  
  if(searchBar && searchInput){
    // Cliquer sur la barre focus l'input
    searchBar.addEventListener('click', (e) => {
      if(e.target !== searchInput){
        searchInput.focus();
      }
    });
  }
  
  // Initialiser les boutons au chargement et lors du scroll
  document.querySelectorAll('.row').forEach(row => {
    const containerId = row.id;
    if(containerId){
      updateScrollButtons(row, containerId);
      
      // Détecter même un petit mouvement vers la droite
      let lastScrollLeft = row.scrollLeft;
      row.addEventListener('scroll', () => {
        // Si on a scrollé vers la droite (même un peu), activer la flèche de gauche
        if(row.scrollLeft > lastScrollLeft && row.scrollLeft > 5){
          hasScrolledRight[containerId] = true;
        }
        lastScrollLeft = row.scrollLeft;
        updateScrollButtons(row, containerId);
      });
    }
  });
  
  // Positionner les flèches Top 10 après un délai pour s'assurer que tout est chargé
  setTimeout(() => {
    positionTop10ScrollButtons();
  }, 500);
  
  // Repositionner lors du redimensionnement
  window.addEventListener('resize', () => {
    positionTop10ScrollButtons();
  });
});

/* ========================================
   SCROLL HORIZONTAL À LA MOLETTE
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.row').forEach(row => {
    row.addEventListener('wheel', (e) => {
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        row.scrollBy({
          left: e.deltaY,
          behavior: 'auto'
        });
        e.preventDefault();
      }
    }, { passive: false });
  });
});

/* ========================================
   RECHERCHE - Suggestions en temps réel
   ======================================== */
let searchTimeout = null;
let currentSuggestions = [];

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
      // Cela privilégie les contenus populaires avec beaucoup de votes
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
  
  currentSuggestions = results;
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
      window.location.href = `PageDetail/detail.html?id=${item.id}&type=${isMovie ? "movie" : "tv"}`;
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
    currentSuggestions = [];
  }
}

/* ========================================
   RECHERCHE - Redirection vers page dédiée
   ======================================== */
function redirectToSearch(query){
  if(!query || query.trim().length < 2){
    return;
  }
  
  hideSuggestions();
  // Rediriger vers la page de recherche avec la requête en paramètre
  window.location.href = `PageRecherche/search.html?q=${encodeURIComponent(query.trim())}`;
}

/* ========================================
   INITIALISATION
   ======================================== */
(async () => {
  // Initialiser le hero
  await initHero();
  
  // Gérer le bouton "REGARDER MAINTENANT"
  const watchButton = document.querySelector('.hero .cta');
  if(watchButton){
    watchButton.addEventListener('click', () => {
      if(heroItems.length > 0 && currentHeroIndex < heroItems.length){
        const currentItem = heroItems[currentHeroIndex];
        if(currentItem && currentItem.itemId){
          window.location.href = `PageDetail/detail.html?id=${currentItem.itemId}&type=${currentItem.isMovie ? "movie" : "tv"}`;
        }
      }
    });
  }
  
  // Charger les sections en séquence pour éviter les doublons
  let excludedIds = new Set();
  
  // Charger les sections principales d'abord
  const usedIds1 = await loadPopular("movie", "popularMovies", excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds1]);
  
  const usedIds2 = await loadTop10France(excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds2]);
  
  const usedIds3 = await loadPopular("tv", "popularSeries", excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds3]);
  
  const usedIds4 = await loadTop10Series(excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds4]);
  
  const usedIds5 = await loadHorror("horrorMovies", excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds5]);
  
  const usedIds6 = await loadRomance("romanceMovies", excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds6]);
  
  const usedIds7 = await loadAnime("animeSeries", excludedIds);
  excludedIds = new Set([...excludedIds, ...usedIds7]);
  
  // Charger les autres catégories en parallèle après les principales
  await Promise.all([
    loadAction("actionMovies", excludedIds),
    loadComedy("comedyMovies", excludedIds),
    loadSciFi("scifiMovies", excludedIds),
    loadDocumentary("documentaryMovies", excludedIds),
    loadAnimation("animationMovies", excludedIds)
  ]);
  
  // Initialiser les boutons de scroll après le chargement
  setTimeout(() => {
    document.querySelectorAll('.row').forEach(row => {
      const containerId = row.id;
      if(containerId){
        updateScrollButtons(row, containerId);
      }
    });
  }, 500);
  
  // Gérer la recherche - Suggestions et redirection
  const searchForm = document.querySelector('.search-bar');
  const searchInput = document.getElementById('searchInput');
  
  if(searchForm && searchInput){
    // Recherche lors de la soumission du formulaire
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      if(query.length >= 2){
        redirectToSearch(query);
      }
    });
    
    // Recherche lors de la touche Entrée
    searchInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        const query = searchInput.value.trim();
        if(query.length >= 2){
          redirectToSearch(query);
        }
      } else if(e.key === 'Escape'){
        hideSuggestions();
        searchInput.blur();
      }
    });
    
    // Suggestions en temps réel avec debounce
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      // Annuler la recherche précédente
      if(searchTimeout){
        clearTimeout(searchTimeout);
      }
      
      if(query.length >= 2){
        // Attendre 300ms après la dernière frappe
        searchTimeout = setTimeout(() => {
          searchSuggestions(query);
        }, 300);
      } else {
        hideSuggestions();
      }
    });
    
    // Cacher les suggestions quand on clique ailleurs
    document.addEventListener('click', (e) => {
      const searchContainer = document.querySelector('.search-container');
      if(searchContainer && !searchContainer.contains(e.target)){
        hideSuggestions();
      }
    });
  }
})();
