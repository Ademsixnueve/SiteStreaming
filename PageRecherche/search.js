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
   CRÉATION DE TUILES
   ======================================== */
function createSearchTile({imgUrl, title, year, isMovie, runtimeText, typeLabel, adult = false, itemId}){
  const tile = document.createElement("div");
  tile.className = "search-tile";
  tile.style.cursor = "pointer";
  
  tile.innerHTML = `
    ${adult ? '<span class="tile-badge-adult">18+</span>' : ''}
    <span class="tile-badge">${typeLabel}</span>
    <img src="${imgUrl}" alt="${title}" loading="lazy" decoding="async">
    <div class="tile-overlay">
      <div class="tile-title">${title}</div>
      <div class="tile-meta">
        <span>${runtimeText}</span>
        ${year ? `<span>•</span><span>${year}</span>` : ''}
      </div>
    </div>
  `;
  
  // Ajouter l'event listener pour ouvrir la page de détails
  tile.addEventListener("click", () => {
    window.location.href = `../PageDetail/detail.html?id=${itemId}&type=${isMovie ? "movie" : "tv"}`;
  });
  
  return tile;
}

/* ========================================
   RECHERCHE
   ======================================== */
let currentSearchItem = null;

async function performSearch(query){
  if(!query || query.trim().length < 2){
    showStatus("Veuillez entrer au moins 2 caractères pour rechercher.", "error");
    return;
  }
  
  const searchQuery = query.trim();
  showStatus("Recherche en cours...", "loading");
  
  // Masquer les sections précédentes
  document.getElementById("searchResultsSection").style.display = "none";
  document.getElementById("similarResultsSection").style.display = "none";
  
  try {
    await ensureGenreMaps();
    
    // Rechercher dans l'API TMDB
    const searchData = await tmdb(`/search/multi?language=fr-FR&query=${encodeURIComponent(searchQuery)}`);
    
    const searchResultsGrid = document.getElementById("searchResultsGrid");
    const searchResultsTitle = document.getElementById("searchResultsTitle");
    const searchResultsSection = document.getElementById("searchResultsSection");
    const searchPageTitle = document.getElementById("searchPageTitle");
    const searchSubtitle = document.getElementById("searchSubtitle");
    
    if(!searchResultsGrid || !searchResultsSection) return;
    
    // Mettre à jour les titres
    searchPageTitle.textContent = `Recherche :  "${searchQuery}"`;
    const totalResults = searchData.total_results || 0;
    if(totalResults > 0){
      searchSubtitle.textContent = `${totalResults} ${totalResults > 1 ? 'contenus disponibles' : 'contenu disponible'}`;
    } else {
      searchSubtitle.textContent = "Aucun contenu trouvé";
    }
    
    if(!searchData.results || searchData.results.length === 0){
      showStatus(`Aucun résultat trouvé pour "${searchQuery}".`, "error");
      return;
    }
    
    // Filtrer et afficher les résultats (films et séries uniquement)
    const validResults = searchData.results.filter(item => 
      (item.media_type === "movie" || item.media_type === "tv") && 
      (item.poster_path || item.backdrop_path)
    ).slice(0, 20);
    
    if(validResults.length === 0){
      showStatus(`Aucun résultat trouvé pour "${searchQuery}".`, "error");
      return;
    }
    
    // Afficher la section de résultats
    searchResultsSection.style.display = "block";
    searchResultsTitle.textContent = `Résultats pour "${searchQuery}" (${validResults.length})`;
    searchResultsGrid.innerHTML = "";
    hideStatus();
    
    // Afficher les résultats
    for(const item of validResults){
      // Prioriser le poster pour de meilleures affiches
      const imagePath = item.poster_path || item.backdrop_path;
      if(!imagePath) continue;
      
      const isMovie = item.media_type === "movie";
      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      // Utiliser w780 pour une meilleure qualité dans la grille
      const imgUrl = `https://image.tmdb.org/t/p/w780${imagePath}`;
      
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
      
      const tile = createSearchTile({
        imgUrl,
        title,
        year,
        isMovie,
        runtimeText,
        typeLabel: isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      });
      
      searchResultsGrid.appendChild(tile);
      
      // Stocker le premier résultat pour les titres similaires
      if(!currentSearchItem && item.id){
        currentSearchItem = {
          id: item.id,
          type: isMovie ? "movie" : "tv"
        };
      }
    }
    
    // Charger les titres similaires pour le premier résultat
    if(currentSearchItem){
      await loadSimilarTitles(currentSearchItem.id, currentSearchItem.type);
    }
    
  } catch(e){
    console.error("Erreur lors de la recherche:", e);
    showStatus("Erreur lors de la recherche. Veuillez réessayer.", "error");
  }
}

async function loadSimilarTitles(itemId, type){
  try {
    // Récupérer les détails du film/série pour obtenir les genres
    const details = await tmdb(`/${type}/${itemId}?language=fr-FR`);
    
    // Utiliser les recommandations (meilleur que similar) et filtrer par genres
    const [recommendationsData, similarData] = await Promise.all([
      tmdb(`/${type}/${itemId}/recommendations?language=fr-FR&page=1`),
      tmdb(`/${type}/${itemId}/similar?language=fr-FR&page=1`)
    ]);
    
    const similarGrid = document.getElementById("similarResultsGrid");
    const similarSection = document.getElementById("similarResultsSection");
    
    if(!similarGrid || !similarSection) return;
    
    // Combiner les recommandations et les similaires, en priorisant les recommandations
    let allSimilar = [];
    if(recommendationsData.results && recommendationsData.results.length > 0){
      allSimilar = [...recommendationsData.results];
    }
    if(similarData.results && similarData.results.length > 0){
      // Ajouter les similaires qui ne sont pas déjà dans les recommandations
      const existingIds = new Set(allSimilar.map(item => item.id));
      allSimilar = [...allSimilar, ...similarData.results.filter(item => !existingIds.has(item.id))];
    }
    
    if(allSimilar.length === 0){
      // Si pas de recommandations/similaires, chercher par genres
      if(details.genres && details.genres.length > 0){
        const genreIds = details.genres.map(g => g.id).join(',');
        const discoverData = await tmdb(`/discover/${type}?with_genres=${genreIds}&language=fr-FR&sort_by=popularity.desc&page=1`);
        if(discoverData.results && discoverData.results.length > 0){
          // Exclure le film/série actuel
          allSimilar = discoverData.results.filter(item => item.id !== itemId);
        }
      }
    }
    
    if(allSimilar.length === 0){
      similarSection.style.display = "none";
      return;
    }
    
    // Filtrer pour s'assurer que c'est du même type et qu'il y a une image
    let similarItems = allSimilar
      .filter(item => (item.poster_path || item.backdrop_path))
      .slice(0, 30); // Prendre plus pour mieux filtrer
    
    // Trier par similarité de genres si on a les genres du film original
    if(details.genres && details.genres.length > 0){
      const originalGenreIds = new Set(details.genres.map(g => g.id));
      similarItems = similarItems.sort((a, b) => {
        const aGenres = new Set(a.genre_ids || []);
        const bGenres = new Set(b.genre_ids || []);
        
        // Compter les genres en commun
        let aMatch = 0, bMatch = 0;
        originalGenreIds.forEach(id => {
          if(aGenres.has(id)) aMatch++;
          if(bGenres.has(id)) bMatch++;
        });
        
        // Prioriser ceux qui ont plus de genres en commun
        if(bMatch !== aMatch) return bMatch - aMatch;
        
        // Ensuite par popularité
        return (b.vote_average || 0) - (a.vote_average || 0);
      });
    }
    
    // Prendre les 20 meilleurs
    similarItems = similarItems.slice(0, 20);
    
    if(similarItems.length === 0){
      similarSection.style.display = "none";
      return;
    }
    
    // Afficher la section des titres similaires
    similarSection.style.display = "block";
    similarGrid.innerHTML = "";
    
    for(const item of similarItems){
      // Prioriser le poster pour de meilleures affiches
      const imagePath = item.poster_path || item.backdrop_path;
      if(!imagePath) continue;
      
      const isMovie = type === "movie";
      const title = item.title || item.name || "";
      const year = yearOf(item.release_date || item.first_air_date);
      // Utiliser w780 pour une meilleure qualité dans la grille
      const imgUrl = `https://image.tmdb.org/t/p/w780${imagePath}`;
      
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
      
      const tile = createSearchTile({
        imgUrl,
        title,
        year,
        isMovie,
        runtimeText,
        typeLabel: isMovie ? "Film" : "Série",
        adult: !!item.adult,
        itemId: item.id
      });
      
      similarGrid.appendChild(tile);
    }
    
  } catch(e){
    console.error("Erreur lors du chargement des titres similaires:", e);
    document.getElementById("similarResultsSection").style.display = "none";
  }
}

/* ========================================
   GESTION DES MESSAGES D'ÉTAT
   ======================================== */
function showStatus(message, type = "loading"){
  const statusEl = document.getElementById("searchStatus");
  if(statusEl){
    statusEl.textContent = message;
    statusEl.className = `search-status ${type}`;
    statusEl.style.display = "block";
  }
}

function hideStatus(){
  const statusEl = document.getElementById("searchStatus");
  if(statusEl){
    statusEl.style.display = "none";
  }
}

/* ========================================
   RECHERCHE - Suggestions en temps réel
   ======================================== */
let searchSuggestionsTimeout = null;

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
      window.location.href = `../PageDetail/detail.html?id=${item.id}&type=${isMovie ? "movie" : "tv"}`;
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
   GESTION DE LA RECHERCHE
   ======================================== */
function handleSearch(event){
  event.preventDefault();
  const searchInput = document.getElementById('searchInput');
  if(searchInput){
    const query = searchInput.value.trim();
    if(query.length >= 2){
      hideSuggestions();
      currentSearchItem = null;
      performSearch(query);
    }
  }
}

/* ========================================
   INITIALISATION
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer la requête de recherche depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  
  // Si une requête est présente dans l'URL, effectuer la recherche
  if(query && query.trim().length >= 2){
    const searchInput = document.getElementById('searchInput');
    if(searchInput){
      searchInput.value = query;
    }
    performSearch(query);
  }
  
  // Gérer la recherche via le formulaire
  const searchForm = document.querySelector('.search-bar');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.querySelector('.search-btn');
  
  if(searchForm && searchInput){
    let searchTimeout;
    
    // Recherche lors de la soumission du formulaire
    searchForm.addEventListener('submit', handleSearch);
    
    // Recherche lors du clic sur le bouton
    if(searchBtn){
      searchBtn.addEventListener('click', handleSearch);
    }
    
    // Recherche lors de la touche Entrée
    searchInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        const query = searchInput.value.trim();
        if(query.length >= 2){
          handleSearch(e);
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
      if(searchSuggestionsTimeout){
        clearTimeout(searchSuggestionsTimeout);
      }
      
      if(query.length >= 2){
        // Afficher les suggestions (300ms après la dernière frappe)
        searchSuggestionsTimeout = setTimeout(() => {
          searchSuggestions(query);
        }, 300);
      } else {
        hideSuggestions();
      }
      
      // Recherche en temps réel (avec debounce plus long pour la page complète)
      clearTimeout(searchTimeout);
      if(query.length >= 2){
        searchTimeout = setTimeout(() => {
          currentSearchItem = null;
          performSearch(query);
        }, 500); // Attendre 500ms après la dernière frappe
      } else if(query.length === 0){
        // Réinitialiser la page si la recherche est vide
        document.getElementById("searchResultsSection").style.display = "none";
        document.getElementById("similarResultsSection").style.display = "none";
        document.getElementById("searchPageTitle").textContent = "Recherche";
        document.getElementById("searchSubtitle").textContent = "Tapez votre recherche ci-dessus";
        hideStatus();
        currentSearchItem = null;
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
});

