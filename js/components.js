// Function to load HTML components
async function loadComponent(url, targetElementId) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
        }
        const html = await response.text();
        document.getElementById(targetElementId).innerHTML = html;
    } catch (error) {
        console.error(`Error loading component: ${error.message}`);
    }
}

// Load components when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('components/header.html', 'header-placeholder');
    loadComponent('components/footer.html', 'footer-placeholder');
}); 