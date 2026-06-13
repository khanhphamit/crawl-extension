export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Bell-curve distribution — trung bình tập trung giữa khoảng, ít extreme hơn uniform
export function randomDelay(): number {
  // 5% xác suất "mất tập trung" — pause dài 8-20s
  if (Math.random() < 0.05) {
    return Math.floor(Math.random() * 12000) + 8000;
  }
  // Dùng trung bình 2 số random để ra phân phối hình chuông
  const r = (Math.random() + Math.random()) / 2;
  return Math.floor(r * 3000) + 2000;
}

// Delay ngắn cho thao tác nhỏ (hover, focus...)
export function microDelay(): number {
  return Math.floor(Math.random() * 150) + 50;
}