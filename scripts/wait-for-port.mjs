import net from 'node:net';

const port = Number(process.argv[2] ?? 3000);
const timeoutMs = Number(process.argv[3] ?? 60_000);
const deadline = Date.now() + timeoutMs;

function tryConnect() {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

while (Date.now() < deadline) {
  if (await tryConnect()) {
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

console.error(`Timed out waiting for 127.0.0.1:${port}`);
process.exit(1);
