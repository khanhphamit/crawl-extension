export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function randomDelay() {
  return Math.floor(Math.random() * 3000) + 2000;
}