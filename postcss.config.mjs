const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Smart-TV browsers predate CSS cascade layers and silently drop every
    // @layer block — i.e. all of Tailwind's output. Transpile the layers away
    // so the utilities apply as plain rules.
    "@csstools/postcss-cascade-layers": {},
  },
};

export default config;
