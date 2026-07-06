class Camera {
    constructor(position = [0, 12, 15], target = [0, 0, 0], up = [0, 1, 0]) {
        this.position = position;
        this.target = target;
        this.upAxis = up;

        const toTarget = m4.subtractVectors(position, target);
        this.distance = Math.sqrt(toTarget[0]**2 + toTarget[1]**2 + toTarget[2]**2);
        this.theta = Math.atan2(toTarget[0], toTarget[2]);
        this.phi = Math.acos(toTarget[1] / this.distance);
    }

    getPosition() {
        return this.position;
    }

    getViewMatrix() {
        const cameraMatrix = m4.lookAt(this.position, this.target, this.upAxis);
        return m4.inverse(cameraMatrix);
    }

    orbit(deltaX, deltaY) {
        this.theta -= deltaX * 0.01;
        this.phi -= deltaY * 0.01;

        const minPhi = 0.1;
        const maxPhi = Math.PI / 2 - 0.1; 
        this.phi = Math.max(minPhi, Math.min(maxPhi, this.phi));

        this._updatePosition();
    }

    zoom(deltaY) {
        this.distance += deltaY * 0.05;
        this.distance = Math.max(5, Math.min(30, this.distance));

        this._updatePosition();
    }

    _updatePosition() {
        const sinPhi = Math.sin(this.phi);
        const cosPhi = Math.cos(this.phi);
        const sinTheta = Math.sin(this.theta);
        const cosTheta = Math.cos(this.theta);

        this.position = [
            this.target[0] + this.distance * sinPhi * sinTheta,
            this.target[1] + this.distance * cosPhi,
            this.target[2] + this.distance * sinPhi * cosTheta,
        ];
    }
}