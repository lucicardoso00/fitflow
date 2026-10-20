import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const app = createApp({ development: process.env.FORMA_DEV === '1' });

app.on('error', (error) => {
  console.error(`Could not start Forma: ${error.message}`);
  process.exitCode = 1;
});
app.listen(port, host, () => console.log(`Forma: http://${host}:${app.address().port}`));
