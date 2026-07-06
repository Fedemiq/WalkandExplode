class Scene {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) throw new Error('WebGL2 non supportato dal browser.');

        this.program = null;
        
        this.arenaParts = null;
        this.boardParts = null;
        this.spawnParts = null;
        this.posterParts = null; // Nuova variabile per le parti del poster

        this.player1Parts = null;
        this.player2Parts = null;
        this.meshPlayer1 = null; 
        this.meshPlayer2 = null;
        this.meshPoster = null;  // Nuova variabile per la mesh del poster
        
        this.boardTexture = null; 
        this.spawnTexture = null;
        this.posterTexture = null;
        
        this.currentPlayersState = [];
        this.explodingPlayerId = null;
        this.explosionStartTime = 0;
        this.activeBombsCount = 0;

        this.advancedRenderEnabled = false;
        document.addEventListener('toggle-advanced-render', (e) => {
            this.advancedRenderEnabled = e.detail.enabled;
        });
    }

    async init() {
        const gl = this.gl;
        gl.enable(gl.DEPTH_TEST);

        this.program = webglUtils.createProgramFromScripts(gl, ['vertex-shader', 'fragment-shader']);

        this.attribLocations = {
            position: gl.getAttribLocation(this.program, 'a_position'),
            uv: gl.getAttribLocation(this.program, 'a_uv'),
            normal: gl.getAttribLocation(this.program, 'a_normal'),
            instanceMatrix: gl.getAttribLocation(this.program, 'a_instanceMatrix'),
        };

        this.uniformLocations = {
            view: gl.getUniformLocation(this.program, 'u_view'),
            projection: gl.getUniformLocation(this.program, 'u_projection'),
            color: gl.getUniformLocation(this.program, 'u_color'),
            useTexture: gl.getUniformLocation(this.program, 'u_useTexture'),
            texture: gl.getUniformLocation(this.program, 'u_texture'),
            lightPosition: gl.getUniformLocation(this.program, 'u_lightPosition'),
            lightColor: gl.getUniformLocation(this.program, 'u_lightColor'),
            viewPosition: gl.getUniformLocation(this.program, 'u_viewPosition'),
            isBoard: gl.getUniformLocation(this.program, 'u_isBoard'),
            time: gl.getUniformLocation(this.program, 'u_time'),
            activeBombs: gl.getUniformLocation(this.program, 'u_activeBombs'),
            advancedRender: gl.getUniformLocation(this.program, 'u_advancedRender'),
            fade: gl.getUniformLocation(this.program, 'u_fade'),
            uvScale: gl.getUniformLocation(this.program, 'u_uvScale')
        };

        this.boardTexture = await loadTexture(gl, 'assets/marmo_bianco.jpeg');
        this.spawnTexture = await loadTexture(gl, 'assets/spawn.png');

        
        this.meshPoster = await loadPipelineMesh('assets/foto-autore.obj', 'assets/');
        this.posterTexture = await loadTexture(gl, 'assets/foto.png');

        await this.loadArena('hell');

        const meshBoard = await loadPipelineMesh('assets/casella.obj', 'assets/');
        const boardMatrices = [];
        const spawnMatrices = [];
        const size = 9;
        const offset = 4;

        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const matrix = m4.translation(x - offset, 0.0, z - offset);
                if ((x === 0 && z === 4) || (x === 8 && z === 4)) {
                    spawnMatrices.push(matrix);
                } else {
                    boardMatrices.push(matrix);
                }
            }
        }
        this.boardParts = createInstancedMultiPartModel(gl, meshBoard, this.attribLocations, boardMatrices);
        this.spawnParts = createInstancedMultiPartModel(gl, meshBoard, this.attribLocations, spawnMatrices);

        this.meshPlayer1 = await loadPipelineMesh('assets/scimmia1/scimmia1.obj', 'assets/scimmia1/');
        preloadMaterialTextures(gl, this.meshPlayer1, 'assets/scimmia1/');

        this.meshPlayer2 = await loadPipelineMesh('assets/scimmia2/scimmia2.obj', 'assets/scimmia2/');
        preloadMaterialTextures(gl, this.meshPlayer2, 'assets/scimmia2/');
    }

    async loadArena(arenaType) {
        const gl = this.gl;
        
        // Pulisce l'arena esistente
        const oldParts = this.arenaParts;
        this.arenaParts = null; 
        if (oldParts) {
            oldParts.forEach(part => gl.deleteVertexArray(part.vao));
        }

        // Pulisce il poster esistente per riposizionarlo
        const oldPosterParts = this.posterParts;
        this.posterParts = null;
        if (oldPosterParts) {
            oldPosterParts.forEach(part => gl.deleteVertexArray(part.vao));
        }

        let objPath = '';
        let basePath = '';

        if (arenaType === 'hell') {
            objPath = 'assets/hell-arena/hell-arena.obj';
            basePath = 'assets/hell-arena/';
        } else if (arenaType === 'parking') {
            objPath = 'assets/parking-arena.obj'; 
            basePath = 'assets/'; 
        }

        try {
            const meshArena = await loadPipelineMesh(objPath, basePath);
            preloadMaterialTextures(gl, meshArena, basePath);
            
            this.arenaParts = createInstancedMultiPartModel(gl, meshArena, this.attribLocations, [m4.identity()]);

            // Ricostruisce il poster nella nuova posizione appropriata per l'arena
            if (this.meshPoster) {
                let posterMatrix;
                if (arenaType === 'hell') {
                    // Posizione per Hell Arena (assunto x=0)
                    posterMatrix = m4.translation(14, 1, -2);
                } else if (arenaType === 'parking') {
                    // Posizione e rotazione per Parking Arena
                    posterMatrix = m4.translation(-1.2, 2.5, 5);
                    posterMatrix = m4.zRotate(posterMatrix, Math.PI / 2);
                    posterMatrix = m4.xRotate(posterMatrix, -(Math.PI / 2));
                }
                
                this.posterParts = createInstancedMultiPartModel(gl, this.meshPoster, this.attribLocations, [posterMatrix]);
            }
        } catch (e) {
            console.error("Errore nel caricamento dell'arena:", e);
        }
    }

    updateActiveBombs(count) {
        this.activeBombsCount = count;
    }

    updatePlayerMatrix(playerId, matrix) {
        const flatMatrix = new Float32Array(matrix); 
        const parts = playerId === 1 ? this.player1Parts : this.player2Parts;
        if (!parts) return;

        parts.forEach(part => {
            this.gl.bindVertexArray(part.vao);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, part.instanceBuffer);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, flatMatrix);
        });
        this.gl.bindVertexArray(null);
    }

    updatePlayers(players) {
        if (!this.meshPlayer1 || !this.meshPlayer2) 
            return;

        this.currentPlayersState = JSON.parse(JSON.stringify(players));
        const offset = 4;
        
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            let matrix = m4.translation(p.x - offset, 0.0, p.z - offset);
            if (p.id === 2) 
                matrix = m4.yRotate(matrix, Math.PI);
            
            if (p.id === 1) {
                if (this.player1Parts) 
                    this.player1Parts.forEach(p => this.gl.deleteVertexArray(p.vao));
                this.player1Parts = createInstancedMultiPartModel(this.gl, this.meshPlayer1, this.attribLocations, [matrix]);
            } else {
                if (this.player2Parts) 
                    this.player2Parts.forEach(p => this.gl.deleteVertexArray(p.vao));
                this.player2Parts = createInstancedMultiPartModel(this.gl, this.meshPlayer2, this.attribLocations, [matrix]);
            }
        }
    }

    startExplosionAnimation(playerId, startTime) {
        this.explodingPlayerId = playerId;
        this.explosionStartTime = startTime;
    }

    resetExplosion() {
        this.explodingPlayerId = null;
        this.explosionStartTime = 0;
    }

    resize() {
        webglUtils.resizeCanvasToDisplaySize(this.canvas);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render(time = 0) {
        const gl = this.gl;
        this.resize();

        let currentFade = 1.0;

        if (this.explodingPlayerId) {
            let t = time - this.explosionStartTime;
            if (t > 0) {
                let p = this.currentPlayersState.find(p => p.id === this.explodingPlayerId);
                if (p) {
                    const offset = 4;
                    let yPos = t * 3.0; 
                    let yRot = (p.id === 2 ? Math.PI : 0) + (t * t * 12.0); 

                    let matrix = m4.translation(p.x - offset, yPos, p.z - offset);
                    matrix = m4.yRotate(matrix, yRot);
                    this.updatePlayerMatrix(p.id, matrix);
                }
                currentFade = Math.max(0.0, 1.0 - (t / 3.0));
            }
        }

        gl.clearColor(0.15, 0.15, 0.15, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!this.program) return;
        gl.useProgram(this.program);

        const aspect = this.canvas.width / this.canvas.height;
        const projection = m4.perspective(Math.PI / 3, aspect, 0.1, 100.0);
        const view = this.camera.getViewMatrix();

        gl.uniformMatrix4fv(this.uniformLocations.projection, false, projection);
        gl.uniformMatrix4fv(this.uniformLocations.view, false, view);

        gl.uniform3fv(this.uniformLocations.lightPosition, [0.0, 15.0, 5.0]);
        gl.uniform3fv(this.uniformLocations.lightColor, [1.0, 0.95, 0.9]);
        gl.uniform3fv(this.uniformLocations.viewPosition, this.camera.getPosition());
        
        gl.uniform1f(this.uniformLocations.time, time);
        gl.uniform1f(this.uniformLocations.activeBombs, this.activeBombsCount);
        gl.uniform1i(this.uniformLocations.advancedRender, this.advancedRenderEnabled ? 1 : 0);

        const drawParts = (partsArray, baseColor, isBoard, overrideTexture = null, isExploding = false, uvScaleOverride = 35.0) => {
            if (!partsArray) return;
            
            if (isExploding && this.advancedRenderEnabled) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.uniform1f(this.uniformLocations.fade, currentFade);
            } else {
                gl.disable(gl.BLEND);
                gl.uniform1f(this.uniformLocations.fade, 1.0);
            }

            partsArray.forEach(part => {
                gl.bindVertexArray(part.vao);
                
                let matColor = part.color || [1.0, 1.0, 1.0, 1.0];
                let finalColor = [
                    baseColor[0] * matColor[0], baseColor[1] * matColor[1], baseColor[2] * matColor[2], 1.0
                ];
                
                gl.uniform4fv(this.uniformLocations.color, finalColor);
                gl.uniform1i(this.uniformLocations.isBoard, isBoard);
                
                let texBound = false;
                
                if (overrideTexture) {
                    gl.uniform1i(this.uniformLocations.useTexture, 1);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, overrideTexture);
                    gl.uniform1i(this.uniformLocations.texture, 0);
                    gl.uniform1f(this.uniformLocations.uvScale, uvScaleOverride); 
                    texBound = true;
                } else if (part.texName) {
                    const tex = loadedTextures.get(part.texName);
                    if (tex) {
                        gl.uniform1i(this.uniformLocations.useTexture, 1);
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, tex);
                        gl.uniform1i(this.uniformLocations.texture, 0);
                        gl.uniform1f(this.uniformLocations.uvScale, 1.0); 
                        texBound = true;
                    }
                }

                if (!texBound) {
                    gl.uniform1i(this.uniformLocations.useTexture, 0);
                    gl.uniform1f(this.uniformLocations.uvScale, 1.0); 
                }
                
                gl.drawArraysInstanced(gl.TRIANGLES, 0, part.vertexCount, part.instanceCount);
            });

            gl.disable(gl.BLEND);
        };

        drawParts(this.arenaParts, [1.0, 1.0, 1.0, 1.0], 0);
        drawParts(this.posterParts, [1.0, 1.0, 1.0, 1.0], 0, this.posterTexture, false, 1.0);
        drawParts(this.boardParts, [0.7, 0.7, 0.7, 1.0], 1, this.boardTexture, false, 1.0); 
        drawParts(this.spawnParts, [1.0, 1.0, 1.0, 1.0], 1, this.spawnTexture, false, 10.0); 
        
        let p1Exploding = (this.explodingPlayerId === 1);
        let p2Exploding = (this.explodingPlayerId === 2);
        
        drawParts(this.player1Parts, [1.0, 1.0, 1.0, 1.0], 0, null, p1Exploding);
        drawParts(this.player2Parts, [1.0, 1.0, 1.0, 1.0], 0, null, p2Exploding);

        gl.bindVertexArray(null);
    }
}
