const CLIENT_ID = '940d340161524f1e836a778c951cb3e6';
const CLIENT_SECRET = '26169bca33da434c955bc8b00e0b4dc9';
const REDIRECT_URI = 'https://eddykamwi.github.io/nikulimba'; // Update this to your server URL

class SpotifyAPI {
    constructor() {
        this.accessToken = null;
        this.player = null;
        this.initialize();
    }

    async initialize() {
        // Check if we're returning from auth redirect
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
            this.redirectToAuth();
        } else {
            await this.getAccessToken(code);
            await this.initializePlayer();
            this.loadContent();
        }
    }

    redirectToAuth() {
        const scopes = [
            'streaming',
            'user-read-email',
            'user-read-private',
            'user-library-read',
            'user-library-modify',
            'user-read-playback-state',
            'user-modify-playback-state'
        ];

        const authUrl = new URL('https://accounts.spotify.com/authorize');
        authUrl.searchParams.append('client_id', CLIENT_ID);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.append('scope', scopes.join(' '));

        window.location.href = authUrl.toString();
    }

    async getAccessToken(code) {
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI
                })
            });

            const data = await response.json();
            this.accessToken = data.access_token;
        } catch (error) {
            console.error('Error getting access token:', error);
        }
    }

    async initializePlayer() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;

            document.body.appendChild(script);

            window.onSpotifyWebPlaybackSDKReady = () => {
                this.player = new Spotify.Player({
                    name: 'Web Playback SDK',
                    getOAuthToken: cb => { cb(this.accessToken); }
                });

                this.player.connect();
                this.player.addListener('ready', ({ device_id }) => {
                    this.deviceId = device_id;
                    resolve();
                });
            };
        });
    }

    async playTrack(uri) {
        try {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: [uri]
                })
            });
        } catch (error) {
            console.error('Error playing track:', error);
        }
    }

    async fetchFromSpotify(endpoint) {
        try {
            const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching from Spotify:', error);
            return null;
        }
    }

    async loadContent() {
        // Load featured playlists
        const featuredPlaylists = await this.fetchFromSpotify('browse/featured-playlists');
        this.displayPlaylists(featuredPlaylists.playlists.items, 'recommended-playlists');

        // Load charts (top playlists)
        const charts = await this.fetchFromSpotify('browse/categories/toplists/playlists');
        this.displayPlaylists(charts.playlists.items, 'featured-charts');
    }

    displayPlaylists(playlists, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        playlists.forEach(playlist => {
            const playlistElement = document.createElement('div');
            playlistElement.className = 'playlist-card';
            playlistElement.innerHTML = `
                <img src="${playlist.images[0].url}" alt="${playlist.name}">
                <h3>${playlist.name}</h3>
                <p>${playlist.description || 'Spotify Playlist'}</p>
            `;

            // Add click handler for playlist
            playlistElement.addEventListener('click', async () => {
                const tracks = await this.fetchFromSpotify(`playlists/${playlist.id}/tracks`);
                if (tracks.items.length > 0) {
                    const firstTrack = tracks.items[0].track;
                    this.playTrack(firstTrack.uri);
                }
            });

            container.appendChild(playlistElement);
        });
    }
}

// Initialize the app
const spotifyApp = new SpotifyAPI();

// Add event listeners for player controls
document.getElementById('play-pause').addEventListener('click', function () {
    const icon = this.querySelector('i');
    if (icon.classList.contains('fa-play')) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
});

// Search functionality
const searchInput = document.querySelector('.search-bar input');
searchInput.addEventListener('input', async (e) => {
    if (e.target.value.trim()) {
        const searchResults = await spotifyApp.fetchFromSpotify(`search?q=${encodeURIComponent(e.target.value)}&type=playlist`);
        spotifyApp.displayPlaylists(searchResults.playlists.items, 'recommended-playlists');
    } else {
        spotifyApp.loadContent();
    }
});