const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const DEFAULT_CONFIG = {
    global: {
        enabled: true,
        stats: {
            totalHidden: 0,
            sessionHidden: 0,
            redditHidden: 0,
            xHidden: 0,
            linkedinHidden: 0
        }
    },
    reddit: {
        enabled: true,
        mode: 'hide',
        detectBotPatterns: false,
        removePromoted: true,
        removeRacism: true,
        removeGenderWar: true,
        removeEditorializedTitles: true,
        subredditBlocklist: [],
        allowlist: [],
        userBlocklist: [],
        mutedKeywords: []
    },
    x: {
        enabled: true,
        removeBlueCheckmark: false,
        removeGreyCheckmark: false,
        removeGoldCheckmark: false,
        removePromoted: true,
        removeAITweets: false,
        removeCryptoScams: true,
        removeBroetryPosts: false,
        removePoliticalRagebait: false,
        politicalStrictness: 0,
        removeRacism: true,
        removeGenderWar: true,
        userBlocklist: [],
        allowlist: [],
        mutedKeywords: []
    },
    linkedin: {
        enabled: true,
        removePromotedPosts: true,
        removeSuggestedPosts: true,
        removeByInteractions: false,
        removeAIPosts: false,
        removeBroetryPosts: false,
        removePostsWithEmojis: false,
        removePromotedJobs: true,
        jobAgeAlerts: true,
        jobRedFlags: true,
        detectFakeProfiles: true,
        enableProfileNotes: true,
        mutedWords: [],
        mutedCompanies: []
    }
};

// Initialize on install
browserAPI.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        const result = await browserAPI.storage.local.get(['config']);
        if (!result.config) {
            await browserAPI.storage.local.set({ config: DEFAULT_CONFIG });
        }
        browserAPI.tabs.create({ url: 'welcome.html' });
    }
});

// Broadcast config updates to all supported tabs
function broadcastConfigUpdate() {
    const supportedUrls = [
        '*://*.reddit.com/*',
        '*://*.x.com/*',
        '*://*.twitter.com/*',
        '*://*.linkedin.com/*'
    ];

    supportedUrls.forEach(urlPattern => {
        browserAPI.tabs.query({ url: urlPattern }, (tabs) => {
            if (tabs && tabs.length > 0) {
                tabs.forEach(tab => {
                    browserAPI.tabs.sendMessage(tab.id, { type: 'UNISHIELD_CONFIG_UPDATED' }).catch(() => { });
                });
            }
        });
    });
}

// Message listener
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UNISHIELD_CONFIG_UPDATED') {
        broadcastConfigUpdate();
        sendResponse({ success: true });
        return false;
    }

    if (message.type === 'UNISHIELD_GET_STATS') {
        // Forward stats request to active tab
        browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.url && (activeTab.url.includes('reddit.com') || activeTab.url.includes('x.com') || activeTab.url.includes('twitter.com') || activeTab.url.includes('linkedin.com'))) {
                browserAPI.tabs.sendMessage(activeTab.id, { type: 'UNISHIELD_GET_STATS' }, (response) => {
                    if (browserAPI.runtime.lastError) {
                        sendResponse({ pageBlocked: 0 });
                        return;
                    }
                    sendResponse(response || { pageBlocked: 0 });
                });
            } else {
                sendResponse({ pageBlocked: 0 });
            }
        });
        return true; // Indicates async response
    }
});
