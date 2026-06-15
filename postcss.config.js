// autoprefixer is intentionally omitted: its current release crashes Vite's
// production build ("browserslist is not a function") while working everywhere
// else. We target modern desktop browsers (PRD §3), which need essentially no
// vendor prefixes, so dropping it is safe. Re-add if a prefix gap ever appears.
export default {
  plugins: {
    tailwindcss: {},
  },
}
