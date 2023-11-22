export default class LinkQueue<T> {
  private data: T[] = [];

  add(value: T) {
    this.data.push(value);
  }

  get() {
    return this.data.shift();
  }

  size() {
    return this.data.length;
  }
}
