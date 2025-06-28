document.addEventListener('DOMContentLoaded', function() {
    // Set active navigation link
    const currentLocation = window.location.pathname;
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (currentLocation.includes(linkPath) && linkPath !== '/' && linkPath !== '#' && linkPath !== 'index.html') {
            link.classList.add('active');
        } else if (currentLocation.endsWith('/') || currentLocation.endsWith('index.html')) {
            if (linkPath === '/' || linkPath === 'index.html' || linkPath === '#') {
                link.classList.add('active');
            }
        }
    });
    
    // Simple form validation for contact form
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;
            
            if (!name || !email || !message) {
                alert('Please fill out all fields');
                return;
            }
            
            if (!validateEmail(email)) {
                alert('Please enter a valid email address');
                return;
            }
            
            // Here you would normally send the form data to a server
            alert('Thanks for your message! In a real website, this would be sent to the server.');
            contactForm.reset();
        });
    }
    
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    // Function to load recent posts
    function loadRecentPosts() {
        // Only proceed if we're on the homepage (has posts section)
        const postsSection = document.querySelector('.posts .container');
        if (!postsSection || document.getElementById('posts-container')) return; // Skip if it's the blog page
        
        fetch('js/posts.json')
            .then(response => response.json())
            .then(posts => {
                // Sort posts by date (newest first)
                posts.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Get the three most recent posts
                const recentPosts = posts.slice(0, 3);
                
                // Clear existing posts (except the heading)
                const heading = postsSection.querySelector('h2');
                postsSection.innerHTML = '';
                postsSection.appendChild(heading);
                
                // Create HTML for each recent post
                recentPosts.forEach(post => {
                    const postDate = new Date(post.date);
                    const formattedDate = postDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'UTC'
                    });
                    
                    const postHTML = `
                        <article class="post">
                            <div class="post-date">${formattedDate}</div>
                            <h3 class="post-title"><a href="posts/${post.slug}.html">${post.title}</a></h3>
                            <p class="post-excerpt">${post.excerpt}</p>
                            <a href="posts/${post.slug}.html" class="read-more">Read More →</a>
                        </article>
                    `;
                    
                    postsSection.innerHTML += postHTML;
                });
            })
            .catch(error => {
                console.error('Error loading posts:', error);
            });
    }

    // Pagination variables
    let allPosts = [];
    let filteredPosts = [];
    let currentPage = 1;
    const postsPerPage = 4;

    // Function to load all posts for blog page with pagination
    function loadAllPosts() {
        // Only proceed if we're on the blog page
        const isBlogPage = window.location.pathname.includes('blog.html');
        console.log('Current pathname:', window.location.pathname);
        console.log('Is blog page:', isBlogPage);
        
        if (!isBlogPage) return;
        
        const postsContainer = document.getElementById('posts-container');
        const loadingElement = document.getElementById('posts-loading');
        
        console.log('Posts container found:', !!postsContainer);
        console.log('Loading element found:', !!loadingElement);
        
        if (!postsContainer) return;
        
        // Use relative path instead of absolute path
        fetch('js/posts.json')
            .then(response => {
                console.log('Fetch response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(posts => {
                console.log('Posts loaded:', posts.length);
                
                // Sort posts by date (newest first)
                posts.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Store all posts globally
                allPosts = posts;
                filteredPosts = [...posts]; // Initially all posts are visible
                
                // Hide loading message
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                
                // Render posts for current page
                renderPostsPage();
                
                // Initialize pagination controls
                initializePagination();
                
                console.log('Posts rendered, initializing filters...');
                // Initialize filtering after posts are loaded
                initializeBlogFilters();
            })
            .catch(error => {
                console.error('Error loading posts:', error);
                if (loadingElement) {
                    loadingElement.innerHTML = '<p style="text-align: center; padding: 40px 0; color: var(--secondary);">Error loading posts. Please try again later.</p>';
                }
            });
    }

    // Function to render posts for current page
    function renderPostsPage() {
        const postsContainer = document.getElementById('posts-container');
        if (!postsContainer) return;
        
        // Clear existing posts
        postsContainer.innerHTML = '';
        
        // Calculate start and end indices for current page
        const startIndex = (currentPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        const postsToShow = filteredPosts.slice(startIndex, endIndex);
        
        // Render posts for current page
        postsToShow.forEach(post => {
            const postDate = new Date(post.date);
            const formattedDate = postDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });
            
            const postElement = document.createElement('article');
            postElement.className = 'post';
            postElement.setAttribute('data-category', post.category || 'All');
            postElement.innerHTML = `
                <div class="post-date">${formattedDate}</div>
                <h3 class="post-title"><a href="posts/${post.slug}.html">${post.title}</a></h3>
                <p class="post-excerpt">${post.excerpt}</p>
                <a href="posts/${post.slug}.html" class="read-more">Read More →</a>
            `;
            
            postsContainer.appendChild(postElement);
        });
        
        // Update pagination controls
        updatePaginationControls();
        
        // Show no results message if needed
        showNoResultsMessage(filteredPosts.length === 0);
    }

    // Function to initialize pagination controls
    function initializePagination() {
        const paginationContainer = document.getElementById('pagination-container');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (!paginationContainer || !prevBtn || !nextBtn) return;
        
        // Show pagination if there are posts to paginate
        if (filteredPosts.length > postsPerPage) {
            paginationContainer.style.display = 'block';
        }
        
        // Previous button click handler
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPostsPage();
            }
        });
        
        // Next button click handler
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderPostsPage();
            }
        });
    }

    // Function to update pagination controls
    function updatePaginationControls() {
        const paginationContainer = document.getElementById('pagination-container');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageNumbers = document.getElementById('page-numbers');
        const postsInfo = document.getElementById('posts-info');
        
        if (!paginationContainer || !prevBtn || !nextBtn || !pageNumbers || !postsInfo) return;
        
        const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
        
        console.log('Updating pagination - Total pages:', totalPages, 'Current page:', currentPage);
        console.log('Filtered posts length:', filteredPosts.length, 'Posts per page:', postsPerPage);
        
        // Show/hide pagination based on whether we need it
        if (filteredPosts.length <= postsPerPage) {
            console.log('Hiding pagination - not enough posts');
            paginationContainer.style.display = 'none';
            return;
        } else {
            console.log('Showing pagination - multiple pages needed');
            paginationContainer.style.display = 'block';
        }
        
        // Update previous button
        prevBtn.disabled = currentPage === 1;
        
        // Update next button
        nextBtn.disabled = currentPage === totalPages;
        
        // Update page numbers
        pageNumbers.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'page-number';
            pageBtn.textContent = i;
            pageBtn.classList.toggle('active', i === currentPage);
            
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                renderPostsPage();
            });
            
            pageNumbers.appendChild(pageBtn);
        }
        
        // Update posts info
        const startPost = (currentPage - 1) * postsPerPage + 1;
        const endPost = Math.min(currentPage * postsPerPage, filteredPosts.length);
        postsInfo.textContent = `Showing ${startPost}-${endPost} of ${filteredPosts.length} posts`;
        
        console.log('Posts info updated:', postsInfo.textContent);
    }

    // Blog search and filtering functionality with pagination
    function initializeBlogFilters() {
        // Only run on blog page
        const isBlogPage = window.location.pathname.includes('blog.html');
        if (!isBlogPage) return;
        
        const searchInput = document.querySelector('.search-bar input');
        const categoryButtons = document.querySelectorAll('.category');
        
        if (!searchInput || !categoryButtons.length || !allPosts.length) return;
        
        let currentCategory = 'All';
        let currentSearchTerm = '';
        
        // Search functionality
        searchInput.addEventListener('input', function(e) {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            filterPosts();
        });
        
        // Category filtering
        categoryButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                currentCategory = this.textContent.trim();
                filterPosts();
            });
        });
        
        function filterPosts() {
            console.log('Filtering posts - Category:', currentCategory, 'Search:', currentSearchTerm);
            
            // Filter posts based on search term and category
            filteredPosts = allPosts.filter(post => {
                const title = post.title.toLowerCase();
                const excerpt = post.excerpt.toLowerCase();
                const searchText = title + ' ' + excerpt;
                const postCategory = post.category || '';
                
                // Check search term match
                const matchesSearch = currentSearchTerm === '' || 
                                    searchText.includes(currentSearchTerm);
                
                // Check category match
                const matchesCategory = currentCategory === 'All' || 
                                      postCategory === currentCategory;
                
                return matchesSearch && matchesCategory;
            });
            
            console.log('Filtered posts:', filteredPosts.length, 'posts found');
            console.log('Posts per page:', postsPerPage);
            
            // Reset to page 1 when filtering
            currentPage = 1;
            
            // Re-render posts with new filter
            renderPostsPage();
        }
    }

    // Function to show no results message
    function showNoResultsMessage(show) {
        let noResultsMsg = document.querySelector('.no-results-message');
        
        if (show && !noResultsMsg) {
            // Create and show no results message
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-message';
            noResultsMsg.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: var(--secondary);">
                    <p>No posts found matching your search criteria.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Try adjusting your search terms or selecting a different category.</p>
                </div>
            `;
            document.getElementById('posts-container').appendChild(noResultsMsg);
        } else if (!show && noResultsMsg) {
            // Hide no results message
            noResultsMsg.remove();
        }
    }

    // Load posts based on the current page
    loadAllPosts(); // Load all posts for blog page
    loadRecentPosts(); // Load recent posts for homepage
}); 