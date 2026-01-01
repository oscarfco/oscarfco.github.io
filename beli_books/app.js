// PIN Protection
const CORRECT_PIN = '9999';
let isAuthenticated = false;

// JSONBin Configuration
const JSONBIN_BIN_ID = '692a5ff4d0ea881f4006f223';
const JSONBIN_API_KEY = '$2a$10$Mk1FfCJpoY8FIOQJrMLw..vkr/0x2cLx7xgOhlaa./Kgf1ZkQJLz6';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// State - don't load from localStorage until after cloud check
let rankedBooks = [];
let wishlistBooks = [];
let pendingBook = null;
let dataLoaded = false;
let binarySearch = { low: 0, high: 0, mid: 0 };
let currentDetailBookIndex = null;
let currentDetailType = null; // 'ranked' or 'wishlist'
let activeTab = 'rankings';
let isSyncing = false;
let activeYearFilter = 'all';
let statsYearFilter = 'all';
let pendingBookForYear = null;
let showGoodreadsComparison = false;

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const rankingsList = document.getElementById('rankings-list');
const wishlistList = document.getElementById('wishlist-list');
const mainView = document.getElementById('main-view');
const comparisonView = document.getElementById('comparison-view');
const bookDetailModal = document.getElementById('book-detail-modal');

// Search debounce
let searchTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupPinGate();
});

function setupPinGate() {
    const pinDigits = document.querySelectorAll('.pin-digit');
    const pinError = document.getElementById('pin-error');
    const pinGate = document.getElementById('pin-gate');
    const appContainer = document.getElementById('app-container');
    
    pinDigits.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Only allow numbers
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            // Move to next input
            if (value && index < 3) {
                pinDigits[index + 1].focus();
            }
            
            // Check if all digits entered
            checkPin();
        });
        
        input.addEventListener('keydown', (e) => {
            // Handle backspace
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinDigits[index - 1].focus();
            }
        });
        
        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
            paste.split('').forEach((char, i) => {
                if (pinDigits[i]) {
                    pinDigits[i].value = char;
                }
            });
            checkPin();
        });
    });
    
    function checkPin() {
        const enteredPin = Array.from(pinDigits).map(d => d.value).join('');
        
        if (enteredPin.length === 4) {
            if (enteredPin === CORRECT_PIN) {
                // Correct PIN - unlock the app
                isAuthenticated = true;
                pinGate.classList.add('hidden');
                appContainer.classList.remove('hidden');
                initializeApp();
            } else {
                // Wrong PIN
                pinError.classList.remove('hidden');
                pinDigits.forEach(d => {
                    d.value = '';
                    d.style.borderColor = '#c44';
                });
                pinDigits[0].focus();
                
                setTimeout(() => {
                    pinDigits.forEach(d => d.style.borderColor = '');
                    pinError.classList.add('hidden');
                }, 1500);
            }
        }
    }
    
    // Focus first input
    setTimeout(() => pinDigits[0].focus(), 100);
}

async function initializeApp() {
    // Show loading state (already in HTML)
    // Try to load from cloud first, fall back to localStorage
    await loadFromCloud();
    dataLoaded = true;
    renderRankings();
    renderWishlist();
    setupEventListeners();
    
    // Show What's New modal for 2 weeks after Jan 1, 2026
    showWhatsNewIfRecent();
}

function showWhatsNewIfRecent() {
    const FEATURE_RELEASE_DATE = new Date('2026-01-01').getTime();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    // Only show if within 2 weeks of release
    if (now - FEATURE_RELEASE_DATE < TWO_WEEKS_MS) {
        // Check if user has dismissed it this session
        const dismissed = sessionStorage.getItem('whatsNewDismissed');
        if (!dismissed) {
            document.getElementById('whats-new-modal').classList.remove('hidden');
        }
    }
}

// Cloud sync functions
async function loadFromCloud() {
    try {
        const response = await fetch(`${JSONBIN_URL}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.record) {
                // Use cloud data
                rankedBooks = data.record.rankedBooks || [];
                wishlistBooks = data.record.wishlistBooks || [];
                // Update localStorage as cache
                localStorage.setItem('beli_ranked_books', JSON.stringify(rankedBooks));
                localStorage.setItem('beli_wishlist_books', JSON.stringify(wishlistBooks));
                console.log('Loaded data from cloud');
                return;
            }
        }
        // If cloud response wasn't ok, fall back to localStorage
        loadFromLocalStorage();
    } catch (error) {
        console.log('Could not load from cloud, using local data:', error);
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    rankedBooks = JSON.parse(localStorage.getItem('beli_ranked_books')) || [];
    wishlistBooks = JSON.parse(localStorage.getItem('beli_wishlist_books')) || [];
}

async function saveToCloud() {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify({
                rankedBooks: rankedBooks,
                wishlistBooks: wishlistBooks
            })
        });
        console.log('Saved to cloud');
    } catch (error) {
        console.error('Could not save to cloud:', error);
    } finally {
        isSyncing = false;
    }
}

function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        
        searchTimeout = setTimeout(() => searchBooks(query), 300);
    });

    // Click outside to close search
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-section')) {
            hideSearchResults();
        }
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // Comparison choices
    document.getElementById('choice-new').addEventListener('click', () => handleComparison(true));
    document.getElementById('choice-existing').addEventListener('click', () => handleComparison(false));

    // Modal controls
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.getElementById('delete-book-btn').addEventListener('click', showDeleteConfirm);
    document.getElementById('confirm-cancel').addEventListener('click', hideDeleteConfirm);
    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
    document.getElementById('rerank-btn').addEventListener('click', rerankBook);
    document.getElementById('move-to-rankings-btn').addEventListener('click', moveToRankings);
    
    // Review controls
    document.getElementById('add-review-btn').addEventListener('click', showReviewEdit);
    document.getElementById('edit-review-btn').addEventListener('click', showReviewEdit);
    document.getElementById('cancel-review-btn').addEventListener('click', hideReviewEdit);
    document.getElementById('save-review-btn').addEventListener('click', saveReview);
    
    // Year filter dropdown
    document.getElementById('year-filter-dropdown').addEventListener('change', (e) => {
        setYearFilter(e.target.value);
    });
    
    // Year selection modal confirm
    document.getElementById('year-select-confirm').addEventListener('click', () => {
        const year = document.getElementById('year-select-dropdown').value;
        confirmYearSelection(year);
    });
    
    // Detail year dropdown
    document.getElementById('detail-year-dropdown').addEventListener('change', (e) => {
        updateBookYear(e.target.value);
    });
    
    // Show GR rating toggle
    document.getElementById('show-gr-toggle').addEventListener('change', (e) => {
        showGoodreadsComparison = e.target.checked;
        renderRankings();
    });
    
    // Stats year filter
    document.getElementById('stats-year-dropdown').addEventListener('change', (e) => {
        statsYearFilter = e.target.value;
        renderStats();
    });
    
    // What's New modal
    document.getElementById('whats-new-btn').addEventListener('click', () => {
        document.getElementById('whats-new-modal').classList.remove('hidden');
    });
    document.getElementById('whats-new-close').addEventListener('click', () => {
        document.getElementById('whats-new-modal').classList.add('hidden');
        sessionStorage.setItem('whatsNewDismissed', 'true');
    });
    document.getElementById('whats-new-modal').addEventListener('click', (e) => {
        if (e.target.id === 'whats-new-modal') {
            document.getElementById('whats-new-modal').classList.add('hidden');
            sessionStorage.setItem('whatsNewDismissed', 'true');
        }
    });
    
    // Initialize year dropdowns
    populateYearDropdowns();
}

function switchTab(tabName) {
    activeTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.getElementById('rankings-tab').classList.toggle('hidden', tabName !== 'rankings');
    document.getElementById('wishlist-tab').classList.toggle('hidden', tabName !== 'wishlist');
    document.getElementById('stats-tab').classList.toggle('hidden', tabName !== 'stats');
    
    // Render stats when switching to stats tab
    if (tabName === 'stats') {
        renderStats();
    }
}

// Book Search using Open Library API
async function searchBooks(query) {
    showSearchLoading();
    
    try {
        const response = await fetch(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,cover_i,first_publish_year`
        );
        const data = await response.json();
        
        if (data.docs && data.docs.length > 0) {
            renderSearchResults(data.docs);
        } else {
            showSearchEmpty();
        }
    } catch (error) {
        console.error('Search error:', error);
        showSearchEmpty('Error searching. Please try again.');
    }
}

function renderSearchResults(books) {
    searchResults.innerHTML = books.map(book => {
        const coverUrl = book.cover_i 
            ? `https://covers.openlibrary.org/b/id/${book.cover_i}-S.jpg`
            : '';
        const author = book.author_name ? book.author_name[0] : 'Unknown Author';
        const bookData = JSON.stringify({
            id: book.key,
            title: book.title,
            author: author,
            coverId: book.cover_i || null,
            year: book.first_publish_year || null
        }).replace(/'/g, "&#39;");
        
        return `
            <div class="search-result-item">
                ${coverUrl 
                    ? `<img class="cover-thumb" src="${coverUrl}" alt="">`
                    : `<div class="cover-thumb"></div>`
                }
                <div class="book-info">
                    <div class="book-title">${escapeHtml(book.title)}</div>
                    <div class="book-author">${escapeHtml(author)}</div>
                </div>
                <div class="add-actions">
                    <button class="add-btn add-rank" data-book='${bookData}'>Rank</button>
                    <button class="add-btn add-wishlist" data-book='${bookData}'>Wishlist</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers for rank buttons
    searchResults.querySelectorAll('.add-rank').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookData = JSON.parse(btn.dataset.book);
            addToRankings(bookData);
        });
    });
    
    // Add click handlers for wishlist buttons
    searchResults.querySelectorAll('.add-wishlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookData = JSON.parse(btn.dataset.book);
            addToWishlist(bookData);
        });
    });
    
    searchResults.classList.remove('hidden');
}

function addToRankings(book) {
    // Check if already ranked
    if (rankedBooks.some(b => b.id === book.id)) {
        alert('You\'ve already ranked this book!');
        return;
    }
    
    // Remove from wishlist if present
    const wishlistIndex = wishlistBooks.findIndex(b => b.id === book.id);
    if (wishlistIndex !== -1) {
        wishlistBooks.splice(wishlistIndex, 1);
        saveWishlist();
    }
    
    hideSearchResults();
    searchInput.value = '';
    
    // Show year selection modal
    pendingBookForYear = book;
    showYearSelectModal();
}

function showYearSelectModal() {
    document.getElementById('year-select-modal').classList.remove('hidden');
}

function hideYearSelectModal() {
    document.getElementById('year-select-modal').classList.add('hidden');
}

async function confirmYearSelection(year) {
    if (!pendingBookForYear) return;
    
    const book = { ...pendingBookForYear, yearTag: year };
    pendingBookForYear = null;
    hideYearSelectModal();
    
    // Fetch additional metadata
    await fetchBookMetadata(book);
    
    if (rankedBooks.length === 0) {
        rankedBooks.push(book);
        saveAndRender();
    } else {
        pendingBook = book;
        startBinaryComparison();
    }
}

async function fetchBookMetadata(book) {
    try {
        // Extract work ID from the key (e.g., "/works/OL123W" -> "OL123W")
        const workId = book.id.replace('/works/', '');
        const response = await fetch(`https://openlibrary.org/works/${workId}.json`);
        
        if (response.ok) {
            const data = await response.json();
            
            // Get subjects/genres
            if (data.subjects) {
                book.subjects = data.subjects.slice(0, 5); // Top 5 subjects
            }
            
            // Try to get page count from editions
            const editionsResponse = await fetch(`https://openlibrary.org/works/${workId}/editions.json?limit=5`);
            if (editionsResponse.ok) {
                const editionsData = await editionsResponse.json();
                const pagesArray = editionsData.entries
                    ?.map(e => e.number_of_pages)
                    .filter(p => p && p > 0);
                
                if (pagesArray && pagesArray.length > 0) {
                    // Use median page count
                    pagesArray.sort((a, b) => a - b);
                    book.pages = pagesArray[Math.floor(pagesArray.length / 2)];
                }
            }
        }
    } catch (error) {
        console.log('Could not fetch book metadata:', error);
    }
}

function populateYearDropdowns() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 20; y--) {
        years.push(y.toString());
    }
    
    // Populate the modal dropdown with placeholder
    const modalDropdown = document.getElementById('year-select-dropdown');
    modalDropdown.innerHTML = '<option value="" disabled selected>Select year...</option>' + 
        years.map(y => `<option value="${y}">${y}</option>`).join('');
    
    // Populate the detail dropdown
    const detailDropdown = document.getElementById('detail-year-dropdown');
    detailDropdown.innerHTML = '<option value="" disabled>Select year...</option>' + 
        years.map(y => `<option value="${y}">${y}</option>`).join('');
    
    // Update filter dropdown with years that have books
    updateYearFilterOptions();
}

function updateYearFilterOptions() {
    const filterDropdown = document.getElementById('year-filter-dropdown');
    const currentValue = filterDropdown.value;
    
    // Get unique years from ranked books
    const yearsWithBooks = [...new Set(rankedBooks.map(b => b.yearTag).filter(Boolean))].sort().reverse();
    
    filterDropdown.innerHTML = '<option value="all">All Time</option>' + 
        yearsWithBooks.map(y => `<option value="${y}">${y}</option>`).join('');
    
    // Restore selection if still valid
    if (currentValue === 'all' || yearsWithBooks.includes(currentValue)) {
        filterDropdown.value = currentValue;
    } else {
        filterDropdown.value = 'all';
        activeYearFilter = 'all';
    }
}

function updateStatsYearDropdown() {
    const dropdown = document.getElementById('stats-year-dropdown');
    const currentValue = dropdown.value;
    
    // Get unique years from ranked books
    const yearsWithBooks = [...new Set(rankedBooks.map(b => b.yearTag).filter(Boolean))].sort().reverse();
    
    dropdown.innerHTML = '<option value="all">All Time</option>' + 
        yearsWithBooks.map(y => `<option value="${y}">${y}</option>`).join('');
    
    // Restore selection if still valid
    if (currentValue === 'all' || yearsWithBooks.includes(currentValue)) {
        dropdown.value = currentValue;
    } else {
        dropdown.value = 'all';
        statsYearFilter = 'all';
    }
}

function setYearFilter(year) {
    activeYearFilter = year;
    renderRankings();
}

function updateBookYear(year) {
    if (currentDetailBookIndex === null || currentDetailType !== 'ranked') return;
    
    rankedBooks[currentDetailBookIndex].yearTag = year;
    saveAndRender();
    updateYearFilterOptions();
}

function addToWishlist(book) {
    // Check if already in wishlist or ranked
    if (wishlistBooks.some(b => b.id === book.id)) {
        alert('This book is already in your wishlist!');
        return;
    }
    if (rankedBooks.some(b => b.id === book.id)) {
        alert('You\'ve already ranked this book!');
        return;
    }
    
    hideSearchResults();
    searchInput.value = '';
    
    wishlistBooks.push(book);
    saveWishlist();
    renderWishlist();
    
    // Switch to wishlist tab to show the addition
    switchTab('wishlist');
}

function startBinaryComparison() {
    binarySearch = {
        low: 0,
        high: rankedBooks.length - 1,
        mid: Math.floor((rankedBooks.length - 1) / 2)
    };
    
    showComparison();
}

function showComparison() {
    const existingBook = rankedBooks[binarySearch.mid];
    
    // Update new book display
    document.getElementById('new-book-title').textContent = pendingBook.title;
    document.getElementById('new-book-author').textContent = pendingBook.author;
    const newCover = document.getElementById('new-book-cover');
    if (pendingBook.coverId) {
        newCover.style.backgroundImage = `url(https://covers.openlibrary.org/b/id/${pendingBook.coverId}-M.jpg)`;
    } else {
        newCover.style.backgroundImage = '';
    }
    
    // Update existing book display
    document.getElementById('existing-book-title').textContent = existingBook.title;
    document.getElementById('existing-book-author').textContent = existingBook.author;
    const existingCover = document.getElementById('existing-book-cover');
    if (existingBook.coverId) {
        existingCover.style.backgroundImage = `url(https://covers.openlibrary.org/b/id/${existingBook.coverId}-M.jpg)`;
    } else {
        existingCover.style.backgroundImage = '';
    }
    
    comparisonView.classList.remove('hidden');
    mainView.style.display = 'none';
}

function handleComparison(newBookIsBetter) {
    if (newBookIsBetter) {
        binarySearch.high = binarySearch.mid - 1;
    } else {
        binarySearch.low = binarySearch.mid + 1;
    }
    
    if (binarySearch.low > binarySearch.high) {
        const insertPosition = binarySearch.low;
        rankedBooks.splice(insertPosition, 0, pendingBook);
        pendingBook = null;
        
        comparisonView.classList.add('hidden');
        mainView.style.display = 'block';
        saveAndRender();
        switchTab('rankings');
    } else {
        binarySearch.mid = Math.floor((binarySearch.low + binarySearch.high) / 2);
        showComparison();
    }
}

function saveAndRender() {
    localStorage.setItem('beli_ranked_books', JSON.stringify(rankedBooks));
    saveToCloud(); // Sync to cloud
    renderRankings();
    updateYearFilterOptions();
}

function saveWishlist() {
    localStorage.setItem('beli_wishlist_books', JSON.stringify(wishlistBooks));
    saveToCloud(); // Sync to cloud
}

function renderRankings() {
    // Filter books based on active year filter
    const filteredBooks = activeYearFilter === 'all' 
        ? rankedBooks 
        : rankedBooks.filter(book => book.yearTag === activeYearFilter);
    
    if (rankedBooks.length === 0) {
        rankingsList.innerHTML = '<p class="empty-state">No books ranked yet. Search and add your first book!</p>';
        return;
    }
    
    if (filteredBooks.length === 0) {
        rankingsList.innerHTML = `<p class="empty-state">No books ranked in ${activeYearFilter} yet.</p>`;
        return;
    }
    
    rankingsList.innerHTML = filteredBooks.map((book) => {
        // Find the actual index in the main array for the modal
        const actualIndex = rankedBooks.indexOf(book);
        // Calculate position within filtered view
        const filteredIndex = filteredBooks.indexOf(book);
        const score = calculateScore(filteredIndex, filteredBooks.length);
        const coverUrl = book.coverId 
            ? `https://covers.openlibrary.org/b/id/${book.coverId}-S.jpg`
            : '';
        const hasReview = book.review && book.review.trim().length > 0;
        const yearBadge = book.yearTag ? `<span class="year-tag">${book.yearTag}</span>` : '';
        
        // GR rating display
        let grRatingHtml = '';
        if (showGoodreadsComparison && book.goodreads?.rating) {
            grRatingHtml = `<div class="gr-inline-rating">${book.goodreads.rating.toFixed(1)} ★</div>`;
        }
        
        return `
            <div class="ranked-book" data-index="${actualIndex}">
                <div class="rank-badge">${filteredIndex + 1}</div>
                ${coverUrl 
                    ? `<img class="cover-thumb" src="${coverUrl}" alt="">`
                    : `<div class="cover-thumb"></div>`
                }
                <div class="book-info">
                    <div class="book-title">${escapeHtml(book.title)}</div>
                    <div class="book-author">${escapeHtml(book.author)}</div>
                </div>
                ${yearBadge}
                ${hasReview ? '<div class="has-review" title="Has review"></div>' : ''}
                ${grRatingHtml}
                <div class="score">${score.toFixed(1)}</div>
            </div>
        `;
    }).join('');

    rankingsList.querySelectorAll('.ranked-book').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            openBookDetail(index, 'ranked');
        });
    });
}

function renderWishlist() {
    if (wishlistBooks.length === 0) {
        wishlistList.innerHTML = '<p class="empty-state">Your wishlist is empty. Search and add books you want to read!</p>';
        return;
    }
    
    wishlistList.innerHTML = wishlistBooks.map((book, index) => {
        const coverUrl = book.coverId 
            ? `https://covers.openlibrary.org/b/id/${book.coverId}-S.jpg`
            : '';
        
        return `
            <div class="wishlist-book" data-index="${index}">
                ${coverUrl 
                    ? `<img class="cover-thumb" src="${coverUrl}" alt="">`
                    : `<div class="cover-thumb"></div>`
                }
                <div class="book-info">
                    <div class="book-title">${escapeHtml(book.title)}</div>
                    <div class="book-author">${escapeHtml(book.author)}</div>
                </div>
                <span class="wishlist-icon">📚</span>
            </div>
        `;
    }).join('');

    wishlistList.querySelectorAll('.wishlist-book').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            openBookDetail(index, 'wishlist');
        });
    });
}

// Book Detail Modal
function openBookDetail(index, type) {
    currentDetailBookIndex = index;
    currentDetailType = type;
    
    const book = type === 'ranked' ? rankedBooks[index] : wishlistBooks[index];
    
    // Update modal content
    document.getElementById('detail-title').textContent = book.title;
    document.getElementById('detail-author').textContent = book.author;
    
    const detailMeta = document.querySelector('.detail-meta');
    const reviewSection = document.getElementById('review-section');
    const rerankBtn = document.getElementById('rerank-btn');
    const moveBtn = document.getElementById('move-to-rankings-btn');
    
    if (type === 'ranked') {
        // Calculate rank based on current filter view
        const filteredBooks = activeYearFilter === 'all' 
            ? rankedBooks 
            : rankedBooks.filter(b => b.yearTag === activeYearFilter);
        const filteredIndex = filteredBooks.indexOf(book);
        const displayRank = filteredIndex >= 0 ? filteredIndex + 1 : index + 1;
        const score = calculateScore(filteredIndex >= 0 ? filteredIndex : index, filteredBooks.length || rankedBooks.length);
        
        document.getElementById('detail-rank').innerHTML = `Rank: <strong>#${displayRank}</strong>`;
        document.getElementById('detail-score').innerHTML = `Score: <strong>${score.toFixed(1)}</strong>`;
        document.getElementById('detail-year-selector').style.display = 'flex';
        const yearDropdown = document.getElementById('detail-year-dropdown');
        if (book.yearTag) {
            yearDropdown.value = book.yearTag;
        } else {
            yearDropdown.value = '';
        }
        detailMeta.style.display = 'flex';
        reviewSection.style.display = 'block';
        rerankBtn.classList.remove('hidden');
        moveBtn.classList.add('hidden');
        
        // Set up review state
        updateReviewDisplay(book.review);
    } else {
        detailMeta.style.display = 'none';
        reviewSection.style.display = 'none';
        document.getElementById('detail-year-selector').style.display = 'none';
        rerankBtn.classList.add('hidden');
        moveBtn.classList.remove('hidden');
    }
    
    const coverEl = document.getElementById('detail-cover');
    if (book.coverId) {
        coverEl.style.backgroundImage = `url(https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg)`;
    } else {
        coverEl.style.backgroundImage = '';
    }
    
    // Use cached Goodreads data if available, otherwise fetch
    if (book.goodreads && book.goodreads.rating) {
        displayCachedGoodreadsData(book.goodreads);
    } else {
        const goodreadsQuery = encodeURIComponent(`${book.title} ${book.author}`);
        document.getElementById('goodreads-link').href = `https://www.goodreads.com/search?q=${goodreadsQuery}`;
        fetchGoodreadsData(book);
    }
    
    // Reset delete confirmation
    hideDeleteConfirm();
    
    bookDetailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function updateReviewDisplay(review) {
    const reviewDisplay = document.getElementById('review-display');
    const reviewEmpty = document.getElementById('review-empty');
    const reviewEdit = document.getElementById('review-edit');
    const reviewText = document.getElementById('review-text');
    
    // Hide edit mode
    reviewEdit.classList.add('hidden');
    
    if (review && review.trim()) {
        // Show display mode with review text
        reviewText.textContent = review;
        reviewDisplay.classList.remove('hidden');
        reviewEmpty.classList.add('hidden');
    } else {
        // Show empty state
        reviewDisplay.classList.add('hidden');
        reviewEmpty.classList.remove('hidden');
    }
}

function showReviewEdit() {
    const book = rankedBooks[currentDetailBookIndex];
    const reviewDisplay = document.getElementById('review-display');
    const reviewEmpty = document.getElementById('review-empty');
    const reviewEdit = document.getElementById('review-edit');
    const reviewTextarea = document.getElementById('review-textarea');
    
    reviewDisplay.classList.add('hidden');
    reviewEmpty.classList.add('hidden');
    reviewEdit.classList.remove('hidden');
    
    reviewTextarea.value = book.review || '';
    reviewTextarea.focus();
}

function hideReviewEdit() {
    const book = rankedBooks[currentDetailBookIndex];
    updateReviewDisplay(book.review);
}

function closeModal() {
    bookDetailModal.classList.add('hidden');
    document.body.style.overflow = '';
    currentDetailBookIndex = null;
    currentDetailType = null;
}

function saveReview() {
    if (currentDetailBookIndex === null || currentDetailType !== 'ranked') return;
    
    const review = document.getElementById('review-textarea').value;
    rankedBooks[currentDetailBookIndex].review = review;
    saveAndRender();
    
    // Switch back to display mode
    updateReviewDisplay(review);
}

function rerankBook() {
    if (currentDetailBookIndex === null || currentDetailType !== 'ranked') return;
    
    // Get the book and preserve its review
    const book = { ...rankedBooks[currentDetailBookIndex] };
    
    // Remove from current position
    rankedBooks.splice(currentDetailBookIndex, 1);
    saveAndRender();
    
    closeModal();
    
    // If only one book left (or none), just add back
    if (rankedBooks.length === 0) {
        rankedBooks.push(book);
        saveAndRender();
    } else {
        // Start binary comparison for re-ranking
        pendingBook = book;
        startBinaryComparison();
    }
}

function moveToRankings() {
    if (currentDetailBookIndex === null || currentDetailType !== 'wishlist') return;
    
    const book = wishlistBooks[currentDetailBookIndex];
    
    // Remove from wishlist
    wishlistBooks.splice(currentDetailBookIndex, 1);
    saveWishlist();
    renderWishlist();
    
    closeModal();
    
    // Show year selection modal for the book
    pendingBookForYear = book;
    showYearSelectModal();
}

function showDeleteConfirm() {
    document.getElementById('delete-confirm').classList.remove('hidden');
    document.getElementById('delete-book-btn').style.display = 'none';
}

function hideDeleteConfirm() {
    document.getElementById('delete-confirm').classList.add('hidden');
    document.getElementById('delete-book-btn').style.display = 'block';
}

function confirmDelete() {
    if (currentDetailBookIndex === null) return;
    
    if (currentDetailType === 'ranked') {
        rankedBooks.splice(currentDetailBookIndex, 1);
        saveAndRender();
    } else {
        wishlistBooks.splice(currentDetailBookIndex, 1);
        saveWishlist();
        renderWishlist();
    }
    
    hideDeleteConfirm();
    closeModal();
}

function calculateScore(index, total) {
    if (total === 1) return 10;
    return 10 - (index / (total - 1)) * 10;
}

// UI Helpers
function showSearchLoading() {
    searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
    searchResults.classList.remove('hidden');
}

function showSearchEmpty(message = 'No books found') {
    searchResults.innerHTML = `<div class="search-empty">${message}</div>`;
    searchResults.classList.remove('hidden');
}

function hideSearchResults() {
    searchResults.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Stats Dashboard
function renderStats() {
    // Populate year dropdown
    updateStatsYearDropdown();
    
    // Filter books by selected year
    const books = statsYearFilter === 'all' 
        ? rankedBooks 
        : rankedBooks.filter(b => b.yearTag === statsYearFilter);
    
    // Basic counts
    const totalBooks = books.length;
    const totalPages = books.reduce((sum, b) => sum + (b.pages || 0), 0);
    const totalWords = books.reduce((sum, b) => sum + (b.words || 0), 0);
    const readingHours = Math.round(totalWords / 15000); // ~250 words/min
    
    // Calculate avg Goodreads rating
    const booksWithGr = books.filter(b => b.goodreads?.rating);
    const avgGrRating = booksWithGr.length > 0 
        ? (booksWithGr.reduce((sum, b) => sum + b.goodreads.rating, 0) / booksWithGr.length).toFixed(2)
        : 0;
    
    // Unique authors
    const uniqueAuthors = new Set(books.map(b => b.author)).size;
    
    // Update hero stat
    document.getElementById('stat-total-books').textContent = totalBooks;
    
    // Update mini stats
    document.getElementById('stat-total-pages').textContent = formatLargeNumber(totalPages);
    document.getElementById('stat-total-words').textContent = formatLargeNumber(totalWords);
    document.getElementById('stat-reading-hours').textContent = readingHours;
    
    // Update accent stats
    document.getElementById('stat-avg-gr-rating').textContent = avgGrRating + '★';
    document.getElementById('stat-unique-authors').textContent = uniqueAuthors;
    
    // Stats by year
    renderStatsByYear(books);
    
    // Top authors
    renderTopAuthors(books);
    
    // Ranking comparison
    renderRankingComparison(books);
    
    // Books by decade
    renderDecades(books);
    
}

function calculateTotalGrRatings(books) {
    return books.reduce((sum, b) => sum + (b.goodreads?.rating_count || 0), 0);
}

function renderRankingComparison(books) {
    const booksWithGr = books.filter(b => b.goodreads?.rating);
    
    if (booksWithGr.length < 3) {
        document.getElementById('similarity-value').textContent = '--';
        document.getElementById('ranking-comparison').innerHTML = '<p class="stats-empty">Not enough data</p>';
        return;
    }
    
    // Create comparison data
    const comparison = booksWithGr.map((book, i) => ({
        title: book.title,
        author: book.author,
        userRank: i + 1,
        grRating: book.goodreads.rating
    }));
    
    // Sort by GR rating to get GR ranking
    const grSorted = [...comparison].sort((a, b) => b.grRating - a.grRating);
    grSorted.forEach((item, i) => {
        item.grRank = i + 1;
    });
    
    // Add GR rank back to original order
    comparison.forEach(item => {
        const grItem = grSorted.find(g => g.title === item.title);
        item.grRank = grItem.grRank;
        item.diff = item.grRank - item.userRank;
    });
    
    // Calculate Spearman's rank correlation coefficient
    const n = comparison.length;
    const sumDSquared = comparison.reduce((sum, b) => sum + (b.diff * b.diff), 0);
    // Spearman's rho = 1 - (6 * Σd²) / (n * (n² - 1))
    const spearmanRho = 1 - (6 * sumDSquared) / (n * (n * n - 1));
    // Convert to 0-100% scale (rho ranges from -1 to 1, we map to 0-100)
    const similarityScore = ((spearmanRho + 1) / 2) * 100;
    
    document.getElementById('similarity-value').textContent = similarityScore.toFixed(0) + '%';
    
    // Render comparison table
    const youRatedHigher = comparison.filter(b => b.diff > 3).slice(0, 3);
    const grRatedHigher = comparison.filter(b => b.diff < -3).slice(0, 3);
    
    let html = '';
    
    if (youRatedHigher.length > 0) {
        html += '<div class="comparison-group"><h4>📈 You liked more than Goodreads</h4>';
        html += youRatedHigher.map(b => `
            <div class="comparison-row positive">
                <span class="comp-title">${escapeHtml(b.title)}</span>
                <span class="comp-ranks">
                    <span class="rank-badge-you">#${b.userRank}</span>
                    <span class="rank-arrow">→</span>
                    <span class="rank-badge-gr">#${b.grRank}</span>
                </span>
            </div>
        `).join('');
        html += '</div>';
    }
    
    if (grRatedHigher.length > 0) {
        html += '<div class="comparison-group"><h4>📉 Goodreads liked more than you</h4>';
        html += grRatedHigher.map(b => `
            <div class="comparison-row negative">
                <span class="comp-title">${escapeHtml(b.title)}</span>
                <span class="comp-ranks">
                    <span class="rank-badge-you">#${b.userRank}</span>
                    <span class="rank-arrow">→</span>
                    <span class="rank-badge-gr">#${b.grRank}</span>
                </span>
            </div>
        `).join('');
        html += '</div>';
    }
    
    if (!html) {
        html = '<p class="stats-empty">Your taste aligns well with Goodreads!</p>';
    }
    
    document.getElementById('ranking-comparison').innerHTML = html;
}

function renderDecades(books) {
    const decades = {};
    books.forEach(book => {
        if (book.year) {
            const decade = Math.floor(book.year / 10) * 10;
            decades[decade] = (decades[decade] || 0) + 1;
        }
    });
    
    const container = document.getElementById('stats-decades');
    const sorted = Object.entries(decades).sort((a, b) => a[0] - b[0]);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="stats-empty">No publication year data</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([decade, count]) => 
        `<span class="decade-tag">${decade}s <small>(${count})</small></span>`
    ).join('');
}

function renderStatsByYear(books) {
    const byYear = {};
    books.forEach(book => {
        const year = book.yearTag;
        if (!year) return; // Skip books without year tag
        if (!byYear[year]) byYear[year] = { count: 0, pages: 0 };
        byYear[year].count++;
        byYear[year].pages += book.pages || 0;
    });
    
    const years = Object.keys(byYear).sort().reverse();
    const container = document.getElementById('stats-by-year');
    
    if (years.length === 0) {
        container.innerHTML = '<p class="stats-empty">No year data yet. Add a year when ranking books!</p>';
        return;
    }
    
    container.innerHTML = years.map(year => `
        <div class="year-stat-row">
            <span class="year-stat-label">${year}</span>
            <span class="year-stat-count">${byYear[year].count} book${byYear[year].count !== 1 ? 's' : ''}</span>
            <span class="year-stat-pages">${formatNumber(byYear[year].pages)} pages</span>
        </div>
    `).join('');
}

function renderTopAuthors(books) {
    const authors = {};
    books.forEach(book => {
        const author = book.author || 'Unknown';
        authors[author] = (authors[author] || 0) + 1;
    });
    
    const sorted = Object.entries(authors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const container = document.getElementById('stats-authors');
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="stats-empty">No authors yet</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([author, count], i) => `
        <div class="author-stat-row">
            <span class="author-rank">${i + 1}</span>
            <span class="author-name">${escapeHtml(author)}</span>
            <span class="author-count">${count} book${count !== 1 ? 's' : ''}</span>
        </div>
    `).join('');
}

function renderGenres(books) {
    const genres = {};
    books.forEach(book => {
        if (book.subjects) {
            book.subjects.forEach(subject => {
                genres[subject] = (genres[subject] || 0) + 1;
            });
        }
    });
    
    const sorted = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
    
    const container = document.getElementById('stats-genres');
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="stats-empty">No genre data available</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([genre, count]) => `
        <span class="genre-tag">${escapeHtml(genre)} <small>(${count})</small></span>
    `).join('');
}

function renderMilestones(books, totalPages, totalWords) {
    const milestones = [];
    
    // Book milestones
    if (books.length >= 1) milestones.push({ icon: '📖', text: 'First book ranked!' });
    if (books.length >= 10) milestones.push({ icon: '🔟', text: '10 books read' });
    if (books.length >= 25) milestones.push({ icon: '📚', text: '25 books read' });
    if (books.length >= 50) milestones.push({ icon: '🏆', text: '50 books read!' });
    if (books.length >= 100) milestones.push({ icon: '💯', text: '100 books read!' });
    
    // Page milestones
    if (totalPages >= 1000) milestones.push({ icon: '📄', text: '1,000 pages read' });
    if (totalPages >= 5000) milestones.push({ icon: '📑', text: '5,000 pages read' });
    if (totalPages >= 10000) milestones.push({ icon: '📕', text: '10,000 pages read!' });
    
    // Word milestones
    if (totalWords >= 1000000) milestones.push({ icon: '✍️', text: '1 million words read!' });
    
    const container = document.getElementById('stats-milestones');
    
    if (milestones.length === 0) {
        container.innerHTML = '<p class="stats-empty">Keep reading to unlock milestones!</p>';
        return;
    }
    
    container.innerHTML = milestones.map(m => `
        <div class="milestone-row">
            <span class="milestone-icon">${m.icon}</span>
            <span class="milestone-text">${m.text}</span>
        </div>
    `).join('');
}

function formatNumber(num) {
    return num.toLocaleString();
}

function formatLargeNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
}

function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const fillPercent = Math.min(100, Math.max(0, (rating - (i - 1)) * 100));
        html += `
            <span class="star">
                <span class="star-empty">★</span>
                <span class="star-fill" style="width: ${fillPercent}%">★</span>
            </span>
        `;
    }
    return html;
}

// Goodreads Scraping
async function fetchGoodreadsData(book) {
    const loadingEl = document.getElementById('goodreads-loading');
    const contentEl = document.getElementById('goodreads-content');
    const errorEl = document.getElementById('goodreads-error');
    
    // Reset state
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    
    try {
        const query = encodeURIComponent(`${book.title} ${book.author}`);
        const searchUrl = `https://www.goodreads.com/search?q=${query}`;
        
        // Use codetabs CORS proxy (more reliable)
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(searchUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch');
        
        const html = await response.text();
        
        // Find first book link using regex
        const bookLinkMatch = html.match(/href="(\/book\/show\/[^"]+)"/);
        if (!bookLinkMatch) throw new Error('Book not found');
        
        let bookPath = bookLinkMatch[1].replace(/&amp;/g, '&');
        const bookUrl = 'https://www.goodreads.com' + bookPath;
        
        // Update the view link
        document.getElementById('goodreads-link').href = bookUrl;
        
        // Fetch the book page
        const bookProxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(bookUrl)}`;
        const bookResponse = await fetch(bookProxyUrl);
        if (!bookResponse.ok) throw new Error('Failed to fetch book page');
        
        const bookHtml = await bookResponse.text();
        
        // Extract JSON-LD data (most reliable source)
        const ldMatch = bookHtml.match(/application\/ld\+json">(\{[^<]+\})/);
        let rating = null;
        let ratingCount = null;
        
        if (ldMatch) {
            try {
                const ldData = JSON.parse(ldMatch[1]);
                const aggRating = ldData.aggregateRating || {};
                rating = aggRating.ratingValue?.toString();
                ratingCount = aggRating.ratingCount;
                if (ratingCount) {
                    ratingCount = formatNumber(ratingCount);
                }
            } catch (e) {
                console.log('Could not parse JSON-LD');
            }
        }
        
        // Fallback: try to extract from HTML
        if (!rating) {
            const ratingMatch = bookHtml.match(/"ratingValue":([0-9.]+)/);
            if (ratingMatch) rating = ratingMatch[1];
        }
        
        // Extract reviews from Formatted spans (review text content)
        const reviews = [];
        const reviewMatches = bookHtml.matchAll(/<span[^>]*Formatted[^>]*>([^<]{50,500})/g);
        
        for (const match of reviewMatches) {
            if (reviews.length >= 3) break;
            let text = match[1].trim();
            // Skip author bio (usually first match)
            if (text.includes('widely known') || text.includes('was born') || text.includes('is an author')) continue;
            // Clean up HTML entities
            text = text.replace(/&amp;/g, '&')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>');
            if (text.length > 250) {
                text = text.substring(0, 250) + '...';
            }
            reviews.push(text);
        }
        
        // Display the data
        displayGoodreadsData(rating, ratingCount, reviews);
        
    } catch (error) {
        console.error('Goodreads fetch error:', error);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
    }
}

function displayCachedGoodreadsData(grData) {
    const loadingEl = document.getElementById('goodreads-loading');
    const contentEl = document.getElementById('goodreads-content');
    const errorEl = document.getElementById('goodreads-error');
    
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    
    // Set the link
    if (grData.url) {
        document.getElementById('goodreads-link').href = grData.url;
    }
    
    // Display rating with partial stars
    if (grData.rating) {
        document.getElementById('gr-stars').innerHTML = renderStars(grData.rating);
        document.getElementById('gr-rating').textContent = grData.rating.toFixed(2);
        document.getElementById('gr-count').textContent = grData.rating_count ? `(${formatNumber(grData.rating_count)} ratings)` : '';
    }
    
    // Display AI summary instead of individual reviews
    const reviewsContainer = document.getElementById('goodreads-reviews');
    if (grData.review_summary) {
        reviewsContainer.innerHTML = `
            <div class="gr-summary">
                <div class="gr-summary-label">✨ AI Summary of Goodreads Reviews</div>
                <p>${escapeHtml(grData.review_summary)}</p>
            </div>
        `;
    } else {
        reviewsContainer.innerHTML = '<p class="gr-no-reviews">No summary available</p>';
    }
}

function displayGoodreadsData(rating, ratingCount, reviews) {
    const loadingEl = document.getElementById('goodreads-loading');
    const contentEl = document.getElementById('goodreads-content');
    
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    
    // Display rating with partial stars
    if (rating) {
        document.getElementById('gr-stars').innerHTML = renderStars(parseFloat(rating));
        document.getElementById('gr-rating').textContent = rating;
        document.getElementById('gr-count').textContent = ratingCount ? `(${ratingCount} ratings)` : '';
    } else {
        document.getElementById('gr-stars').innerHTML = '';
        document.getElementById('gr-rating').textContent = 'No rating';
        document.getElementById('gr-count').textContent = '';
    }
    
    // Display reviews
    const reviewsContainer = document.getElementById('goodreads-reviews');
    if (reviews.length > 0) {
        reviewsContainer.innerHTML = reviews.map(review => `
            <div class="gr-review">
                <p>${escapeHtml(review)}</p>
            </div>
        `).join('');
    } else {
        reviewsContainer.innerHTML = '<p class="gr-no-reviews">No reviews available</p>';
    }
}
