// Mirrors the inline config in index.html — used by build-offline.mjs
module.exports = {
  content: ["./index.html", "./assets/js/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ["Archivo", "system-ui", "sans-serif"],
        sign: ["Anton", "Impact", "Arial Narrow Bold", "sans-serif"],
      },
      colors: {
        brand: { 50: "#effaf0", 100: "#d9f2dc", 200: "#b2e4b8", 300: "#84d18d", 400: "#5cbf63", 500: "#43ad4c", 600: "#2f9440", 700: "#1f7a33", 800: "#17602a", 900: "#0f4420", 950: "#082a14" },
        heart: { 500: "#e5262b", 600: "#c41d22" },
        accent: { 400: "#f9a53e", 500: "#f28c1b", 600: "#d97306" },
      },
      boxShadow: { card: "0 1px 2px rgba(15,68,32,.06), 0 8px 24px -12px rgba(15,68,32,.18)" },
    },
  },
};
