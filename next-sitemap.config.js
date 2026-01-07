/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://doxynix.space",
  generateRobotsTxt: true,

  exclude: [
    "/dashboard",
    "/dashboard/*",
    "/api/*",
    "/icon.png",
    "/apple-icon.png",
    "/manifest.webmanifest",
    "/opengraph-image.png",
    "/twitter-image.png",
  ],

  transform: async (config, path) => {
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: path === "/" ? 1.0 : config.priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      alternateRefs: config.alternateRefs ?? [],
    };
  },

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api"],
      },
    ],
  },
};
