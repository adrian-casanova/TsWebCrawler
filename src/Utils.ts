class Utils {
  static sleep(timeout: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeout);
    });
  }
}

export default Utils;
