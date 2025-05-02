// Script to clear browser cache and force reload of CSS and JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Add a timestamp parameter to CSS file to force reload
    const linkElement = document.querySelector('link[rel="stylesheet"]');
    if (linkElement) {
        const originalHref = linkElement.getAttribute('href');
        linkElement.setAttribute('href', originalHref + '?v=' + new Date().getTime());
        console.log('CSS cache busted with timestamp');
    }
    
    // Force reload of JavaScript file
    const scriptElements = document.querySelectorAll('script');
    scriptElements.forEach(script => {
        if (script.src && script.src.includes('script.js')) {
            const originalSrc = script.getAttribute('src');
            script.setAttribute('src', originalSrc + '?v=' + new Date().getTime());
            console.log('JavaScript cache busted with timestamp');
        }
    });
}); 