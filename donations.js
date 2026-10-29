// Donations page script for UniShield extension
// Strictly DOM-safe: no innerHTML assignments.

document.addEventListener('DOMContentLoaded', () => {
    function openUrl(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    const donationActions = {
        paypal: () => openUrl('https://paypal.me/facumartinez680'),
        kofi: () => openUrl('https://ko-fi.com/biocoder'),
        mercadopago: () => openUrl('https://link.mercadopago.com.ar/betterlinkedin')
    };

    const buttons = document.querySelectorAll('.cta-button[data-action]');
    buttons.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const action = button.getAttribute('data-action');
            if (action && typeof donationActions[action] === 'function') {
                donationActions[action]();
            }
        });
    });
});
