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
        if (!postsSection) return;
        
        fetch('/js/posts.json')
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

    // Call the function when the page loads
    loadRecentPosts();
}); 