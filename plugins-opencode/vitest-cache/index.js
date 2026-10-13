import { fileURLToPath } from "node:url";

const skillsPath = fileURLToPath(new URL("./skills", import.meta.url));

export default async function vitestCache() {
  return {
    config: async (config) => {
      config.skills ??= {};
      config.skills.paths ??= [];
      if (!config.skills.paths.includes(skillsPath)) config.skills.paths.push(skillsPath);
    },
  };
}
