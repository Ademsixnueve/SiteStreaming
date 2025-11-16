/* ========================================
   CONFIGURATION
   ======================================== */
const API_KEY = "a9d7c117e25b766c166815d45301a888";
const SLIDE_DELAY = 5000;

// Films à afficher dans le hero (modifiez cette liste pour changer les films)
const HERO_TITLES = [
  "Avengers: Infinity War",
  "Fight Club",
  "F1",
  "Terrifier 3",
  "The Dark Knight"
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
    year
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

    const hero = document.querySelector(".hero");
    if (!hero) throw new Error("Conteneur .hero introuvable");

    let currentIndex = 0;

    async function showSlide(idx){
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
    }

    // Afficher le premier slide
    await showSlide(currentIndex);
    
    // Changer de slide automatiquement
    setInterval(() => {
      currentIndex = (currentIndex + 1) % items.length;
      showSlide(currentIndex);
    }, SLIDE_DELAY);
    
  } catch (e) {
    console.error("Erreur lors de l'initialisation du hero:", e);
  }
}

/* ========================================
   TUILES DE FILMS/SÉRIES
   ======================================== */
function createTile({imgUrl, title, year, isMovie, runtimeText, typeLabel, adult = false, itemId}){
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.setAttribute("data-id", itemId);
  tile.setAttribute("data-type", isMovie ? "movie" : "tv");
  tile.style.cursor = "pointer";
  tile.innerHTML = `
    <span class="badge-type">${typeLabel}</span>
    ${adult ? '<span class="badge-adult">18+</span>' : ''}
    <img src="${imgUrl}" alt="${title}" loading="lazy" decoding="async">
    <div class="info">
      <div class="title">${title}</div>
      <div class="meta">
        <span>${runtimeText}</span>
        <span>•</span>
        <span>${year || '—'}</span>
      </div>
    </div>
  `;
  
  // Ajouter l'event listener pour ouvrir la page de détails
  tile.addEventListener("click", () => {
    window.location.href = `detail.html?id=${itemId}&type=${isMovie ? "movie" : "tv"}`;
  });
  
  return tile;
}

/* ========================================
   CHARGEMENT DES FILMS/SÉRIES POPULAIRES
   ======================================== */
async function loadPopular(type, containerId){
  try {
    const data = await tmdb(`/${type}/popular?language=fr-FR&page=1`);
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return;
    }
    
    container.innerHTML = "";

    for(const item of data.results){
      const backdrop = item.backdrop_path || item.poster_path;
      if(!backdrop) continue;

      const isMovie = type === "movie";
      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w780${backdrop}`;

      let runtimeText = "⏱ —";
      
      try{
        const details = await tmdb(`/${isMovie ? "movie" : "tv"}/${item.id}?language=fr-FR`);
        
        if(isMovie && details.runtime){
          runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
        } else if(!isMovie){
          const seasons = details.number_of_seasons ?? "?";
          const episodes = details.number_of_episodes ?? "?";
          runtimeText = `${seasons} saison${seasons > 1 ? "s" : ""} • ${episodes} ép.`;
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
        title,
        year,
        isMovie,
        runtimeText,
        typeLabel: isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      }));
    }
  } catch(e){
    console.error(`Erreur lors du chargement des ${type} populaires:`, e);
  }
}

/* ========================================
   CHARGEMENT DES FILMS ET SÉRIES D'HORREUR
   ======================================== */
async function loadHorror(containerId){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return;
    }
    
    container.innerHTML = "";

    // Charger films et séries en parallèle - Prendre plusieurs pages
    const [moviesData1, moviesData2, seriesData1, seriesData2] = await Promise.all([
      tmdb(`/discover/movie?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=1`),
      tmdb(`/discover/movie?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=2`),
      tmdb(`/discover/tv?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=1`),
      tmdb(`/discover/tv?with_genres=27&language=fr-FR&sort_by=popularity.desc&page=2`)
    ]);

    // Préparer les listes - Prendre plus d'éléments (20 films + 20 séries)
    const movies = [
      ...moviesData1.results.map(item => ({...item, isMovie: true})),
      ...moviesData2.results.map(item => ({...item, isMovie: true}))
    ].slice(0, 20);
    
    const series = [
      ...seriesData1.results.map(item => ({...item, isMovie: false})),
      ...seriesData2.results.map(item => ({...item, isMovie: false}))
    ].slice(0, 20);
    
    // Mélanger en alternant films et séries
    const allItems = [];
    const maxLength = Math.max(movies.length, series.length);
    
    for(let i = 0; i < maxLength; i++){
      if(i < movies.length) allItems.push(movies[i]);
      if(i < series.length) allItems.push(series[i]);
    }
    
    // Mélanger aléatoirement pour plus de variété
    for(let i = allItems.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    for(const item of allItems.slice(0, 40)){
      const backdrop = item.backdrop_path || item.poster_path;
      if(!backdrop) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w780${backdrop}`;

      let runtimeText = "⏱ —";
      
      try{
        if(item.isMovie){
          const details = await tmdb(`/movie/${item.id}?language=fr-FR`);
          if(details.runtime){
            runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
          }
        } else {
          const details = await tmdb(`/tv/${item.id}?language=fr-FR`);
          if(details.episode_run_time && details.episode_run_time.length > 0){
            runtimeText = `⏱ ${details.episode_run_time[0]}min`;
          }
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
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
    console.error("Erreur lors du chargement des films et séries d'horreur:", e);
  }
}

/* ========================================
   CHARGEMENT DES FILMS ET SÉRIES ROMANTIQUES
   ======================================== */
async function loadRomance(containerId){
  try {
    const container = $(containerId);
    
    if(!container){
      console.warn(`Container #${containerId} introuvable`);
      return;
    }
    
    container.innerHTML = "";

    // Charger films et séries en parallèle
    const [moviesData, seriesData] = await Promise.all([
      tmdb(`/discover/movie?with_genres=10749&language=fr-FR&sort_by=popularity.desc&page=1`),
      tmdb(`/discover/tv?with_genres=10749&language=fr-FR&sort_by=popularity.desc&page=1`)
    ]);

    // Préparer les listes
    const movies = moviesData.results.map(item => ({...item, isMovie: true})).slice(0, 10);
    const series = seriesData.results.map(item => ({...item, isMovie: false})).slice(0, 10);
    
    // Mélanger en alternant films et séries
    const allItems = [];
    const maxLength = Math.max(movies.length, series.length);
    
    for(let i = 0; i < maxLength; i++){
      if(i < movies.length) allItems.push(movies[i]);
      if(i < series.length) allItems.push(series[i]);
    }
    
    // Mélanger aléatoirement pour plus de variété
    for(let i = allItems.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    for(const item of allItems.slice(0, 20)){
      const backdrop = item.backdrop_path || item.poster_path;
      if(!backdrop) continue;

      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      const imgUrl = `https://image.tmdb.org/t/p/w780${backdrop}`;

      let runtimeText = "⏱ —";
      
      try{
        if(item.isMovie){
          const details = await tmdb(`/movie/${item.id}?language=fr-FR`);
          if(details.runtime){
            runtimeText = `⏱ ${Math.floor(details.runtime/60)}h ${details.runtime%60}min`;
          }
        } else {
          const details = await tmdb(`/tv/${item.id}?language=fr-FR`);
          if(details.episode_run_time && details.episode_run_time.length > 0){
            runtimeText = `⏱ ${details.episode_run_time[0]}min`;
          }
        }
      } catch(e){
        // Ignore les erreurs
      }

      container.appendChild(createTile({
        imgUrl,
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
    console.error("Erreur lors du chargement des films et séries romantiques:", e);
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
  
  const isAtStart = row.scrollLeft <= 10;
  const isAtEnd = row.scrollLeft >= row.scrollWidth - row.clientWidth - 10;
  
  // La flèche de gauche n'apparaît que si on a déjà scrollé vers la droite au moins une fois
  if(isAtStart || !hasScrolledRight[containerId]){
    leftBtn.classList.add('hidden');
  } else {
    leftBtn.classList.remove('hidden');
  }
  
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
  
  // Si on clique sur la flèche de droite, marquer cette section comme ayant scrollé
  if(direction === 1){
    hasScrolledRight[btn.dataset.target] = true;
  }
  
  row.scrollBy({
    left: direction * Math.round(row.clientWidth * 0.9),
    behavior: 'smooth'
  });
  
  // Mettre à jour les boutons après le scroll
  setTimeout(() => {
    updateScrollButtons(row, btn.dataset.target);
  }, 100);
});

// Initialiser les boutons au chargement et lors du scroll
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.row').forEach(row => {
    const containerId = row.id;
    if(containerId){
      updateScrollButtons(row, containerId);
      
      row.addEventListener('scroll', () => {
        updateScrollButtons(row, containerId);
      });
    }
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
   INITIALISATION
   ======================================== */
(async () => {
  // Initialiser le hero
  await initHero();
  
  // Charger les sections
  await Promise.all([
    loadPopular("movie", "popularMovies"),
    loadPopular("tv", "popularSeries"),
    loadHorror("horrorMovies"),
    loadRomance("romanceMovies")
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
})();
