// PIN Protection
const CORRECT_PIN = '9999';

// Check if already authenticated this session
if (sessionStorage.getItem('juju_authenticated') === 'true') {
    document.getElementById('pin-gate').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
} else {
    setupPinGate();
}

function setupPinGate() {
    const pinDigits = document.querySelectorAll('.pin-digit');
    const pinError = document.getElementById('pin-error');
    
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
                // Correct PIN
                sessionStorage.setItem('juju_authenticated', 'true');
                document.getElementById('pin-gate').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
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
    pinDigits[0].focus();
}

// JSONBin Configuration
const JSONBIN_BIN_ID = '692a5ff4d0ea881f4006f223';
const JSONBIN_API_KEY = '$2a$10$Mk1FfCJpoY8FIOQJrMLw..vkr/0x2cLx7xgOhlaa./Kgf1ZkQJLz6';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// State
let rankedBooks = JSON.parse(localStorage.getItem('beli_ranked_books')) || [];
let wishlistBooks = JSON.parse(localStorage.getItem('beli_wishlist_books')) || [];
let pendingBook = null;
let binarySearch = { low: 0, high: 0, mid: 0 };
let currentDetailBookIndex = null;
let currentDetailType = null; // 'ranked' or 'wishlist'
let activeTab = 'rankings';
let isSyncing = false;

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
document.addEventListener('DOMContentLoaded', async () => {
    // Try to load from cloud first, fall back to localStorage
    await loadFromCloud();
    renderRankings();
    renderWishlist();
    setupEventListeners();
});

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
                // Use cloud data if it exists
                if (data.record.rankedBooks && data.record.rankedBooks.length > 0) {
                    rankedBooks = data.record.rankedBooks;
                    localStorage.setItem('beli_ranked_books', JSON.stringify(rankedBooks));
                }
                if (data.record.wishlistBooks && data.record.wishlistBooks.length > 0) {
                    wishlistBooks = data.record.wishlistBooks;
                    localStorage.setItem('beli_wishlist_books', JSON.stringify(wishlistBooks));
                }
                console.log('Loaded data from cloud');
            }
        }
    } catch (error) {
        console.log('Could not load from cloud, using local data:', error);
    }
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
    document.getElementById('save-review-btn').addEventListener('click', saveReview);
    document.getElementById('delete-book-btn').addEventListener('click', showDeleteConfirm);
    document.getElementById('confirm-cancel').addEventListener('click', hideDeleteConfirm);
    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
    document.getElementById('rerank-btn').addEventListener('click', rerankBook);
    document.getElementById('move-to-rankings-btn').addEventListener('click', moveToRankings);
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
    
    if (rankedBooks.length === 0) {
        rankedBooks.push(book);
        saveAndRender();
    } else {
        pendingBook = book;
        startBinaryComparison();
    }
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
}

function saveWishlist() {
    localStorage.setItem('beli_wishlist_books', JSON.stringify(wishlistBooks));
    saveToCloud(); // Sync to cloud
}

function renderRankings() {
    if (rankedBooks.length === 0) {
        rankingsList.innerHTML = '<p class="empty-state">No books ranked yet. Search and add your first book!</p>';
        return;
    }
    
    rankingsList.innerHTML = rankedBooks.map((book, index) => {
        const score = calculateScore(index, rankedBooks.length);
        const coverUrl = book.coverId 
            ? `https://covers.openlibrary.org/b/id/${book.coverId}-S.jpg`
            : '';
        const hasReview = book.review && book.review.trim().length > 0;
        
        return `
            <div class="ranked-book" data-index="${index}">
                <div class="rank-badge">${index + 1}</div>
                ${coverUrl 
                    ? `<img class="cover-thumb" src="${coverUrl}" alt="">`
                    : `<div class="cover-thumb"></div>`
                }
                <div class="book-info">
                    <div class="book-title">${escapeHtml(book.title)}</div>
                    <div class="book-author">${escapeHtml(book.author)}</div>
                </div>
                ${hasReview ? '<div class="has-review" title="Has review"></div>' : ''}
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
        const score = calculateScore(index, rankedBooks.length);
        document.getElementById('detail-rank').innerHTML = `Rank: <strong>#${index + 1}</strong>`;
        document.getElementById('detail-score').innerHTML = `Score: <strong>${score.toFixed(1)}</strong>`;
        detailMeta.style.display = 'flex';
        reviewSection.style.display = 'block';
        rerankBtn.classList.remove('hidden');
        moveBtn.classList.add('hidden');
        document.getElementById('review-textarea').value = book.review || '';
    } else {
        detailMeta.style.display = 'none';
        reviewSection.style.display = 'none';
        rerankBtn.classList.add('hidden');
        moveBtn.classList.remove('hidden');
    }
    
    const coverEl = document.getElementById('detail-cover');
    if (book.coverId) {
        coverEl.style.backgroundImage = `url(https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg)`;
    } else {
        coverEl.style.backgroundImage = '';
    }
    
    // Reset delete confirmation
    hideDeleteConfirm();
    
    bookDetailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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
    
    const btn = document.getElementById('save-review-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 1000);
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
    
    // Add to rankings
    if (rankedBooks.length === 0) {
        rankedBooks.push(book);
        saveAndRender();
        switchTab('rankings');
    } else {
        pendingBook = book;
        startBinaryComparison();
    }
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
