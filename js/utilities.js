async function loadTextResource(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Impossibile caricare il file: ${url}`);
    }
    return response.text();
}

function loadImageResource(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Impossibile caricare l'immagine: ${url}`));
        image.src = url;
    });
}

async function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

    if (!url) return texture;

    try {
        const image = await loadImageResource(url);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    } catch (error) {
        console.warn(error);
    }
    
    return texture;
}

const loadedTextures = new Map();

function preloadMaterialTextures(gl, mesh, basePath) {
    if (!mesh.materials) return;
    
    mesh.materials.forEach(mat => {
        if (mat.parameter.has("map_Kd")) {
            let imgName = mat.parameter.get("map_Kd");
            if (!loadedTextures.has(imgName)) {
                let tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([150, 150, 150, 255]));

                let img = new Image();
                img.onload = function() {
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    gl.generateMipmap(gl.TEXTURE_2D); 
                };
                img.src = basePath + imgName; 
                loadedTextures.set(imgName, tex);
            }
        }
    });
}

async function loadPipelineMesh(objUrl, basePath) {
    const objData = await loadTextResource(objUrl);
    let mesh = new subd_mesh();
    
    let objResult = glmReadOBJ(objData, mesh);
    if (objResult && objResult.mesh) {
        mesh = objResult.mesh;
    }

    if (objResult && objResult.fileMtl) {
        try {
            let mtlUrl = basePath + objResult.fileMtl;
            let mtlData = await loadTextResource(mtlUrl);
            glmReadMTL(mtlData, mesh);
        } catch (e) {
            console.warn("Impossibile caricare il file MTL associato:", e);
        }
    }
    
    return mesh;
}

function meshGroupToGeometry(mesh, group) {
    const positions = [];
    const uvs = [];
    const normals = [];

    for (let i = 0; i < group.triangles.length; i++) {
        const faceIdx = group.triangles[i];
        const face = mesh.face[faceIdx];
        const vertexIndices = [0, 1, 2];
        
        for (let j = 0; j < 3; j++) {
            const idx = vertexIndices[j];
            const v = mesh.vert[face.vert[idx]];
            positions.push(v.x, v.y, v.z);

            if (mesh.textCoords && face.textCoordsIndex[idx]) {
                const tc = mesh.textCoords[face.textCoordsIndex[idx]];
                uvs.push(tc.u, tc.v);
            } else {
                uvs.push(0, 0);
            }

            if (mesh.normal && face.normalVertexIndex[idx]) {
                const n = mesh.normal[face.normalVertexIndex[idx]];
                normals.push(n.i, n.j, n.k);
            } else {
                normals.push(0, 1, 0);
            }
        }
    }
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        normals: new Float32Array(normals),
        vertexCount: positions.length / 3,
    };
}

function createInstancedModel(gl, geometry, attribLocations, instanceMatrices) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attribLocations.position);
    gl.vertexAttribPointer(attribLocations.position, 3, gl.FLOAT, false, 0, 0); 

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attribLocations.uv);
    gl.vertexAttribPointer(attribLocations.uv, 2, gl.FLOAT, false, 0, 0); 

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attribLocations.normal);
    gl.vertexAttribPointer(attribLocations.normal, 3, gl.FLOAT, false, 0, 0);

    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer); 
    const flatMatrices = new Float32Array(instanceMatrices.length * 16);
    for (let i = 0; i < instanceMatrices.length; i++) {
        flatMatrices.set(instanceMatrices[i], i * 16);
    }
    gl.bufferData(gl.ARRAY_BUFFER, flatMatrices, gl.DYNAMIC_DRAW); 

    const baseLoc = attribLocations.instanceMatrix;
    for (let i = 0; i < 4; i++) {
        const loc = baseLoc + i;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 64, i * 16);
        gl.vertexAttribDivisor(loc, 1);
    }

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return {
        vao,
        vertexCount: geometry.vertexCount,
        instanceCount: instanceMatrices.length,
        instanceBuffer: instanceBuffer,
        buffers: [positionBuffer, uvBuffer, normalBuffer, instanceBuffer] // Array di tutti i buffer per il clean-up
    };
}

function createInstancedMultiPartModel(gl, mesh, attribLocations, instanceMatrices) {
    const parts = [];
    
    mesh.groups.forEach(group => {
        if (group.triangles.length === 0) return;
        
        let texName = null;
        let diffuseColor = [1.0, 1.0, 1.0, 1.0];
        
        let firstFaceIdx = group.triangles[0];
        let face = mesh.face[firstFaceIdx];
        
        if (face && mesh.materials && mesh.materials[face.material]) {
            let mat = mesh.materials[face.material];
            
            if (mat.parameter.has("map_Kd")) {
                texName = mat.parameter.get("map_Kd");
            }
            
            if (mat.parameter.has("Kd")) {
                let kd = mat.parameter.get("Kd");
                diffuseColor = [kd[0], kd[1], kd[2], 1.0];
            } else if (mat.diffuse) {
                diffuseColor = [mat.diffuse[0], mat.diffuse[1], mat.diffuse[2], 1.0];
            }
        }
        
        const geometry = meshGroupToGeometry(mesh, group);
        const model = createInstancedModel(gl, geometry, attribLocations, instanceMatrices);
        
        parts.push({
            vao: model.vao,
            vertexCount: model.vertexCount,
            instanceCount: model.instanceCount,
            instanceBuffer: model.instanceBuffer, 
            buffers: model.buffers, // Passaggio del puntatore in alto
            texName: texName,
            color: diffuseColor 
        });
    });
    
    return parts;
}