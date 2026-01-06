/**
 * Configuration management for the Bitbucket to Teams webhook integration
 * Loads configuration from environment variables with validation
 */
import { Config } from './types';
/**
 * ConfigManager class to load and validate configuration from environment variables
 */
export declare class ConfigManager {
    /**
     * Load configuration from environment variables
     * Throws an error if required variables are missing
     *
     * @returns Config object with all required configuration
     * @throws Error if required environment variables are missing
     */
    static loadFromEnvironment(): Config;
}
//# sourceMappingURL=config.d.ts.map