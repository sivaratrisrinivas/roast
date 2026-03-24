import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 3001);
const app = createApp({ serveClient: true });

app.listen(port, () => {
  console.log(`Roast server listening on http://localhost:${port}`);
});
