# file9

A small, public shelf for temporary files. file9 accepts images, audio, PDF,
text, Markdown, and Word documents up to 4 MB and automatically removes them
after their selected expiry time.

## Local development

```bash
npm install
npm run dev
```

The Netlify Vite plugin emulates Functions and Blobs locally.

To test moderator mode, create a local `.env` file from `.env.example`, set a
long `ADMIN_TOKEN`, and open `http://localhost:5173/?admin=1`.

## Production

1. Push this repository to GitHub.
2. Import the repository into Netlify.
3. Add `ADMIN_TOKEN` under the Netlify project's environment variables.
4. Deploy. Netlify reads the build settings from `netlify.toml`.

## Supported files

- Images: JPG, PNG, GIF, WebP
- Audio: MP3, WAV, OGG, M4A
- Documents: PDF, TXT, Markdown, DOC, DOCX

Word files are download-only. All other supported formats can be opened or
previewed in the browser.
