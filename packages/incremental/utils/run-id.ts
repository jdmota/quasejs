export class RunId {
  private id = 0; // If negative, it is not active

  getId() {
    return this.id;
  }

  newId() {
    this.id = Math.abs(this.id) + 1;
    return this.id;
  }

  cancel() {
    this.id = -this.id;
  }

  isActive(id: number) {
    return this.id === id;
  }

  isNotActive(id: number) {
    return this.id !== id;
  }
}
