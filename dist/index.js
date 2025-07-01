"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = __importDefault(require("./config"));
const common_1 = require("@devplan/common");
const startServer = async () => {
    try {
        // Initialize all services
        await (0, app_1.initializeServices)();
        // Start the server
        const server = app_1.app.listen(config_1.default.PORT, () => {
            (0, common_1.logInfo)(`🚀 DevPlan Video Therapy API server running on port ${config_1.default.PORT}`);
            (0, common_1.logInfo)(`📊 Environment: ${config_1.default.NODE_ENV}`);
            (0, common_1.logInfo)(`🔗 Health check: http://localhost:${config_1.default.PORT}/health`);
            (0, common_1.logInfo)(`📚 API docs: http://localhost:${config_1.default.PORT}/api`);
        });
        // Graceful shutdown handling
        const gracefulShutdown = (signal) => {
            (0, common_1.logInfo)(`Received ${signal}. Starting graceful shutdown...`);
            server.close((err) => {
                if (err) {
                    (0, common_1.logError)(err, 'Error during server shutdown');
                    process.exit(1);
                }
                (0, common_1.logInfo)('Server closed successfully');
                process.exit(0);
            });
            // Force shutdown after 30 seconds
            setTimeout(() => {
                (0, common_1.logError)(new Error('Forced shutdown after timeout'), 'Graceful shutdown timeout');
                process.exit(1);
            }, 30000);
        };
        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            (0, common_1.logError)(error, 'Uncaught Exception');
            process.exit(1);
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            (0, common_1.logError)(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), 'Unhandled Rejection');
            process.exit(1);
        });
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to start server');
        process.exit(1);
    }
};
// Start the server
startServer();
//# sourceMappingURL=index.js.map