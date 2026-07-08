class Game {
    constructor(scene, camera, ui) {
        this.scene = scene;
        this.camera = camera;
        this.ui = ui;
        
        this.boardSize = 9;
        this.boardLogic = this._initBoard();
        
        this.players = [
            { id: 1, x: 0, z: 4 },
            { id: 2, x: 8, z: 4 }
        ];

        this.currentRound = 1;
        this.currentTurn = 1; 
        this.gameOver = false;
        this.bombUsedThisRound = { 1: false, 2: false };

        this.scene.updatePlayers(this.players);
        
        this.ui.updateTurn(this.currentTurn, this.bombUsedThisRound);
        this.ui.showRound(this.currentRound);
    } 

    _initBoard() {
        const board = [];
        for (let z = 0; z < this.boardSize; z++) {
            const row = [];
            for (let x = 0; x < this.boardSize; x++) {
                row.push({ active: false });
            }
            board.push(row);
        }
        return board;
    } 

    movePlayer(playerId, dx, dz) {
        if (this.gameOver || this.currentTurn !== playerId) return;

        const p = this.players[playerId - 1];
        const newX = p.x + dx;
        const newZ = p.z + dz;

        if (newX >= 0 && newX < this.boardSize && newZ >= 0 && newZ < this.boardSize) {
            
            const otherPlayerId = playerId === 1 ? 2 : 1;
            const otherP = this.players[otherPlayerId - 1];
            if (newX === otherP.x && newZ === otherP.z) {
                return; 
            }

            p.x = newX;
            p.z = newZ;
            this.scene.updatePlayers(this.players);

            if (this.boardLogic[newZ][newX].active) {
                this.gameOver = true;
                
                document.dispatchEvent(new CustomEvent('player-explode', { 
                    detail: { explodingId: playerId, winnerId: otherPlayerId } 
                }));
                return;
            }
            this._nextTurn();
        }
    } 

    useBomb(playerId) {    
        if (this.gameOver || this.currentTurn !== playerId || this.bombUsedThisRound[playerId]) return;
        
        const disabledTiles = [];
        const p1 = this.players[0];
        const p2 = this.players[1];
        let bombCount = 0;

        for (let z = 0; z < this.boardSize; z++) {
            for (let x = 0; x < this.boardSize; x++) {
                if ((x === p1.x && z === p1.z) || (x === p2.x && z === p2.z)) continue;
                
                if (!this.boardLogic[z][x].active) {
                    disabledTiles.push({x, z});
                } else {
                    bombCount++;
                }
            }
        }

        if (disabledTiles.length > 0) {
            const rand = disabledTiles[Math.floor(Math.random() * disabledTiles.length)];
            this.boardLogic[rand.z][rand.x].active = true;
            bombCount++;
        }

        this.scene.updateActiveBombs(bombCount);
        
        this.bombUsedThisRound[playerId] = true;
        this.ui.updateTurn(this.currentTurn, this.bombUsedThisRound);
    }

    _nextTurn() {
        if (this.currentTurn === 1) {
            this.currentTurn = 2;
            this.ui.updateTurn(this.currentTurn, this.bombUsedThisRound);
        } else {
            this.currentRound++;
            this.currentTurn = 1;
            this.bombUsedThisRound = { 1: false, 2: false };
            this.ui.showRound(this.currentRound);
            this.ui.updateTurn(this.currentTurn, this.bombUsedThisRound);
        }
    } 

    restartGame() {
        this.boardLogic = this._initBoard();
        this.players = [
            { id: 1, x: 0, z: 4 },
            { id: 2, x: 8, z: 4 }
        ];
        this.currentRound = 1;
        this.currentTurn = 1; 
        this.gameOver = false;
        this.bombUsedThisRound = { 1: false, 2: false };

        this.scene.resetExplosion();
        this.scene.updateActiveBombs(0);
        this.scene.updatePlayers(this.players);
        
        this.ui.updateTurn(this.currentTurn, this.bombUsedThisRound);
        this.ui.showRound(this.currentRound);
    } 
}