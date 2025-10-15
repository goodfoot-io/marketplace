interface Config {
  port: number;
  host: string;
  debug: boolean;
}

class ConfigManager {
  private config: Config = {
    port: 3000,
    host: 'localhost',
    debug: false
  };

  get(key: keyof Config) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }
}

export const config = new ConfigManager();
