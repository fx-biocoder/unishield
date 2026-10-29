(function() {
    'use strict';

    const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {});
    const getStorage = () => window.UniShield && window.UniShield.Storage;

    const masterToggle = document.getElementById('masterToggle');
    const statusBadge = document.getElementById('statusBadge');
    const toggleSubtitle = document.getElementById('toggleSubtitle');
    const sessionCounter = document.getElementById('sessionCounter');
    const openOptionsBtn = document.getElementById('openOptionsBtn');

    /**
     * Updates the UI based on whether filters are active
     */
    function updateStateUI(enabled) {
        masterToggle.checked = enabled;
        if (enabled) {
            statusBadge.textContent = typeof t === 'function' ? t('active') : 'Active';
            statusBadge.className = 'status-badge status-active';
            toggleSubtitle.textContent = typeof t === 'function' ? t('filteringActive') : 'Filtering unwanted content';
        } else {
            statusBadge.textContent = typeof t === 'function' ? t('paused') : 'Paused';
            statusBadge.className = 'status-badge status-paused';
            toggleSubtitle.textContent = typeof t === 'function' ? t('filteringPaused') : 'Filters are currently paused';
        }
    }

    /**
     * Initializes popup state
     */
    async function init() {
        const storage = getStorage();
        if (!storage) return;

        const config = await storage.getConfig();
        const isEnabled = config.global ? config.global.enabled !== false : true;
        updateStateUI(isEnabled);

        // Update stats
        const sessionCount = (config.global && config.global.stats && config.global.stats.sessionHidden) || 0;
        sessionCounter.textContent = sessionCount;

        // Try getting page-specific stats from current active tab
        browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs && tabs[0];
            if (activeTab && activeTab.id) {
                browserAPI.tabs.sendMessage(activeTab.id, { type: 'UNISHIELD_GET_STATS' }, (response) => {
                    if (browserAPI.runtime.lastError) return;
                    if (response && response.pageBlocked !== undefined) {
                        sessionCounter.textContent = response.pageBlocked;
                    }
                });
            }
        });

        // Event listeners
        masterToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            updateStateUI(enabled);

            await storage.setConfig({
                global: { enabled }
            });

            // Notify background and active tabs
            browserAPI.runtime.sendMessage({ type: 'UNISHIELD_CONFIG_UPDATED' }).catch(() => {});
        });

        openOptionsBtn.addEventListener('click', () => {
            browserAPI.runtime.openOptionsPage();
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
