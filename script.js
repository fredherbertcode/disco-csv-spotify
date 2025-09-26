class DiscogsToSpotifyConverter {
    constructor() {
        this.csvData = [];
        this.spotifyApi = null;
        this.spotifyToken = null;
        this.userId = null;
        this.playlistId = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const csvFile = document.getElementById('csvFile');
        const uploadArea = document.getElementById('uploadArea');
        const spotifyLogin = document.getElementById('spotifyLogin');
        const startConversion = document.getElementById('startConversion');

        csvFile.addEventListener('change', (e) => this.handleFileSelect(e));

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processCSVFile(files[0]);
            }
        });

        spotifyLogin.addEventListener('click', async () => await this.authenticateSpotify());
        startConversion.addEventListener('click', () => this.startConversion());
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            await this.processCSVFile(file);
        }
    }

    async processCSVFile(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showStatus('Please select a CSV file.', 'error');
            return;
        }

        try {
            const text = await this.readFileAsText(file);
            this.csvData = this.parseCSV(text);
            this.displayCSVPreview();
            this.showStep(2);
        } catch (error) {
            this.showStatus('Error reading CSV file: ' + error.message, 'error');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseCSV(text) {
        const lines = text.split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = this.parseCSVLine(lines[i]);
                const record = {};
                headers.forEach((header, index) => {
                    record[header.trim()] = values[index] ? values[index].trim() : '';
                });
                data.push(record);
            }
        }

        return data;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current);
        return values;
    }

    displayCSVPreview() {
        const preview = document.getElementById('csvPreview');
        preview.classList.remove('hidden');

        if (this.csvData.length === 0) {
            preview.innerHTML = '<p>No data found in CSV file.</p>';
            return;
        }

        const headers = Object.keys(this.csvData[0]);
        const relevantHeaders = headers.filter(h =>
            ['artist', 'title', 'label', 'format', 'catalog#'].some(key =>
                h.toLowerCase().includes(key.toLowerCase())
            )
        );

        let html = '<div class="csv-preview"><h3>CSV Preview (showing first 5 records)</h3>';
        html += '<table><thead><tr>';

        relevantHeaders.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead><tbody>';

        const previewCount = Math.min(5, this.csvData.length);
        for (let i = 0; i < previewCount; i++) {
            html += '<tr>';
            relevantHeaders.forEach(header => {
                html += `<td>${this.csvData[i][header] || ''}</td>`;
            });
            html += '</tr>';
        }

        html += '</tbody></table>';
        html += `<p><strong>Total records:</strong> ${this.csvData.length}</p></div>`;

        preview.innerHTML = html;
    }

    async authenticateSpotify() {
        // Generate PKCE code verifier and challenge
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // Store code verifier for later use
        localStorage.setItem('code_verifier', codeVerifier);

        const authUrl = 'https://accounts.spotify.com/authorize?' +
            new URLSearchParams({
                response_type: 'code',
                client_id: SPOTIFY_CONFIG.CLIENT_ID,
                scope: SPOTIFY_CONFIG.SCOPES,
                redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
                code_challenge_method: 'S256',
                code_challenge: codeChallenge,
                show_dialog: 'true'
            });

        window.location.href = authUrl;
    }

    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        return crypto.subtle.digest('SHA-256', data).then(digest => {
            return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        });
    }

    async checkSpotifyAuth() {
        // Check for authorization code in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
            this.showStatus('Authentication failed: ' + error, 'error');
            return false;
        }

        if (code) {
            try {
                await this.exchangeCodeForToken(code);
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            } catch (error) {
                this.showStatus('Failed to get access token: ' + error.message, 'error');
                return false;
            }
        }

        return false;
    }

    async exchangeCodeForToken(code) {
        const codeVerifier = localStorage.getItem('code_verifier');
        if (!codeVerifier) {
            throw new Error('Code verifier not found');
        }

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
                client_id: SPOTIFY_CONFIG.CLIENT_ID,
                code_verifier: codeVerifier,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error_description || 'Token exchange failed');
        }

        const tokenData = await response.json();
        this.spotifyToken = tokenData.access_token;

        // Clean up
        localStorage.removeItem('code_verifier');

        await this.initializeSpotifyApi();
    }

    async initializeSpotifyApi() {
        try {
            const response = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${this.spotifyToken}`
                }
            });

            if (response.ok) {
                const user = await response.json();
                this.userId = user.id;

                const status = document.getElementById('spotifyStatus');
                status.classList.remove('hidden');
                status.innerHTML = `<div class="status-success">✅ Connected as ${user.display_name}</div>`;

                document.getElementById('playlistName').value = `My Discogs Collection Albums (${new Date().toLocaleDateString()})`;
                console.log('Authentication successful, showing step 4');
                this.showStep(4);
            } else {
                throw new Error('Failed to get user info');
            }
        } catch (error) {
            this.showStatus('Failed to connect to Spotify: ' + error.message, 'error');
        }
    }

    async startConversion() {
        const playlistName = document.getElementById('playlistName').value || 'My Discogs Collection';
        const playlistDescription = document.getElementById('playlistDescription').value || 'Converted from Discogs collection';
        const isPublic = document.getElementById('publicPlaylist').checked;

        try {
            document.getElementById('startConversion').disabled = true;
            document.getElementById('progress').classList.remove('hidden');

            await this.createPlaylist(playlistName, playlistDescription, isPublic);
            await this.searchAndAddTracks();

        } catch (error) {
            this.showStatus('Conversion failed: ' + error.message, 'error');
        } finally {
            document.getElementById('startConversion').disabled = false;
        }
    }

    async createPlaylist(name, description, isPublic) {
        const response = await fetch(`https://api.spotify.com/v1/users/${this.userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.spotifyToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                public: isPublic
            })
        });

        if (response.ok) {
            const playlist = await response.json();
            this.playlistId = playlist.id;
            this.updateProgress(0, `Created playlist: ${name}`);
        } else {
            throw new Error('Failed to create playlist');
        }
    }

    async searchAndAddTracks() {
        const trackUris = [];
        const notFound = [];
        const foundAlbums = [];
        const total = this.csvData.length;

        for (let i = 0; i < this.csvData.length; i++) {
            const record = this.csvData[i];
            const artist = this.getFieldValue(record, ['artist', 'Artist']);
            const albumTitle = this.getFieldValue(record, ['title', 'Title']);

            if (!artist || !albumTitle) {
                notFound.push(`${artist || 'Unknown'} - ${albumTitle || 'Unknown'}`);
                continue;
            }

            try {
                this.updateProgress((i + 1) / total * 80, `Searching: ${artist} - ${albumTitle}`);

                let found = false;
                let album = null;

                // Strategy 1: Search for albums with exact quotes
                const exactSearchQuery = `album:"${albumTitle}" artist:"${artist}"`;
                const albumResponse = await fetch(
                    `https://api.spotify.com/v1/search?${new URLSearchParams({
                        q: exactSearchQuery,
                        type: 'album',
                        limit: 5
                    })}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.spotifyToken}`
                        }
                    }
                );

                if (albumResponse.ok) {
                    const albumData = await albumResponse.json();
                    if (albumData.albums.items.length > 0) {
                        album = albumData.albums.items[0];
                        found = true;
                    }
                }

                // Strategy 2: Fallback search without quotes (broader matching)
                if (!found) {
                    const cleanTitle = albumTitle.replace(/[^\w\s]/g, '').trim();
                    const broadSearchQuery = `${cleanTitle} ${artist}`;

                    const response = await fetch(
                        `https://api.spotify.com/v1/search?${new URLSearchParams({
                            q: broadSearchQuery,
                            type: 'album',
                            limit: 10
                        })}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.spotifyToken}`
                            }
                        }
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.albums.items.length > 0) {
                            // Try to find best match by artist name similarity
                            const bestMatch = data.albums.items.find(item =>
                                item.artists.some(a =>
                                    a.name.toLowerCase().includes(artist.toLowerCase()) ||
                                    artist.toLowerCase().includes(a.name.toLowerCase())
                                )
                            );

                            if (bestMatch) {
                                album = bestMatch;
                                found = true;
                            }
                        }
                    }
                }

                if (found && album) {
                    foundAlbums.push(`${artist} - ${albumTitle}`);

                    // Get all tracks from the album/single
                    const tracksResponse = await fetch(
                        `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.spotifyToken}`
                            }
                        }
                    );

                    if (tracksResponse.ok) {
                        const tracksData = await tracksResponse.json();
                        const albumTrackUris = tracksData.items.map(track => track.uri);
                        trackUris.push(...albumTrackUris);

                        this.updateProgress((i + 1) / total * 80, `Found ${tracksData.items.length} tracks from: ${artist} - ${albumTitle}`);
                    }
                } else {
                    notFound.push(`${artist} - ${albumTitle}`);
                }

                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                notFound.push(`${artist} - ${albumTitle}`);
            }
        }

        if (trackUris.length > 0) {
            await this.addTracksToPlaylist(trackUris);
        }

        this.showResults(trackUris.length, notFound, foundAlbums);
    }

    async addTracksToPlaylist(trackUris) {
        const batchSize = 100;
        for (let i = 0; i < trackUris.length; i += batchSize) {
            const batch = trackUris.slice(i, i + batchSize);

            const response = await fetch(`https://api.spotify.com/v1/playlists/${this.playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.spotifyToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: batch
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add tracks to playlist');
            }

            this.updateProgress(90 + (i / trackUris.length) * 10, `Adding tracks to playlist...`);
        }
    }

    getFieldValue(record, possibleFields) {
        for (const field of possibleFields) {
            if (record[field]) {
                return record[field];
            }
        }
        return '';
    }

    updateProgress(percentage, text) {
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = text;
    }

    showResults(foundTrackCount, notFound, foundAlbums = []) {
        this.updateProgress(100, 'Conversion complete!');

        const results = document.getElementById('results');
        results.classList.remove('hidden');

        let html = '<div class="results-summary">';
        html += '<h3>Conversion Results</h3>';
        html += '<div class="results-stats">';
        html += `<div class="stat-item"><div class="stat-number">${foundAlbums.length}</div><div class="stat-label">Albums Found</div></div>`;
        html += `<div class="stat-item"><div class="stat-number">${foundTrackCount}</div><div class="stat-label">Total Tracks Added</div></div>`;
        html += `<div class="stat-item"><div class="stat-number">${notFound.length}</div><div class="stat-label">Albums Not Found</div></div>`;
        html += `<div class="stat-item"><div class="stat-number">${this.csvData.length}</div><div class="stat-label">Total Albums Processed</div></div>`;
        html += '</div>';

        if (foundTrackCount > 0) {
            html += `<div class="status-success">✅ Successfully created playlist with ${foundTrackCount} tracks from ${foundAlbums.length} albums!</div>`;
        }

        if (foundAlbums.length > 0) {
            html += '<details style="margin-top: 15px;"><summary>View albums found (' + foundAlbums.length + ')</summary>';
            html += '<ul style="margin-top: 10px; max-height: 200px; overflow-y: auto;">';
            foundAlbums.forEach(album => {
                html += `<li>✅ ${album}</li>`;
            });
            html += '</ul></details>';
        }

        if (notFound.length > 0) {
            html += '<details style="margin-top: 15px;"><summary>View albums not found (' + notFound.length + ')</summary>';
            html += '<ul style="margin-top: 10px; max-height: 200px; overflow-y: auto;">';
            notFound.forEach(album => {
                html += `<li>❌ ${album}</li>`;
            });
            html += '</ul></details>';
        }

        html += '</div>';
        results.innerHTML = html;
    }

    showStep(stepNumber) {
        console.log(`Showing steps up to: ${stepNumber}`);
        for (let i = 1; i <= 4; i++) {
            const step = document.getElementById(`step${i}`);
            if (step) {
                if (i <= stepNumber) {
                    step.style.display = 'block';
                    console.log(`Step ${i}: shown`);
                } else {
                    console.log(`Step ${i}: hidden`);
                }
            } else {
                console.log(`Step ${i}: element not found`);
            }
        }
    }

    showStatus(message, type) {
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = message;

        const container = document.querySelector('.step-container');
        container.insertBefore(statusDiv, container.firstChild);

        setTimeout(() => {
            statusDiv.remove();
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const converter = new DiscogsToSpotifyConverter();

    const authenticated = await converter.checkSpotifyAuth();
    if (authenticated) {
        // If we're authenticated and have CSV data, show all steps
        if (converter.csvData && converter.csvData.length > 0) {
            converter.showStep(4);
        } else {
            // If authenticated but no CSV, show steps 2-4 so user can upload CSV
            converter.showStep(4);
        }
    }
});