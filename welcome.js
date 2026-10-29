// Welcome page script for UniShield extension

document.addEventListener('DOMContentLoaded', () => {
    function openOptionsPage() {
        const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
        if (browserAPI && browserAPI.runtime && typeof browserAPI.runtime.openOptionsPage === 'function') {
            browserAPI.runtime.openOptionsPage();
        } else {
            window.location.href = 'options/options.html';
        }
    }

    const heroBtn = document.getElementById('heroOptionsBtn');
    if (heroBtn) {
        heroBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openOptionsPage();
        });
    }

    const headerBtn = document.getElementById('headerSettingsBtn');
    if (headerBtn) {
        headerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openOptionsPage();
        });
    }
});
