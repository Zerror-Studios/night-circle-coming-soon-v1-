export const siteConfig = {
  name: "Website Name",
  description: "Website description",
  url: "https://localhost:3000",
  locale: "en_IN",
  language: "en-IN",
  ogImage: "/og.png",
  keywords: [
    "",
    "",
    "",
    "",
  ],
  contact: {
    phone: "",
    email: "",
  },
  address: {
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "IN",
  },
  socials: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
  },
};

export const siteRoutes = [
  {
    path: "/",
    label: "Home",
    title: "Home",
    description: siteConfig.description,
    priority: 1,
  },
  {
    path: "/about",
    label: "About",
    title: "About",
    description: "",
    priority: 0.8,
  },
  {
    path: "/contact",
    label: "Contact",
    title: "Contact",
    description: "",
    priority: 0.7,
  },
];
