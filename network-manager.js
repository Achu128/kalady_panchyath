/**
 * Network Quality Monitor & Adaptive UI for WebGIS
 * Automatically manages offline indicators, weak-connection optimizations, and PWA registration.
 */

(function() {
    'use strict';

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            var swUrl = window.location.pathname.includes('/mapsss/') ? './sw.js' : './sw.js';
            navigator.serviceWorker.register(swUrl)
                .then(function(reg) {
                    console.log('[WebGIS PWA] Service Worker registered with scope:', reg.scope);
                })
                .catch(function(err) {
                    console.warn('[WebGIS PWA] Service Worker registration failed:', err);
                });
        });
    }

    // 2. Build Status UI Badge & Notification Bar
    var container = document.createElement('div');
    container.id = 'webgis-network-container';
    container.innerHTML = `
        <style>
            #webgis-network-badge {
                position: fixed;
                bottom: 16px;
                left: 16px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(16, 60, 48, 0.92);
                color: #eaf3ed;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                font-size: 12px;
                font-weight: 600;
                padding: 6px 12px;
                border-radius: 20px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.25);
                backdrop-filter: blur(6px);
                transition: all 0.3s ease;
                user-select: none;
                cursor: pointer;
            }
            #webgis-network-badge .dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #2ecc71;
                box-shadow: 0 0 6px #2ecc71;
                transition: background 0.3s ease;
            }
            #webgis-network-badge.weak .dot {
                background: #f1c40f;
                box-shadow: 0 0 6px #f1c40f;
            }
            #webgis-network-badge.offline .dot {
                background: #e74c3c;
                box-shadow: 0 0 6px #e74c3c;
            }
            #webgis-offline-banner {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                background: #b03a2e;
                color: #fff;
                font-family: sans-serif;
                font-size: 13px;
                font-weight: 500;
                text-align: center;
                padding: 8px 12px;
                z-index: 99999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            #webgis-layer-toast {
                display: none;
                position: fixed;
                top: 18px;
                right: 18px;
                background: rgba(16, 60, 48, 0.95);
                color: #fff;
                padding: 10px 16px;
                border-radius: 6px;
                font-family: sans-serif;
                font-size: 13px;
                z-index: 10000;
                box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                border-left: 4px solid #d9b66f;
            }
        </style>
        <div id="webgis-offline-banner">
            ⚠️ Offline Mode &mdash; Displaying cached Kalady GIS layers. Live map updates will resume when online.
        </div>
        <div id="webgis-network-badge" title="Click to view network performance info">
            <span class="dot"></span>
            <span id="webgis-status-text">Online</span>
        </div>
        <div id="webgis-layer-toast"></div>
    `;

    document.addEventListener('DOMContentLoaded', function() {
        document.body.appendChild(container);
        initNetworkMonitoring();
    });

    // 3. Network Detection & Adaptive Logic
    function initNetworkMonitoring() {
        var badge = document.getElementById('webgis-network-badge');
        var statusText = document.getElementById('webgis-status-text');
        var banner = document.getElementById('webgis-offline-banner');

        function updateNetworkStatus() {
            var isOnline = navigator.onLine;
            var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            var isSlow = conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData);

            if (!isOnline) {
                badge.className = 'offline';
                statusText.innerText = 'Offline (Cached Mode)';
                banner.style.display = 'block';
            } else if (isSlow) {
                badge.className = 'weak';
                statusText.innerText = 'Weak Network (' + (conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Slow') + ')';
                banner.style.display = 'none';
            } else {
                badge.className = '';
                var speed = conn && conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Fast';
                statusText.innerText = 'Online (' + speed + ')';
                banner.style.display = 'none';
            }
        }

        window.addEventListener('online', function() {
            updateNetworkStatus();
            showToast('🌐 Network connection restored. Live GIS services active.');
        });

        window.addEventListener('offline', function() {
            updateNetworkStatus();
            showToast('⚠️ Network disconnected. Running on cached spatial data.');
        });

        if (navigator.connection) {
            navigator.connection.addEventListener('change', updateNetworkStatus);
        }

        updateNetworkStatus();
    }

    // 4. Toast notification helper
    function showToast(msg, duration) {
        var toast = document.getElementById('webgis-layer-toast');
        if (!toast) return;
        toast.innerHTML = msg;
        toast.style.display = 'block';
        setTimeout(function() {
            toast.style.display = 'none';
        }, duration || 3500);
    }

    // 5. Listen for layer loading events from layers.js
    window.addEventListener('gis-layer-loading', function(e) {
        var detail = e.detail || {};
        if (detail.status === 'loading') {
            showToast('⏳ Loading ' + detail.layer + ' layer data on demand...', 5000);
        } else if (detail.status === 'loaded') {
            showToast('✅ ' + detail.layer + ' loaded successfully (' + (detail.count || '') + ' features)', 2800);
        } else if (detail.status === 'error') {
            showToast('❌ Failed to load ' + detail.layer + '. Check connection or cache.', 4000);
        }
    });

    window.WebGISNetwork = {
        showToast: showToast
    };
})();

