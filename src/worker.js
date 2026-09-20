const OLD_HOST = "ppp-index-calculator.tanishqnalloju.com";
const NEW_HOST = "kingindex.tanishqnalloju.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === OLD_HOST) {
      url.hostname = NEW_HOST;
      // Preserve path + full query string (income, home, type, dest, etc.)
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
