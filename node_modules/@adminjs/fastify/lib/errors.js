export class WrongArgumentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WrongArgumentError';
    }
}
