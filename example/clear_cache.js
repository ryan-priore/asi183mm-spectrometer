// Script to clear browser cache and force reload of CSS
document.addEventListener('DOMContentLoaded', function() {
    // Add a timestamp parameter to CSS file to force reload
    const linkElement = document.querySelector('link[rel="stylesheet"]');
    if (linkElement) {
        const originalHref = linkElement.getAttribute('href');
        linkElement.setAttribute('href', originalHref + '?v=' + new Date().getTime());
        console.log('CSS cache busted with timestamp');
    }
}); 