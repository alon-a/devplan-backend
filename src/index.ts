import { app, initializeServices } from './app';
import config from './config';
import { logInfo, logError } from '@devplan/common';

const startServer = async () => {
  try {
    // Initialize all services
    await initializeServices();

    // Start the server
    const server = app.listen(config.PORT, () => {
      logInfo(`🚀 DevPlan Video Therapy API server running on port ${config.PORT}`);
      logInfo(`📊 Environment: ${config.NODE_ENV}`);
      logInfo(`🔗 Health check: http://localhost:${config.PORT}/health`);
      logInfo(`📚 API docs: http://localhost:${config.PORT}/api`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logInfo(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          logError(err, 'Error during server shutdown');
          process.exit(1);
        }
        
        logInfo('Server closed successfully');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logError(new Error('Forced shutdown after timeout'), 'Graceful shutdown timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logError(error, 'Uncaught Exception');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), 'Unhandled Rejection');
      process.exit(1);
    });

  } catch (error) {
    logError(error as Error, 'Failed to start server');
    process.exit(1);
  }
};

// Start the server
startServer(); 