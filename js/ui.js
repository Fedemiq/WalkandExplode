class UI {
    constructor(scene) {
        this.scene = scene;
        this.roundBanner = document.getElementById('round-banner');
        this.gameOverBanner = document.getElementById('game-over-banner');
        
        this.pg1Controls = document.querySelectorAll('#controls-pg1 .ctrl-btn');
        this.pg2Controls = document.querySelectorAll('#controls-pg2 .ctrl-btn');
        this.btnBomb1 = document.getElementById('btn-bomb-1');
        this.btnBomb2 = document.getElementById('btn-bomb-2');

        this.currentTurn = 1;

        this.bgAudio = new Audio();
        this.bgAudio.loop = true;
        this.bgAudio.volume = 0.3;

        this.explodeAudio = new Audio('assets/explosion.mp3'); 
        this.explodeAudio.volume = 0.8;

        const musicSelect = document.getElementById('music-select');
        if(musicSelect) {
            musicSelect.addEventListener('change', (e) => {
                if(e.target.value === 'none') {
                    this.bgAudio.pause();
                } else {
                    this.bgAudio.src = e.target.value;
                    this.bgAudio.play().catch(err => console.warn("Audio bloccato:", err));
                }
            });
        }

        const arenaSelect = document.getElementById('arena-select');
        if(arenaSelect) {
            arenaSelect.addEventListener('change', (e) => {
                document.dispatchEvent(new CustomEvent('change-arena', { detail: { arena: e.target.value } }));
            });
        }

        const advRenderChk = document.getElementById('advanced-render-chk');
        if (advRenderChk) {
            advRenderChk.addEventListener('change', (e) => {
                document.dispatchEvent(new CustomEvent('toggle-advanced-render', { detail: { enabled: e.target.checked } }));
            });
        }

        this.mapPG1 = {
            'n':  { dx:  1, dz:  0 }, 's':  { dx: -1, dz:  0 },
            'w':  { dx:  0, dz: -1 }, 'e':  { dx:  0, dz:  1 },
            'nw': { dx:  1, dz: -1 }, 'ne': { dx:  1, dz:  1 },
            'sw': { dx: -1, dz: -1 }, 'se': { dx: -1, dz:  1 }
        };

        this.mapPG2 = {
            'n':  { dx: -1, dz:  0 }, 's':  { dx:  1, dz:  0 },
            'w':  { dx:  0, dz:  1 }, 'e':  { dx:  0, dz: -1 },
            'nw': { dx: -1, dz:  1 }, 'ne': { dx: -1, dz: -1 },
            'sw': { dx:  1, dz:  1 }, 'se': { dx:  1, dz: -1 }
        };

        this._bindControls();
    }

    _bindControls() {
        const bindButton = (id, action) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault(); 
                if (!btn.disabled) action();
            });
        };

        const dirs = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

        for (const dir of dirs) {
            bindButton(`btn-${dir}-1`, () => this._emitMove(1, this.mapPG1[dir].dx, this.mapPG1[dir].dz));
            bindButton(`btn-${dir}-2`, () => this._emitMove(2, this.mapPG2[dir].dx, this.mapPG2[dir].dz));
        }

        bindButton('btn-bomb-1', () => this._emitBomb(1));
        bindButton('btn-bomb-2', () => this._emitBomb(2));

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            const keyToDir = {
                'w': 'n', 'a': 'w', 's': 's', 'd': 'e',
                'q': 'nw', 'e': 'ne', 'z': 'sw', 'x': 'se'
            };

            if (keyToDir[key]) {
                const dir = keyToDir[key];
                if (this.currentTurn === 1) {
                    this._emitMove(1, this.mapPG1[dir].dx, this.mapPG1[dir].dz);
                } else if (this.currentTurn === 2) {
                    this._emitMove(2, this.mapPG2[dir].dx, this.mapPG2[dir].dz);
                }
            }

            
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault(); 
                this._emitBomb(this.currentTurn);
            }
        });
    }

    _emitMove(playerId, dx, dz) {
        document.dispatchEvent(new CustomEvent('player-move', { detail: { playerId, dx, dz } }));
    }

    _emitBomb(playerId) {
        document.dispatchEvent(new CustomEvent('player-bomb', { detail: { playerId } }));
    }

    updateTurn(currentTurn, bombUsed) {
        this.currentTurn = currentTurn;
        
        // Attiva disattiva i pulsanti direzionali in base al turno
        this.pg1Controls.forEach(btn => { if (btn) btn.disabled = (currentTurn !== 1); });
        this.pg2Controls.forEach(btn => { if (btn) btn.disabled = (currentTurn !== 2); });
        
        // Forza la disattivazione del pulsante bomba in base all'effettivo utilizzo, scavalcando l'abilitazione globale
        if (this.btnBomb1) {
            this.btnBomb1.disabled = (currentTurn !== 1 || bombUsed[1]);
        }
        if (this.btnBomb2) {
            this.btnBomb2.disabled = (currentTurn !== 2 || bombUsed[2]);
        }
    }

    showRound(roundNum) {
        this.roundBanner.textContent = `ROUND N. ${roundNum}`;
        this.roundBanner.classList.remove('hidden');
        this.roundBanner.classList.add('visible');
        
        setTimeout(() => {
            this.roundBanner.classList.remove('visible');
            this.roundBanner.classList.add('hidden');
        }, 1500);
    }

    triggerExplosionFX(explodingId, winnerId) {
        this.pg1Controls.forEach(btn => { if (btn) btn.disabled = true; });
        this.pg2Controls.forEach(btn => { if (btn) btn.disabled = true; });

        this.bgAudio.pause();
        this.explodeAudio.currentTime = 0;
        this.explodeAudio.play().catch(err => console.warn("Audio boom bloccato:", err));

        setTimeout(() => {
            const flash = document.getElementById('white-flash');
            if (flash) flash.style.opacity = '1';
        }, 6000); 

        setTimeout(() => {
            this.gameOverBanner.innerHTML = `PG${explodingId} È ESPLOSO!<br>VINCE PG${winnerId}`;
            this.gameOverBanner.style.color = "#ffffff";
            this.gameOverBanner.style.textShadow = "none";
            this.gameOverBanner.classList.remove('hidden');
            this.gameOverBanner.classList.add('visible');
        }, 3000); 

        setTimeout(() => {
            const flash = document.getElementById('white-flash');
            if (flash) flash.style.opacity = '0';
            
            this.gameOverBanner.classList.remove('visible');
            this.gameOverBanner.classList.add('hidden');
            this.gameOverBanner.style.color = "#ffffff";
            this.gameOverBanner.style.textShadow = "0 4px 10px rgba(0, 0, 0, 0.9)";

            const musicSelect = document.getElementById('music-select');
            if (musicSelect && musicSelect.value !== 'none') {
                this.bgAudio.play().catch(err => {});
            }

            document.dispatchEvent(new CustomEvent('restart-game'));
        }, 17000); 
    }
}